"use client";

import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { CATEGORIES, type Category } from "@/lib/types";
import { money, moneyShort, type Money } from "@/lib/format";
import { CAT_COLORS, BAR_COLOR } from "./colors";

export function Panel({ title, subtitle, children, className = "" }: {
  title: string; subtitle?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

const Empty = () => <div className="flex h-64 items-center justify-center text-sm text-slate-400">No data in this period</div>;
const trunc = (s: string, n = 28) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function HBarChart({ data, m, onClick }: {
  data: { name: string; value: number }[]; m: Money; onClick: (name: string) => void;
}) {
  if (!data.length) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 56, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="#e2e8f0" />
        <XAxis type="number" tickFormatter={(v) => moneyShort(v, m)} tick={{ fontSize: 11, fill: "#64748b" }} />
        <YAxis type="category" dataKey="name" width={230} tickFormatter={(v) => trunc(v, 34)} tick={{ fontSize: 11, fill: "#334155" }} />
        <Tooltip formatter={(v: number) => money(v, m)} cursor={{ fill: "#f1f5f9" }} />
        <Bar dataKey="value" name="Net revenue" fill={BAR_COLOR} radius={[0, 4, 4, 0]} cursor="pointer"
          label={{ position: "right", fontSize: 11, fill: "#334155", formatter: (v: number) => moneyShort(v, m) }}
          onClick={(d: { name?: string }) => d.name && onClick(d.name)} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MixDonut({ byCat, m, onClick }: {
  byCat: Record<Category, number>; m: Money; onClick: (c: Category) => void;
}) {
  const data = CATEGORIES.map((c) => ({ name: c, value: byCat[c] })).filter((d) => d.value > 0);
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!data.length) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={1}
          cursor="pointer" onClick={(d: { name?: string }) => d.name && onClick(d.name as Category)}>
          {data.map((d) => <Cell key={d.name} fill={CAT_COLORS[d.name as Category]} />)}
        </Pie>
        <Tooltip formatter={(v: number) => `${money(v, m)} (${((v / total) * 100).toFixed(1)}%)`} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function TrendChart({ data, m, onClick }: {
  data: Array<{ label: string; key: string; total: number } & Record<Category, number>>;
  m: Money; onClick: (bucketKey: string) => void;
}) {
  if (!data.length) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ left: 8, right: 16, top: 8, bottom: 4 }}
        onClick={(e) => { const k = (e?.activePayload?.[0]?.payload as { key?: string } | undefined)?.key; if (k) onClick(k); }}>
        <CartesianGrid stroke="#e2e8f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} />
        <YAxis tickFormatter={(v) => moneyShort(v, m)} tick={{ fontSize: 11, fill: "#64748b" }} width={70} />
        <Tooltip formatter={(v: number) => money(v, m)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="total" name="Total" stroke="#0f172a" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5, cursor: "pointer" }} />
        {CATEGORIES.map((c) => (
          <Line key={c} type="monotone" dataKey={c} stroke={CAT_COLORS[c]} strokeWidth={1.5} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
