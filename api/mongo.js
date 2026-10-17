// SAR ISO Tank SG dashboard — MongoDB API (Vercel serverless function).
//
//   GET  /api/mongo?config=1              -> { googleClientId }            (public)
//   POST /api/mongo  { dataset: "sales" } -> sales lines for the dashboard (signed in)
//   POST /api/mongo  { dataset: "me" }    -> { email, name, role }        (signed in)
//   POST /api/mongo  { collection, pipeline } -> read-only aggregate      (signed in)
//
// Every POST needs "Authorization: Bearer <Google ID token>" from Google sign-in.
// Environment: MONGODB_URI, MONGODB_DB, ADMIN_EMAILS, ALLOWED_DOMAINS (GOOGLE_CLIENT_ID optional).

import { MongoClient, Binary } from "mongodb";
import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";

const DB_NAME = process.env.MONGODB_DB || "sar_iso_dashboard";
// Google OAuth Web client (project "sar-iso-dashboard"). Not a secret; GOOGLE_CLIENT_ID overrides it.
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "416635306158-uekjjb4k7barhpr7k8s774r9hskmt9an.apps.googleusercontent.com";

// ---------------------------------------------------------------- database

const g = globalThis;
export async function getDb() {
  if (!process.env.MONGODB_URI) throw new HttpError(500, "MONGODB_URI is not set");
  if (!g._sarMongo) {
    g._sarMongo = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000, maxPoolSize: 5 }).connect();
    g._sarMongo.catch(() => { g._sarMongo = undefined; });
  }
  return (await g._sarMongo).db(DB_NAME);
}

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// ---------------------------------------------------------------- sign-in

const list = (v) => (v || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

/** admin: ADMIN_EMAILS or dashboardUsers role "admin"; viewer: dashboardUsers or ALLOWED_DOMAINS. */
async function roleFor(email) {
  const e = email.toLowerCase();
  if (list(process.env.ADMIN_EMAILS).includes(e)) return "admin";
  const db = await getDb();
  const user = await db.collection("dashboardUsers").findOne({ email: e, disabled: { $ne: true } }, { projection: { role: 1 } });
  if (user) return user.role === "admin" ? "admin" : "viewer";
  if (list(process.env.ALLOWED_DOMAINS).includes(e.split("@")[1])) return "viewer";
  return null;
}

const tokenCache = new Map(); // idToken -> { user, exp }

async function verifyGoogleToken(idToken) {
  const hit = tokenCache.get(idToken);
  if (hit && hit.exp > Date.now()) return hit.user;

  const clientId = GOOGLE_CLIENT_ID;
  const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!r.ok) throw new HttpError(401, "Sign-in expired. Please sign in again.");
  const t = await r.json();
  const expMs = Number(t.exp) * 1000;
  if (t.aud !== clientId || !["accounts.google.com", "https://accounts.google.com"].includes(t.iss)
      || String(t.email_verified) !== "true" || !(expMs > Date.now())) {
    throw new HttpError(401, "Sign-in expired. Please sign in again.");
  }
  const user = { email: t.email.toLowerCase(), name: t.name || t.email };
  if (tokenCache.size > 500) tokenCache.clear();
  tokenCache.set(idToken, { user, exp: expMs });
  return user;
}

/** Returns { email, name, role } or throws 401/403. */
export async function authenticate(req) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) throw new HttpError(401, "Not signed in");
  const user = await verifyGoogleToken(h.slice(7));
  const role = await roleFor(user.email);
  if (!role) throw new HttpError(403, `${user.email} does not have access to this dashboard`);
  return { ...user, role };
}

// ---------------------------------------------------------------- read-only queries

const READABLE = new Set([
  "tblBL", "tblCompany", "tblContainerMovement", "tblContainerRepair", "tblContainerTransaction",
  "tblInvoice", "tblJob", "tblRateRequest", "tblVoucher", "chargeMappings", "sarfdSyncHistory",
]);
const FORBIDDEN = new Set(["$out", "$merge", "$function", "$accumulator", "$where", "$currentOp",
  "$listSessions", "$listLocalSessions", "$planCacheStats", "$collStats", "$indexStats"]);
const MAX_DOCS = 20000;

function checkPipeline(node) {
  if (Array.isArray(node)) return node.forEach(checkPipeline);
  if (!node || typeof node !== "object") return;
  for (const [k, v] of Object.entries(node)) {
    if (FORBIDDEN.has(k)) throw new HttpError(400, `${k} is not allowed`);
    if (k === "$lookup" || k === "$graphLookup") {
      if (!READABLE.has(v?.from)) throw new HttpError(400, `Cannot read collection ${v?.from}`);
    }
    if (k === "$unionWith") {
      const coll = typeof v === "string" ? v : v?.coll;
      if (!READABLE.has(coll)) throw new HttpError(400, `Cannot read collection ${coll}`);
    }
    checkPipeline(v);
  }
}

async function aggregate(collection, pipeline = []) {
  if (!READABLE.has(collection)) throw new HttpError(400, `Unknown collection ${collection}`);
  if (!Array.isArray(pipeline)) throw new HttpError(400, "pipeline must be an array");
  checkPipeline(pipeline);
  const db = await getDb();
  const docs = await db.collection(collection)
    .aggregate([...pipeline, { $limit: MAX_DOCS + 1 }], { maxTimeMS: 20000 }).toArray();
  return { docs: docs.slice(0, MAX_DOCS), truncated: docs.length > MAX_DOCS };
}

// ---------------------------------------------------------------- sales dataset

