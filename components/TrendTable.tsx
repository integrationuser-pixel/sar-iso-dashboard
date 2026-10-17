"use client";

import { useState } from "react";
import { money, type Money } from "@/lib/format";
import type { TrendTableRow } from "@/lib/sales-calc";

interface Props {
  dimLabel: string;
  buckets: { key: string; label: string }[];
  rows: TrendTableRow[];
  totals: TrendTableRow;
  m: Money;
  onCell: (name: string | null, bucketKey: string | null) => void;
}

const PAGE = 15;

export default function TrendTable({ dimLabel, buckets, rows, totals, m, onCell }: Props) {
  const [q, setQ] = useState("");
  const [all, setAll] = useState(false);
  const filtered = q ? rows.filter((r) => r.name.toLowerCase().includes(q.toLowerCase())) : rows;
  const shown = all ? filtered : filtered.slice(0, PAGE);

  const cell = (v: number | undefined, name: string | null, b: string | null, strong = false) => (
    <td key={b ?? "total"} className={`whitespace-nowrap px-3 py-1.5 text-right tabular-nums ${strong ? "font-semibold" : ""}`}>
      {v ? (
        <button onClick={() => onCell(name, b)} className="hover:text-blue-600 hover:underline">{money(v, m)}</button>
      ) : <span className="text-slate-300">–</span>}
    </td>
  );

  return (
    <div>
      <div className="mb-2 flex items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${dimLabel.toLowerCase()}…`}
          className="h-8 w-64 rounded-md border border-slate-300 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <span className="text-xs text-slate-500">{filtered.length} {dimLabel.toLowerCase()}s</span>
      </div>
      <div className="max-h-[520px] overflow-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="sticky left-0 bg-slate-50 px-3 py-2 text-left">{dimLabel}</th>
              {buckets.map((b) => <th key={b.key} className="whitespace-nowrap px-3 py-2 text-right">{b.label}</th>)}
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {shown.map((r) => (
              <tr key={r.name} className="hover:bg-slate-50">
                <td className="sticky left-0 max-w-72 truncate bg-white px-3 py-1.5" title={r.name}>{r.name}</td>
                {buckets.map((b) => cell(r.cells[b.key], r.name, b.key))}
                {cell(r.total, r.name, null, true)}
              </tr>
            ))}
          </tbody>
          <tfoot className="sticky bottom-0 bg-slate-100 font-semibold text-slate-900">
            <tr>
              <td className="sticky left-0 bg-slate-100 px-3 py-2">TOTAL</td>
              {buckets.map((b) => cell(totals.cells[b.key], null, b.key, true))}
              {cell(totals.total, null, null, true)}
            </tr>
          </tfoot>
        </table>
      </div>
      {filtered.length > PAGE && (
        <button onClick={() => setAll(!all)} className="mt-2 text-sm font-medium text-blue-600 hover:underline">
          {all ? "Show top 15" : `Show all ${filtered.length}`}
        </button>
      )}
    </div>
  );
}
