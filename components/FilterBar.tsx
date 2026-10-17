"use client";

import type { PeriodOption, ViewType } from "@/lib/period";
import type { Currency } from "@/lib/format";

const VIEWS: { id: ViewType; label: string }[] = [
  { id: "monthly", label: "Monthly" },
  { id: "weekly", label: "Weekly" },
  { id: "quarterly", label: "Quarterly" },
  { id: "yearly", label: "Yearly" },
  { id: "custom", label: "Custom Range" },
];

interface Props {
  view: ViewType;
  onView: (v: ViewType) => void;
  options: PeriodOption[];
  periodKey: string;
  onPeriod: (key: string) => void;
  from: string;
  to: string;
  onRange: (from: string, to: string) => void;
  currency: Currency;
  onCurrency: (c: Currency) => void;
  rate: number;
  onRate: (r: number) => void;
}

const field = "h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500";

export default function FilterBar(p: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Report view">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            role="tab"
            aria-selected={p.view === v.id}
            onClick={() => p.onView(v.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              p.view === v.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {p.view === "custom" ? (
        <>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            From
            <input type="date" className={field} value={p.from} max={p.to}
              onChange={(e) => e.target.value && p.onRange(e.target.value, p.to)} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            To
            <input type="date" className={field} value={p.to} min={p.from}
              onChange={(e) => e.target.value && p.onRange(p.from, e.target.value)} />
          </label>
        </>
      ) : (
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
          Period
          <select className={`${field} min-w-44`} value={p.periodKey} onChange={(e) => p.onPeriod(e.target.value)}>
            {p.options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </label>
      )}

      <div className="ml-auto flex items-end gap-3">
        <div className="flex rounded-lg bg-slate-100 p-1" aria-label="Currency">
          {(["USD", "INR"] as Currency[]).map((c) => (
            <button key={c} onClick={() => p.onCurrency(c)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${p.currency === c ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}>
              {c}
            </button>
          ))}
        </div>
        {p.currency === "INR" && (
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            1 USD = ₹
            <input type="number" min={1} step={0.01} className={`${field} w-24`} value={p.rate}
              onChange={(e) => { const r = parseFloat(e.target.value); if (r > 0) p.onRate(r); }} />
          </label>
        )}
      </div>
    </div>
  );
}
