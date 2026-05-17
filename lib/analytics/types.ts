/**
 * Shared analytics types + URL param validators + date-window helpers for Channel Analytics.
 */

export type TimePreset = "1w" | "1m" | "3m" | "6m" | "1y";

export type ChartResolution = "hour" | "day" | "week";

export type AnalyticsMetricId =
  | "averageViewers"
  | "maxViewers"
  | "newFollowers"
  | "newSubscribers"
  | "estimatedRevenue"
  | "streamLength"
  | "liveViews"
  | "uniqueChatters"
  | "clipsCreated";

export type AnalyticsPoint = {
  label: string;
  t: number;
  v: number;
};

export type MetricSummary = {
  id: AnalyticsMetricId;
  label: string;
  value: number;
  prevValue: number;
  trendPct: number;
  series: AnalyticsPoint[];
};

export type RaidRetentionRow = {
  id: string;
  incomingChannel: string;
  raidSize: number;
  retention15mPct: number;
  at: number;
};

export type ChatVelocityPoint = {
  label: string;
  t: number;
  viewers: number;
  mpm: number;
};

const DAY_MS = 86_400_000;

export const PRESET_DAYS: Record<TimePreset, number> = {
  "1w": 7,
  "1m": 30,
  "3m": 90,
  "6m": 180,
  "1y": 365
};

export const METRIC_LABELS: Record<AnalyticsMetricId, string> = {
  averageViewers: "Average Viewers",
  maxViewers: "Max (Peak) Viewers",
  newFollowers: "New Followers",
  newSubscribers: "New Subscribers",
  estimatedRevenue: "Estimated Revenue",
  streamLength: "Stream Length",
  liveViews: "Live Views",
  uniqueChatters: "Unique Chatters",
  clipsCreated: "Clips Created"
};

export const METRIC_ORDER: AnalyticsMetricId[] = [
  "averageViewers",
  "maxViewers",
  "newFollowers",
  "newSubscribers",
  "estimatedRevenue",
  "streamLength",
  "liveViews",
  "uniqueChatters",
  "clipsCreated"
];

export function computeDateWindow(
  preset: TimePreset,
  pageOffset: number
): { start: Date; end: Date; totalDays: number; rangeLabel: string; sublabel: string } {
  const totalDays = PRESET_DAYS[preset];
  const windowMs = totalDays * DAY_MS;
  const now = Date.now();
  const alignedEnd = Math.floor(now / DAY_MS) * DAY_MS + DAY_MS - 1;
  const endMs = alignedEnd - pageOffset * windowMs;
  const startMs = endMs - windowMs + 1;
  const start = new Date(startMs);
  const end = new Date(endMs);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const rangeLabel = `${fmt(start)} – ${fmt(end)}`;
  const sublabel = `${totalDays} day${totalDays === 1 ? "" : "s"}`;
  return { start, end, totalDays, rangeLabel, sublabel };
}

export function isValidPreset(v: string | null): v is TimePreset {
  return v === "1w" || v === "1m" || v === "3m" || v === "6m" || v === "1y";
}

export function isValidMetric(v: string | null): v is AnalyticsMetricId {
  return v !== null && (METRIC_ORDER as string[]).includes(v);
}

export function isValidResolution(v: string | null): v is ChartResolution {
  return v === "hour" || v === "day" || v === "week";
}

export type AnalyticsApiPayload = {
  rangeLabel: string;
  sublabel: string;
  summaries: Record<AnalyticsMetricId, MetricSummary>;
  velocity: ChatVelocityPoint[];
  raids: RaidRetentionRow[];
  flags: {
    hasCsvHistory: boolean;
    hasLiveSnapshots: boolean;
  };
  hint: string | null;
  registeredAt: string;
};
