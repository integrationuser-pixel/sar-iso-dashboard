"use client";

import type { Category } from "@/lib/types";
import { CAT_COLORS } from "./colors";
import { money, moneyShort, type Money } from "@/lib/format";

interface Props {
  total: number;
  gross: number;
  credit: number;
  byCat: Record<Category, number>;
  m: Money;
  onDrill: (category?: Category) => void;
}

const CARDS: Array<{ label: string; cat?: Category }> = [
  { label: "Total Revenue" },
  { label: "Lease Revenue", cat: "Lease" },
  { label: "Detention Revenue", cat: "Detention" },
  { label: "EXIM Revenue", cat: "EXIM" },
  { label: "M&R Revenue", cat: "M&R" },
];

export default function KpiCards({ total, gross, credit, byCat, m, onDrill }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {CARDS.map((c) => {
        const v = c.cat ? byCat[c.cat] : total;
        return (
          <button
            key={c.label}
            onClick={() => onDrill(c.cat)}
            title={money(v, m)}
            className="group rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-400 hover:shadow"
          >
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.cat ? CAT_COLORS[c.cat] : "#0f172a" }} />
              {c.label}
            </div>
            <div className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{moneyShort(v, m)}</div>
            <div className="mt-1 text-xs text-slate-500">
              {c.cat ? "net of credit notes" : `Gross ${moneyShort(gross, m)} · CN ${moneyShort(credit, m)}`}
            </div>
          </button>
        );
      })}
    </div>
  );
}
