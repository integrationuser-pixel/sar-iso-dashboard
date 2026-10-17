// Date helpers on "YYYY-MM-DD" strings, computed in UTC so no timezone drift.

export type ViewType = "monthly" | "weekly" | "quarterly" | "yearly" | "custom";
export type Granularity = "day" | "week" | "month";

export interface PeriodOption { key: string; label: string; from: string; to: string }

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const toDate = (s: string) => new Date(`${s}T00:00:00Z`);
export const fmtISO = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => { const d = toDate(s); d.setUTCDate(d.getUTCDate() + n); return fmtISO(d); };
const lastOfMonth = (y: number, m: number) => fmtISO(new Date(Date.UTC(y, m + 1, 0)));
const yy = (y: number) => String(y).slice(2);

export function mondayOf(s: string) {
  const d = toDate(s);
  const dow = (d.getUTCDay() + 6) % 7; // Mon=0
  return addDays(s, -dow);
}

export function todayISO() { return fmtISO(new Date()); }

export function trailing12Months(today = todayISO()): { from: string; to: string } {
  const d = toDate(today);
  const from = fmtISO(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 11, 1)));
  return { from, to: today };
}

export function shortDate(s: string) {
  const d = toDate(s);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${yy(d.getUTCFullYear())}`;
}

/** Dropdown options for a view, built only from periods that have data (newest first). */
export function periodOptions(view: ViewType, dates: string[]): PeriodOption[] {
  const map = new Map<string, PeriodOption>();
  for (const s of dates) {
    const d = toDate(s);
    const y = d.getUTCFullYear(), m = d.getUTCMonth();
    let o: PeriodOption;
    if (view === "monthly") {
      o = { key: `${y}-${m}`, label: `${MONTHS[m]} ${yy(y)}`, from: fmtISO(new Date(Date.UTC(y, m, 1))), to: lastOfMonth(y, m) };
    } else if (view === "weekly") {
      const from = mondayOf(s), to = addDays(from, 6);
      o = { key: from, label: `Week of ${shortDate(from)} – ${shortDate(to)}`, from, to };
    } else if (view === "quarterly") {
      const q = Math.floor(m / 3);
      o = { key: `${y}-Q${q}`, label: `Q${q + 1} ${yy(y)}`, from: fmtISO(new Date(Date.UTC(y, q * 3, 1))), to: lastOfMonth(y, q * 3 + 2) };
    } else if (view === "yearly") {
      o = { key: String(y), label: String(y), from: `${y}-01-01`, to: `${y}-12-31` };
    } else continue;
    if (!map.has(o.key)) map.set(o.key, o);
  }
  return [...map.values()].sort((a, b) => (a.from < b.from ? 1 : -1));
}

export function granularityFor(view: ViewType, from: string, to: string): Granularity {
  if (view === "weekly") return "day";
  if (view === "monthly") return "week";
  if (view === "quarterly" || view === "yearly") return "month";
  const days = (toDate(to).getTime() - toDate(from).getTime()) / 86_400_000;
  return days > 62 ? "month" : days > 14 ? "week" : "day";
}

export function bucketKey(s: string, g: Granularity) {
  if (g === "day") return s;
  if (g === "week") return mondayOf(s);
  return `${s.slice(0, 7)}-01`;
}

export function bucketLabel(key: string, g: Granularity) {
  const d = toDate(key);
  if (g === "month") return `${MONTHS[d.getUTCMonth()]} ${yy(d.getUTCFullYear())}`;
  if (g === "week") return `Wk ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** Every bucket between from and to, so the trend shows gaps as zero. */
export function bucketRange(from: string, to: string, g: Granularity): string[] {
  const out: string[] = [];
  let k = bucketKey(from, g);
  while (k <= to) {
    out.push(k);
    if (g === "day") k = addDays(k, 1);
    else if (g === "week") k = addDays(k, 7);
    else { const d = toDate(k); k = fmtISO(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))); }
    if (out.length > 400) break;
  }
  return out;
}

export function bucketEnd(key: string, g: Granularity) {
  if (g === "day") return key;
  if (g === "week") return addDays(key, 6);
  const d = toDate(key);
  return lastOfMonth(d.getUTCFullYear(), d.getUTCMonth());
}
