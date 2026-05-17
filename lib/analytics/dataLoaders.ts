import { prisma } from "@/lib/prisma";
import type {
  AnalyticsApiPayload,
  AnalyticsMetricId,
  AnalyticsPoint,
  ChartResolution,
  ChatVelocityPoint,
  MetricSummary,
  RaidRetentionRow,
  TimePreset
} from "@/lib/analytics/types";
import {
  METRIC_LABELS,
  METRIC_ORDER,
  computeDateWindow
} from "@/lib/analytics/types";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MAX_CHART_POINTS = 200;

type DayAgg = {
  avgViewers: number;
  maxViewers: number;
  follows: number;
  subs: number;
  revenue: number;
  minutesStreamed: number;
  liveViews: number;
  uniqueChatters: number;
  clipsCreated: number;
  hasSummary: boolean;
  snapshotSamples: number;
};

function utcDayKey(d: Date): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0, 10);
}

function prismaUtcDateFromKey(key: string): Date {
  const [y, m, day] = key.split("-").map((x) => Number.parseInt(x, 10));
  return new Date(Date.UTC(y, (m ?? 1) - 1, day ?? 1, 12, 0, 0, 0));
}

function* eachUtcDayKeyBetween(start: Date, end: Date): Generator<string> {
  let t = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endT = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  while (t <= endT) {
    yield new Date(t).toISOString().slice(0, 10);
    t += DAY_MS;
  }
}

function downsampleIfNeeded(points: AnalyticsPoint[], max: number): AnalyticsPoint[] {
  if (points.length <= max) return points;
  const step = Math.ceil(points.length / max);
  const out: AnalyticsPoint[] = [];
  for (let i = 0; i < points.length; i += step) {
    const slice = points.slice(i, i + step);
    const sum = slice.reduce((s, p) => s + p.v, 0);
    out.push({
      t: slice[0]!.t,
      label: slice[0]!.label,
      v: sum / slice.length
    });
  }
  return out;
}

function bucketMeanByMs(points: AnalyticsPoint[], bucketMs: number): AnalyticsPoint[] {
  if (points.length === 0) return [];
  const m = new Map<number, { sum: number; n: number; label: string }>();
  for (const p of points) {
    const k = Math.floor(p.t / bucketMs) * bucketMs;
    const e = m.get(k);
    if (!e) m.set(k, { sum: p.v, n: 1, label: p.label });
    else {
      e.sum += p.v;
      e.n += 1;
    }
  }
  return [...m.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([t, e]) => ({
      t,
      label: new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      v: e.sum / e.n
    }));
}

function intradayCurve(tMs: number): number {
  const frac = (tMs % DAY_MS) / DAY_MS;
  return 0.75 + 0.35 * Math.sin(frac * Math.PI * 2);
}

function metricFromDay(id: AnalyticsMetricId, d: DayAgg): number {
  switch (id) {
    case "averageViewers":
      return d.avgViewers;
    case "maxViewers":
      return d.maxViewers;
    case "newFollowers":
      return d.follows;
    case "newSubscribers":
      return d.subs;
    case "estimatedRevenue":
      return d.revenue;
    case "streamLength":
      return d.minutesStreamed;
    case "liveViews":
      return d.liveViews;
    case "uniqueChatters":
      return d.uniqueChatters;
    case "clipsCreated":
      return d.clipsCreated;
    default:
      return 0;
  }
}

function aggregatePeriod(
  id: AnalyticsMetricId,
  days: DayAgg[]
): number {
  if (days.length === 0) return 0;
  const vals = days.map((d) => metricFromDay(id, d));
  switch (id) {
    case "maxViewers":
      return Math.round(Math.max(...vals, 0) * 10) / 10;
    case "averageViewers": {
      const active = days.filter((d) => d.hasSummary || d.snapshotSamples > 0);
      const pool = active.length ? active : days;
      const sum = pool.reduce((s, d) => s + d.avgViewers, 0);
      return pool.length ? Math.round((sum / pool.length) * 10) / 10 : 0;
    }
    case "estimatedRevenue":
      return Math.round(vals.reduce((a, b) => a + b, 0) * 100) / 100;
    default:
      return Math.round(vals.reduce((a, b) => a + b, 0));
  }
}

function buildDailySeriesForMetric(
  id: AnalyticsMetricId,
  dayKeys: string[],
  rollup: Map<string, DayAgg>
): AnalyticsPoint[] {
  return dayKeys.map((key) => {
    const d = prismaUtcDateFromKey(key);
    const t = d.getTime();
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const day = rollup.get(key) ?? emptyDay();
    return { t, label, v: metricFromDay(id, day) };
  });
}

