import { CATEGORIES, type Category, type DocType, type SalesLine } from "./types";
import { bucketKey, bucketRange, type Granularity } from "./period";

/** A drill-down: which lines a clicked number is made of. */
export interface DrillFilter {
  title: string;
  from: string;
  to: string;
  category?: Category;
  agent?: string;
  lane?: string;
  docType?: DocType;
}

export function matches(l: SalesLine, f: DrillFilter) {
  return l.date >= f.from && l.date <= f.to
    && (!f.category || l.category === f.category)
    && (!f.agent || l.agent === f.agent)
    && (!f.lane || l.lane === f.lane)
    && (!f.docType || l.docType === f.docType);
}

export const inRange = (lines: SalesLine[], from: string, to: string) =>
  lines.filter((l) => l.date >= from && l.date <= to);

export function kpis(lines: SalesLine[]) {
  const byCat = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
  let total = 0, credit = 0;
  for (const l of lines) {
    total += l.amount;
    byCat[l.category] += l.amount;
    if (l.docType === "Credit Note") credit += l.amount;
  }
  return { total, byCat, credit, gross: total - credit };
}

export function topBy(lines: SalesLine[], key: (l: SalesLine) => string | null, n = 10) {
  const m = new Map<string, number>();
  for (const l of lines) {
    const k = key(l);
    if (k) m.set(k, (m.get(k) ?? 0) + l.amount);
  }
  return [...m.entries()].map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value).slice(0, n);
}

export function trend(lines: SalesLine[], from: string, to: string, g: Granularity) {
  const buckets = bucketRange(from, to, g);
  const rows = new Map(buckets.map((b) => [b, { key: b, total: 0, ...Object.fromEntries(CATEGORIES.map((c) => [c, 0])) } as Record<string, number | string>]));
  for (const l of lines) {
    const r = rows.get(bucketKey(l.date, g));
    if (!r) continue;
    r.total = (r.total as number) + l.amount;
    r[l.category] = (r[l.category] as number) + l.amount;
  }
  return [...rows.values()] as Array<{ key: string; total: number } & Record<Category, number>>;
}

export interface TrendTableRow { name: string; cells: Record<string, number>; total: number }

export function trendTable(lines: SalesLine[], key: (l: SalesLine) => string | null, from: string, to: string, g: Granularity) {
  const buckets = bucketRange(from, to, g);
  const m = new Map<string, TrendTableRow>();
  for (const l of lines) {
    const k = key(l);
    if (!k) continue;
    let r = m.get(k);
    if (!r) { r = { name: k, cells: {}, total: 0 }; m.set(k, r); }
    const b = bucketKey(l.date, g);
    r.cells[b] = (r.cells[b] ?? 0) + l.amount;
    r.total += l.amount;
  }
  const rows = [...m.values()].sort((a, b) => b.total - a.total);
  const totals: TrendTableRow = { name: "TOTAL", cells: {}, total: 0 };
  for (const r of rows) {
    totals.total += r.total;
    for (const [b, v] of Object.entries(r.cells)) totals.cells[b] = (totals.cells[b] ?? 0) + v;
  }
  return { buckets, rows, totals };
}
