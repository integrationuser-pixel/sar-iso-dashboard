export type Currency = "USD" | "INR";

export interface Money { currency: Currency; rate: number }

const conv = (usd: number, m: Money) => (m.currency === "INR" ? usd * m.rate : usd);
const sym = (m: Money) => (m.currency === "INR" ? "₹" : "$");

/** Full amount, no decimals: $1,234,567 / ₹10,86,41,896 */
export function money(usd: number, m: Money) {
  const v = conv(usd, m);
  const locale = m.currency === "INR" ? "en-IN" : "en-US";
  const s = Math.abs(v).toLocaleString(locale, { maximumFractionDigits: 0 });
  return `${v < 0 ? "−" : ""}${sym(m)}${s}`;
}

/** Short amount for cards and chart labels: $1.24M / ₹10.9Cr */
export function moneyShort(usd: number, m: Money) {
  const v = conv(usd, m);
  const a = Math.abs(v);
  const neg = v < 0 ? "−" : "";
  let s: string;
  if (m.currency === "INR") {
    s = a >= 1e7 ? `${(a / 1e7).toFixed(2)}Cr` : a >= 1e5 ? `${(a / 1e5).toFixed(2)}L` : a >= 1e3 ? `${(a / 1e3).toFixed(1)}K` : a.toFixed(0);
  } else {
    s = a >= 1e6 ? `${(a / 1e6).toFixed(2)}M` : a >= 1e3 ? `${(a / 1e3).toFixed(1)}K` : a.toFixed(0);
  }
  return `${neg}${sym(m)}${s}`;
}