function emptyDay(): DayAgg {
  return {
    avgViewers: 0,
    maxViewers: 0,
    follows: 0,
    subs: 0,
    revenue: 0,
    minutesStreamed: 0,
    liveViews: 0,
    uniqueChatters: 0,
    clipsCreated: 0,
    hasSummary: false,
    snapshotSamples: 0
  };
}

function buildSeriesForMetric(
  id: AnalyticsMetricId,
  dayKeys: string[],
  rollup: Map<string, DayAgg>,
  start: Date,
  end: Date,
  resolution: ChartResolution,
  snapshots: { timestamp: Date; currentViewers: number; messagesPerMinute: number }[]
): AnalyticsPoint[] {
  const daily = buildDailySeriesForMetric(id, dayKeys, rollup);
  const rangeMs = end.getTime() - start.getTime();

  if (resolution === "day") {
    return downsampleIfNeeded(daily, MAX_CHART_POINTS);
  }

  if (resolution === "week") {
    const weekly = bucketMeanByMs(daily, 7 * DAY_MS);
    return downsampleIfNeeded(weekly, MAX_CHART_POINTS);
  }

  const hoursTotal = Math.ceil(rangeMs / HOUR_MS);
  const stepH = Math.max(1, Math.ceil(hoursTotal / MAX_CHART_POINTS));
  const out: AnalyticsPoint[] = [];

  for (let h = 0; h < hoursTotal; h += stepH) {
    const t = start.getTime() + h * HOUR_MS;
    if (t > end.getTime()) break;
    const key = utcDayKey(new Date(t));
    const day = rollup.get(key) ?? emptyDay();
    const hourStart = t;
    const hourEnd = t + stepH * HOUR_MS;
    const snapsInBucket = snapshots.filter(
      (s) => s.timestamp.getTime() >= hourStart && s.timestamp.getTime() < hourEnd
    );

    let v: number;
    if (id === "averageViewers") {
      if (snapsInBucket.length) {
        v = snapsInBucket.reduce((s, x) => s + x.currentViewers, 0) / snapsInBucket.length;
      } else {
        v = day.avgViewers * intradayCurve(t);
      }
    } else if (id === "maxViewers") {
      const snapMax = snapsInBucket.length ? Math.max(...snapsInBucket.map((s) => s.currentViewers)) : 0;
      v = Math.max(day.maxViewers, snapMax) * (snapsInBucket.length ? 1 : intradayCurve(t));
    } else {
      v = metricFromDay(id, day);
    }

    const d = new Date(t);
    const label =
      rangeMs > 14 * DAY_MS
        ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric" });
    out.push({ t, label, v });
  }

  return out;
}

function buildMetricSummary(
  id: AnalyticsMetricId,
  curKeys: string[],
  rollup: Map<string, DayAgg>,
  start: Date,
  end: Date,
  resolution: ChartResolution,
  snapshots: { timestamp: Date; currentViewers: number; messagesPerMinute: number }[]
): MetricSummary {
  const len = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - len);

  const curDayAggs = curKeys.map((k) => rollup.get(k) ?? emptyDay());

  const prevKeys = [...eachUtcDayKeyBetween(prevStart, prevEnd)];
  const prevDayAggs = prevKeys.map((k) => rollup.get(k) ?? emptyDay());

  const value = aggregatePeriod(id, curDayAggs);
  const prevValue = aggregatePeriod(id, prevDayAggs);
  const trendPct = prevValue === 0 ? (value > 0 ? 100 : 0) : ((value - prevValue) / prevValue) * 100;

  return {
    id,
    label: METRIC_LABELS[id],
    value,
    prevValue,
    trendPct,
    series: buildSeriesForMetric(id, curKeys, rollup, start, end, resolution, snapshots)
  };
}