// tblInvoice voucher codes that are sales documents (purchase vouchers and proformas excluded).
const SALES_VOUCHERS = { PSI: "Invoice", SLI: "Invoice", SDI: "Invoice", MRI: "Invoice", DN: "Debit Note", CN: "Credit Note" };
const SUNDRY = new Set(["SDI"]);
const CATEGORIES = ["Lease", "Detention", "EXIM", "M&R", "Other"];
const s = (v) => (typeof v === "string" ? v.trim() : "");
const normCharge = (v) => s(v).toUpperCase();

async function buildSales(db, mappings, lastSync) {
  const catOf = new Map(mappings.map((m) => [normCharge(m.chargeName), CATEGORIES.includes(m.revenueCategory) ? m.revenueCategory : "Other"]));
  const rows = await db.collection("tblInvoice").find(
    { recordType: "C", voucherCode: { $in: Object.keys(SALES_VOUCHERS) } },
    { projection: { _id: 0, invoiceId: 1, invoiceNo: 1, invoiceDate: 1, voucherCode: 1, lineNo: 1, chargeName: 1,
        chargeTotalAmountHc: 1, billingPartyName: 1, polName: 1, podName: 1, blNo: 1, jobNo: 1 } },
  ).toArray();

  const lines = [];
  for (const r of rows) {
    if (!r.invoiceDate) continue;
    const docType = SALES_VOUCHERS[r.voucherCode];
    const pol = s(r.polName), pod = s(r.podName), blNo = s(r.blNo);
    const charge = normCharge(r.chargeName) || "(NO CHARGE NAME)";
    lines.push({
      id: `${r.invoiceId}-${r.lineNo ?? lines.length}`,
      invoiceId: r.invoiceId,
      invoiceNo: s(r.invoiceNo),
      date: new Date(r.invoiceDate).toISOString().slice(0, 10),
      docType,
      charge,
      category: catOf.get(charge) ?? "Other",
      amount: (docType === "Credit Note" ? -1 : 1) * (r.chargeTotalAmountHc ?? 0),  // USD, credit notes negative
      agent: s(r.billingPartyName) || "(Unknown)",
      lane: blNo && pol && pod && !SUNDRY.has(r.voucherCode) ? `${pol} → ${pod}` : null,
      blNo,
      jobNo: s(r.jobNo),
    });
  }
  lines.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return { lines, lastSync, generatedAt: new Date().toISOString() };
}

// The Atlas cluster downloads slowly (~100 KB/s), so the built dataset is kept gzipped in
// `dashboardCache` and rebuilt only after a new tblInvoice sync or a charge-mapping change.
const TTL_MS = 2 * 60 * 1000;
const SNAPSHOT_ID = "sales-html-v1";

async function salesDataset() {
  if (g._sarSales && Date.now() - g._sarSales.at < TTL_MS) return g._sarSales.data;
  const data = (async () => {
    const db = await getDb();
    const [mappings, last] = await Promise.all([
      db.collection("chargeMappings").find({}, { projection: { _id: 0, chargeName: 1, revenueCategory: 1 } }).toArray(),
      db.collection("sarfdSyncHistory").findOne(
        { table: "tblInvoice", status: { $in: ["success", "warning"] }, rowsInserted: { $gt: 0 } },
        { sort: { startedAt: -1 }, projection: { startedAt: 1 } }),
    ]);
    const lastSync = last?.startedAt ? new Date(last.startedAt).toISOString() : null;
    const mapKey = mappings.map((m) => `${normCharge(m.chargeName)}=${m.revenueCategory}`).sort().join("|");
    const key = createHash("sha1").update(`${lastSync}|${mapKey}`).digest("hex");

    const cache = db.collection("dashboardCache");
    const snap = await cache.findOne({ _id: SNAPSHOT_ID });
    if (snap?.key === key) return JSON.parse(gunzipSync(snap.gz.buffer).toString("utf8"));

    const payload = await buildSales(db, mappings, lastSync);
    const gz = new Binary(gzipSync(Buffer.from(JSON.stringify(payload))));
    await cache.replaceOne({ _id: SNAPSHOT_ID }, { key, gz, builtAt: new Date() }, { upsert: true });
    return payload;
  })();
  g._sarSales = { at: Date.now(), data };
  data.catch(() => { g._sarSales = undefined; });
  return data;
}

// ---------------------------------------------------------------- request handling

/** Runs one request ({ dataset } or { collection, pipeline }) for a signed-in user. */
export async function runRequest(body, user) {
  if (!body || typeof body !== "object") throw new HttpError(400, "Request body must be JSON");
  if (body.dataset === "sales") return salesDataset();
  if (body.dataset === "me") return user;
  if (body.dataset) throw new HttpError(400, `Unknown dataset ${body.dataset}`);
  return aggregate(body.collection, body.pipeline);
}

export function parseBody(req) {
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { throw new HttpError(400, "Invalid JSON"); } }
  return req.body;
}

export function sendError(res, e) {
  const status = e instanceof HttpError ? e.status : 500;
  if (status === 500) console.error(e);
  res.status(status).json({ error: status === 500 && !(e instanceof HttpError) ? "Server error" : e.message });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET" && req.query?.config !== undefined) {
      return res.status(200).json({ googleClientId: GOOGLE_CLIENT_ID });
    }
    if (req.method !== "POST") throw new HttpError(405, "Use POST");
    const user = await authenticate(req);
    res.status(200).json(await runRequest(parseBody(req), user));
  } catch (e) {
    sendError(res, e);
  }
}
