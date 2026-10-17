"use client";

import { useEffect, useMemo, useState } from "react";
import type { SalesLine } from "@/lib/types";
import { matches, type DrillFilter } from "@/lib/sales-calc";
import { money, type Money } from "@/lib/format";
import { shortDate } from "@/lib/period";
import { CAT_COLORS } from "./colors";

const PAGE = 200;

export default function DrillModal({ filter, lines, m, onClose }: {
  filter: DrillFilter; lines: SalesLine[]; m: Money; onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rows = useMemo(() => {
    const base = lines.filter((l) => matches(l, filter));
    if (!q) return base;
    const s = q.toLowerCase();
    return base.filter((l) =>
      [l.invoiceNo, l.agent, l.lane ?? "", l.charge, l.blNo, l.jobNo].some((v) => v.toLowerCase().includes(s)));
  }, [lines, filter, q]);
  const total = rows.reduce((s, l) => s + l.amount, 0);
  const invoices = new Set(rows.map((l) => l.invoiceId)).size;

  const csv = () => {
    const head = ["Invoice Date", "Invoice No", "Type", "Agent", "Trade Lane", "Charge", "Category", "BL No", "Job No", "Amount USD"];
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const body = rows.map((l) => [l.date, l.invoiceNo, l.docType, l.agent, l.lane ?? "", l.charge, l.category, l.blNo, l.jobNo, l.amount.toFixed(2)].map(esc).join(","));
    const url = URL.createObjectURL(new Blob([[head.join(","), ...body].join("\n")], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${filter.title.replace(/[^\w]+/g, "_")}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={filter.title}
        className="flex max-h-[90vh] w-full max-w-7xl flex-col rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 p-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{filter.title}</h3>
            <p className="text-xs text-slate-500">
              {shortDate(filter.from)} – {shortDate(filter.to)} · {invoices} documents · {rows.length} charge lines · Net {money(total, m)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search invoice, agent, BL…"
              className="h-8 w-60 rounded-md border border-slate-300 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={csv} className="h-8 rounded-md border border-slate-300 px-3 text-sm hover:bg-slate-50">Export CSV</button>
            <button onClick={onClose} aria-label="Close" className="h-8 w-8 rounded-md text-xl leading-none text-slate-500 hover:bg-slate-100">×</button>
          </div>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {["Date", "Invoice No", "Type", "Agent", "Trade Lane", "Charge", "Category", "BL No"].map((h) =>
                  <th key={h} className="whitespace-nowrap px-3 py-2 text-left">{h}</th>)}
                <th className="px-3 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {rows.slice(0, limit).map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-3 py-1.5">{shortDate(l.date)}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs">{l.invoiceNo}</td>
                  <td className="whitespace-nowrap px-3 py-1.5">
                    <span className={`rounded px-1.5 py-0.5 text-xs ${l.docType === "Credit Note" ? "bg-red-50 text-red-700" : l.docType === "Debit Note" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-700"}`}>{l.docType}</span>
                  </td>
                  <td className="max-w-64 truncate px-3 py-1.5" title={l.agent}>{l.agent}</td>
                  <td className="whitespace-nowrap px-3 py-1.5">{l.lane ?? <span className="text-slate-400">—</span>}</td>
                  <td className="max-w-56 truncate px-3 py-1.5" title={l.charge}>{l.charge}</td>
                  <td className="whitespace-nowrap px-3 py-1.5">
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: CAT_COLORS[l.category] }} />{l.category}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs">{l.blNo || <span className="text-slate-400">—</span>}</td>
                  <td className={`whitespace-nowrap px-3 py-1.5 text-right tabular-nums ${l.amount < 0 ? "text-red-600" : ""}`}>{money(l.amount, m)}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-400">No matching lines</td></tr>}
            </tbody>
          </table>
          {rows.length > limit && (
            <div className="p-3 text-center">
              <button onClick={() => setLimit(limit + PAGE)} className="text-sm font-medium text-blue-600 hover:underline">
                Show more ({rows.length - limit} left)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
