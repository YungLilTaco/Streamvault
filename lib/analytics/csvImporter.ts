import Papa from "papaparse";
import { prisma } from "@/lib/prisma";
import { parseAnalyticsDate } from "@/lib/analytics/parseAnalyticsDate";

function normalizeHeader(h: string): string {
  return h
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[()]/g, "");
}

/** Parse Twitch-style numbers with US or EU thousand/decimal separators. */
export function parseLooseNumber(raw: string | undefined | null): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s || s === "-" || s === "—") return null;
  s = s.replace(/[%\s]/g, "");
  s = s.replace(/[$€£¥]/g, "");
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    if (lastComma > lastDot) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    const parts = s.split(",");
    if (parts.length === 2 && parts[1].length <= 2) s = parts[0].replace(/\./g, "") + "." + parts[1];
    else s = s.replace(/,/g, "");
  } else {
    s = s.replace(/,/g, "");
  }
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function pickColumnIndex(headers: string[], matchers: RegExp[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = normalizeHeader(headers[i] ?? "");
    if (matchers.some((re) => re.test(h))) return i;
  }
  return -1;
}

function prismaUtcDate(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export type TwitchCsvColumnMap = {
  date: number;
  avgViewers: number;
  maxViewers: number;
  follows: number;
  subs: number;
  revenue: number;
  minutesStreamed: number;
  liveViews: number;
  uniqueChatters: number;
  clipsCreated: number;
};

export function detectTwitchAnalyticsColumns(headers: string[]): TwitchCsvColumnMap | null {
  if (!headers.length) return null;
  const date = pickColumnIndex(headers, [/^date$/i, /^day$/i, /stream\s*date/i]);
  if (date < 0) return null;

  return {
    date,
    avgViewers: pickColumnIndex(headers, [/avg.*view/i, /average.*view/i, /^avg$/i, /concurrent.*view/i]),
    maxViewers: pickColumnIndex(headers, [/max.*view/i, /peak.*view/i, /highest.*view/i, /^max$/i]),
    follows: pickColumnIndex(headers, [/new\s*followers?/i, /^followers?$/i, /^(new\s*)?follows?$/i]),
    subs: pickColumnIndex(headers, [/new\s*sub/i, /subscriber/i, /^subs?$/i]),
    revenue: pickColumnIndex(headers, [/revenue/i, /estimated.*earn/i, /income/i, /payout/i]),
    minutesStreamed: pickColumnIndex(headers, [
      /minute.*stream/i,
      /hours?\s*stream/i,
      /stream.*minute/i,
      /stream.*time/i,
      /time.*stream/i,
      /length/i
    ]),
    liveViews: pickColumnIndex(headers, [/live\s*view/i, /total\s*view/i]),
    uniqueChatters: pickColumnIndex(headers, [/unique.*chat/i, /unique.*chatter/i, /unique.*viewer/i]),
    clipsCreated: pickColumnIndex(headers, [/clip/i])
  };
}

function cell(row: string[], idx: number): string {
  if (idx < 0 || idx >= row.length) return "";
  return row[idx] ?? "";
}

function toInt(n: number | null, fallback = 0): number {
  if (n == null || !Number.isFinite(n)) return fallback;
  return Math.round(n);
}

function minutesFromCell(raw: string): number | null {
  const n = parseLooseNumber(raw);
  if (n == null) return null;
  const s = raw.toLowerCase();
  if (/\bh\b|\bhr\b|\bhours?\b/.test(s) && !/minute/.test(s)) {
    return Math.round(n * 60);
  }
  return Math.round(n);
}

/**
 * Parse Twitch Channel Analytics CSV text and upsert `ChannelAnalyticsSummary` rows for `userId`.
 */
export async function importTwitchChannelAnalyticsCsv(
  userId: string,
  csvText: string
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const parsed = Papa.parse<string[]>(csvText, {
    skipEmptyLines: "greedy"
  });

  const rows = parsed.data.filter((r) => r.some((c) => String(c).trim() !== ""));
  if (rows.length < 2) {
    return { imported: 0, skipped: 0, errors: ["CSV has no data rows"] };
  }

  const headerRow = rows[0]!.map((h) => String(h));
  const col = detectTwitchAnalyticsColumns(headerRow);
  if (!col) {
    return {
      imported: 0,
      skipped: 0,
      errors: ["Could not find a Date column — use Twitch's Channel Analytics export"]
    };
  }

  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  const BATCH = 40;
  const dataRows = rows.slice(1);

  for (let i = 0; i < dataRows.length; i += BATCH) {
    const ops: Array<ReturnType<typeof prisma.channelAnalyticsSummary.upsert>> = [];
    for (const row of dataRows.slice(i, i + BATCH)) {
      const dateRaw = cell(row, col.date);
      const parsedDate = parseAnalyticsDate(dateRaw);
      if (!parsedDate) {
        skipped += 1;
        if (errors.length < 15) errors.push(`Bad date "${dateRaw}"`);
        continue;
      }

      const date = prismaUtcDate(parsedDate);

      const avg = col.avgViewers >= 0 ? parseLooseNumber(cell(row, col.avgViewers)) : null;
      const mx = col.maxViewers >= 0 ? parseLooseNumber(cell(row, col.maxViewers)) : null;
      const fl = col.follows >= 0 ? parseLooseNumber(cell(row, col.follows)) : null;
      const sb = col.subs >= 0 ? parseLooseNumber(cell(row, col.subs)) : null;
      const rev = col.revenue >= 0 ? parseLooseNumber(cell(row, col.revenue)) : null;
      const mins =
        col.minutesStreamed >= 0 ? minutesFromCell(cell(row, col.minutesStreamed)) : null;
      const lv = col.liveViews >= 0 ? parseLooseNumber(cell(row, col.liveViews)) : null;
      const uc = col.uniqueChatters >= 0 ? parseLooseNumber(cell(row, col.uniqueChatters)) : null;
      const cl = col.clipsCreated >= 0 ? parseLooseNumber(cell(row, col.clipsCreated)) : null;

      imported += 1;
      ops.push(
        prisma.channelAnalyticsSummary.upsert({
          where: { userId_date: { userId, date } },
          create: {
            userId,
            date,
            avgViewers: avg ?? 0,
            maxViewers: toInt(mx, 0),
            follows: toInt(fl, 0),
            subs: toInt(sb, 0),
            revenue: rev ?? 0,
            minutesStreamed: mins ?? 0,
            liveViews: toInt(lv, 0),
            uniqueChatters: toInt(uc, 0),
            clipsCreated: toInt(cl, 0)
          },
          update: {
            avgViewers: avg ?? 0,
            maxViewers: toInt(mx, 0),
            follows: toInt(fl, 0),
            subs: toInt(sb, 0),
            revenue: rev ?? 0,
            minutesStreamed: mins ?? 0,
            liveViews: toInt(lv, 0),
            uniqueChatters: toInt(uc, 0),
            clipsCreated: toInt(cl, 0)
          }
        })
      );
    }
    if (ops.length) await prisma.$transaction(ops);
  }

  return { imported, skipped, errors };
}
