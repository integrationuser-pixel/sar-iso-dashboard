import "server-only";
import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { Binary } from "mongodb";
import { getDb } from "./mongo";
import { DEFAULT_MAPPINGS, normCharge } from "./charges";
import { CATEGORIES, type Category, type ChargeMapping, type DocType, type SalesLine, type SalesPayload } from "./types";

/** tblInvoice voucher codes that are sales documents (purchase vouchers and proformas excluded). */
const SALES_VOUCHERS: Record<string, DocType> = {
  PSI: "Invoice",   // Principal Sales Invoice
  SLI: "Invoice",   // Sub Lease Invoice
  SDI: "Invoice",   // Sundry Invoice
  MRI: "Invoice",   // M&R Sales Invoice
  DN: "Debit Note", // DEBIT NOTE Agency
  CN: "Credit Note",// Principle Credit Note
};
const SUNDRY = new Set(["SDI"]);

interface InvoiceRow {
  invoiceId: number; invoiceNo?: string; invoiceDate?: Date; voucherCode: string; voucherName?: string;
  lineNo?: number; chargeName?: string; chargeTotalAmountHc?: number; chargeTotalAmountFc?: number;
  currencyCode?: string; billingPartyName?: string; polName?: string; podName?: string;
  blNo?: string; jobNo?: string; companyName?: string; businessSegmentName?: string;
}

const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export async function loadMappings(): Promise<ChargeMapping[]> {
  const db = await getDb();
  const rows = await db.collection("chargeMappings")
    .find({}, { projection: { _id: 0, chargeName: 1, revenueCategory: 1 } }).toArray();
  return rows.length ? (rows as unknown as ChargeMapping[]) : DEFAULT_MAPPINGS;
}

// The Atlas cluster downloads slowly (~100 KB/s), so reading ~1.2 MB of raw invoice
// lines takes ~13 s. The built payload is therefore kept gzipped (~10x smaller) in the
// `dashboardCache` collection and rebuilt only after a new tblInvoice sync or a
// charge-mapping change. A short in-memory cache sits in front of that.
const TTL_MS = 2 * 60 * 1000;
const SNAPSHOT_ID = "sales-v1";
const cache = globalThis as unknown as { _sales?: { at: number; data: Promise<SalesPayload> } };

export function loadSales(): Promise<SalesPayload> {
  if (!cache._sales || Date.now() - cache._sales.at > TTL_MS) {
    const data = loadSnapshot();
    cache._sales = { at: Date.now(), data };
    data.catch(() => { cache._sales = undefined; });
  }
  return cache._sales.data;
}

interface Snapshot { _id: string; key: string; gz: Binary; builtAt: Date }

async function loadSnapshot(): Promise<SalesPayload> {
  const db = await getDb();
  const [mappings, lastSyncDoc] = await Promise.all([
    loadMappings(),
    db.collection("sarfdSyncHistory").findOne(
      { table: "tblInvoice", status: { $in: ["success", "warning"] }, rowsInserted: { $gt: 0 } },
      { sort: { startedAt: -1 }, projection: { startedAt: 1 } },
    ),
  ]);
  const lastSync = lastSyncDoc?.startedAt ? new Date(lastSyncDoc.startedAt).toISOString() : null;
  const mapKey = mappings.map((m) => `${normCharge(m.chargeName)}=${m.revenueCategory}`).sort().join("|");
  const key = createHash("sha1").update(`${lastSync}|${mapKey}`).digest("hex");

  const snaps = db.collection<Snapshot>("dashboardCache");
  const snap = await snaps.findOne({ _id: SNAPSHOT_ID });
  if (snap?.key === key) {
    return JSON.parse(gunzipSync(snap.gz.buffer).toString("utf8")) as SalesPayload;
  }

  const payload = await buildSales(mappings, lastSync);
  const gz = new Binary(gzipSync(Buffer.from(JSON.stringify(payload))));
  await snaps.replaceOne({ _id: SNAPSHOT_ID }, { key, gz, builtAt: new Date() }, { upsert: true });
  return payload;
}

async function buildSales(mappings: ChargeMapping[], lastSync: string | null): Promise<SalesPayload> {
  const db = await getDb();
  const rows = await db.collection<InvoiceRow>("tblInvoice").find(
    { recordType: "C", voucherCode: { $in: Object.keys(SALES_VOUCHERS) } },
    { projection: { _id: 0, invoiceId: 1, invoiceNo: 1, invoiceDate: 1, voucherCode: 1, voucherName: 1,
        lineNo: 1, chargeName: 1, chargeTotalAmountHc: 1, chargeTotalAmountFc: 1, currencyCode: 1,
        billingPartyName: 1, polName: 1, podName: 1, blNo: 1, jobNo: 1, companyName: 1, businessSegmentName: 1 } },
  ).toArray();

  const catOf = new Map<string, Category>();
  for (const m of mappings) {
    const cat = CATEGORIES.includes(m.revenueCategory) ? m.revenueCategory : "Other";
    catOf.set(normCharge(m.chargeName), cat);
  }

  const lines: SalesLine[] = [];
  for (const r of rows) {
    if (!r.invoiceDate) continue;
    const docType = SALES_VOUCHERS[r.voucherCode];
    const sign = docType === "Credit Note" ? -1 : 1;
    const pol = s(r.polName), pod = s(r.podName), blNo = s(r.blNo);
    const charge = normCharge(r.chargeName) || "(NO CHARGE NAME)";
    lines.push({
      id: `${r.invoiceId}-${r.lineNo ?? lines.length}`,
      invoiceId: r.invoiceId,
      invoiceNo: s(r.invoiceNo),
      date: r.invoiceDate.toISOString().slice(0, 10),
      docType,
      voucher: s(r.voucherName),
      charge,
      category: catOf.get(charge) ?? "Other",
      amount: sign * (r.chargeTotalAmountHc ?? 0),
      currency: s(r.currencyCode) || "USD",
      amountFc: r.chargeTotalAmountFc ?? r.chargeTotalAmountHc ?? 0,
      agent: s(r.billingPartyName) || "(Unknown)",
      pol, pod,
      lane: blNo && pol && pod && !SUNDRY.has(r.voucherCode) ? `${pol} → ${pod}` : null,
      blNo,
      jobNo: s(r.jobNo),
      company: s(r.companyName),
      segment: s(r.businessSegmentName),
    });
  }
  lines.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return {
    lines,
    mappings,
    lastSync,
    generatedAt: new Date().toISOString(),
  };
}
