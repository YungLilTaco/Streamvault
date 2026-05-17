/**
 * Twitch Channel Analytics CSV exports use localized date cells (US vs EU order, dots vs slashes).
 * Parse conservatively and return a calendar day anchored at UTC noon to avoid DST edge shifts.
 */

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11
};

function utcNoon(y: number, m0: number, d: number): Date {
  return new Date(Date.UTC(y, m0, d, 12, 0, 0, 0));
}

function isReasonable(d: Date): boolean {
  const t = d.getTime();
  if (Number.isNaN(t)) return false;
  const y = d.getUTCFullYear();
  return y >= 2010 && y <= 2035;
}

/** Try MDY then DMY when both day and month are ≤12. */
function fromNumericParts(a: number, b: number, y: number): Date | null {
  if (a >= 1 && a <= 12 && b >= 1 && b <= 31) {
    const mdy = utcNoon(y, a - 1, b);
    if (isReasonable(mdy)) return mdy;
  }
  if (b >= 1 && b <= 12 && a >= 1 && a <= 31) {
    const dmy = utcNoon(y, b - 1, a);
    if (isReasonable(dmy)) return dmy;
  }
  return null;
}

function parseNamedMonth(s: string): Date | null {
  const m = s.match(/^(\d{1,2})[\s./-]+([A-Za-z]{3,9})[\s./-]+(\d{4})/);
  if (!m) return null;
  const day = Number.parseInt(m[1], 10);
  const monKey = m[2].slice(0, 3).toLowerCase();
  const month = MONTHS[monKey] ?? MONTHS[m[2].toLowerCase()];
  if (month === undefined || !Number.isFinite(day)) return null;
  const year = Number.parseInt(m[3], 10);
  const d = utcNoon(year, month, day);
  return isReasonable(d) ? d : null;
}

/**
 * Parse a single cell from a Twitch analytics CSV `Date` column.
 */
export function parseAnalyticsDate(raw: string): Date | null {
  const s = raw.replace(/^\uFEFF/, "").trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = utcNoon(
      Number.parseInt(s.slice(0, 4), 10),
      Number.parseInt(s.slice(5, 7), 10) - 1,
      Number.parseInt(s.slice(8, 10), 10)
    );
    return isReasonable(d) ? d : null;
  }

  const named = parseNamedMonth(s);
  if (named) return named;

  const ymd = s.match(/^(\d{4})[\s./-]+(\d{1,2})[\s./-]+(\d{1,2})$/);
  if (ymd) {
    const y = Number.parseInt(ymd[1], 10);
    const mo = Number.parseInt(ymd[2], 10);
    const da = Number.parseInt(ymd[3], 10);
    const d = utcNoon(y, mo - 1, da);
    return isReasonable(d) ? d : null;
  }

  const num = s.match(/^(\d{1,4})[\s./-]+(\d{1,2})[\s./-]+(\d{2,4})$/);
  if (num) {
    let a = Number.parseInt(num[1], 10);
    let b = Number.parseInt(num[2], 10);
    let y = Number.parseInt(num[3], 10);
    if (y < 100) y += y >= 70 ? 1900 : 2000;

    if (a > 12 && b <= 12) {
      const d = utcNoon(y, b - 1, a);
      return isReasonable(d) ? d : null;
    }
    if (b > 12 && a <= 12) {
      const d = utcNoon(y, a - 1, b);
      return isReasonable(d) ? d : null;
    }

    if (a <= 12 && b <= 12) {
      const mdy = utcNoon(y, a - 1, b);
      const dmy = utcNoon(y, b - 1, a);
      const mdyOk = isReasonable(mdy);
      const dmyOk = isReasonable(dmy);
      if (mdyOk && !dmyOk) return mdy;
      if (dmyOk && !mdyOk) return dmy;
      if (mdyOk && dmyOk) {
        const diffM = Math.abs(mdy.getTime() - Date.now());
        const diffD = Math.abs(dmy.getTime() - Date.now());
        return diffM <= diffD ? mdy : dmy;
      }
    }

    return fromNumericParts(a, b, y);
  }

  const t = Date.parse(s);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    return utcNoon(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }

  return null;
}