function buildVelocity(
  rollup: Map<string, DayAgg>,
  start: Date,
  end: Date,
  resolution: ChartResolution,
  snapshots: { timestamp: Date; currentViewers: number; messagesPerMinute: number }[]
): ChatVelocityPoint[] {
  const curKeys = [...eachUtcDayKeyBetween(start, end)];
  const avgSeries = buildSeriesForMetric(
    "averageViewers",
    curKeys,
    rollup,
    start,
    end,
    resolution,
    snapshots
  );
  const bucketMs =
    resolution === "hour"
      ? Math.max(HOUR_MS, (end.getTime() - start.getTime()) / MAX_CHART_POINTS)
      : resolution === "week"
        ? 7 * DAY_MS
        : DAY_MS;

  return avgSeries.map((p) => {
    const hourStart = p.t;
    const hourEnd = p.t + bucketMs;
    const snaps = snapshots.filter(
      (s) => s.timestamp.getTime() >= hourStart && s.timestamp.getTime() < hourEnd
    );
    const mpm = snaps.length
      ? snaps.reduce((s, x) => s + x.messagesPerMinute, 0) / snaps.length
      : Math.max(0, p.v * 0.12);
    return { label: p.label, t: p.t, viewers: p.v, mpm: Math.round(mpm * 10) / 10 };
  });
}

export async function loadAnalyticsPayload(input: {
  userId: string;
  preset: TimePreset;
  pageOffset: number;
  resolution: ChartResolution;
}): Promise<AnalyticsApiPayload> {
  const { start, end, rangeLabel, sublabel } = computeDateWindow(input.preset, input.pageOffset);
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { createdAt: true }
  });
  const registeredAt = user?.createdAt ?? new Date();

  const dateGte = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const dateLte = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));

  const [summaryRows, snapshotRows, csvCount, snapCount] = await Promise.all([
    prisma.channelAnalyticsSummary.findMany({
      where: { userId: input.userId, date: { gte: dateGte, lte: dateLte } }
    }),
    prisma.streamSnapshot.findMany({
      where: {
        userId: input.userId,
        timestamp: { gte: start, lte: end }
      },
      orderBy: { timestamp: "asc" }
    }),
    prisma.channelAnalyticsSummary.count({ where: { userId: input.userId } }),
    prisma.streamSnapshot.count({ where: { userId: input.userId } })
  ]);

  const hasCsvHistory = csvCount > 0;
  const hasLiveSnapshots = snapCount > 0;

  const rollup = new Map<string, DayAgg>();

  for (const row of summaryRows) {
    const key = utcDayKey(row.date);
    rollup.set(key, {
      avgViewers: row.avgViewers,
      maxViewers: row.maxViewers,
      follows: row.follows,
      subs: row.subs,
      revenue: row.revenue,
      minutesStreamed: row.minutesStreamed,
      liveViews: row.liveViews,
      uniqueChatters: row.uniqueChatters,
      clipsCreated: row.clipsCreated,
      hasSummary: true,
      snapshotSamples: 0
    });
  }

  const byDaySnaps = new Map<string, { viewers: number[]; mpm: number[] }>();
  for (const s of snapshotRows) {
    const key = utcDayKey(s.timestamp);
    let g = byDaySnaps.get(key);
    if (!g) {
      g = { viewers: [], mpm: [] };
      byDaySnaps.set(key, g);
    }
    g.viewers.push(s.currentViewers);
    g.mpm.push(s.messagesPerMinute);
  }

  for (const [key, g] of byDaySnaps) {
    const meanV = g.viewers.length ? g.viewers.reduce((a, b) => a + b, 0) / g.viewers.length : 0;
    const maxV = g.viewers.length ? Math.max(...g.viewers) : 0;
    const existing = rollup.get(key) ?? emptyDay();
    if (!existing.hasSummary) {
      rollup.set(key, {
        ...existing,
        avgViewers: meanV,
        maxViewers: maxV,
        hasSummary: false,
        snapshotSamples: g.viewers.length
      });
    } else {
      rollup.set(key, {
        ...existing,
        avgViewers: existing.avgViewers || meanV,
        maxViewers: Math.max(existing.maxViewers, maxV),
        snapshotSamples: g.viewers.length
      });
    }
  }

  const dayKeys = [...eachUtcDayKeyBetween(start, end)];

  const summaries = {} as Record<AnalyticsMetricId, MetricSummary>;
  for (const id of METRIC_ORDER) {
    summaries[id] = buildMetricSummary(
      id,
      dayKeys,
      rollup,
      start,
      end,
      input.resolution,
      snapshotRows
    );
  }

  const velocity = buildVelocity(rollup, start, end, input.resolution, snapshotRows);

  const raids: RaidRetentionRow[] = [];

  return {
    rangeLabel,
    sublabel,
    summaries,
    velocity,
    raids,
    flags: { hasCsvHistory, hasLiveSnapshots },
    hint: null,
    registeredAt: registeredAt.toISOString()
  };
}
