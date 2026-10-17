// SAR ISO Tank SG dashboard — several MongoDB requests in one call (Vercel serverless function).
//
//   POST /api/mongo-batch  { requests: [ { dataset: "sales" }, { collection, pipeline }, ... ] }
//   -> { results: [ { ok: true, data } | { ok: false, error }, ... ] }   (same order, max 10)
//
// Same sign-in and read-only rules as /api/mongo.

import { authenticate, runRequest, parseBody, sendError, HttpError } from "./mongo.js";

const MAX_REQUESTS = 10;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method !== "POST") throw new HttpError(405, "Use POST");
    const user = await authenticate(req);
    const body = parseBody(req);
    const requests = body?.requests;
    if (!Array.isArray(requests) || !requests.length) throw new HttpError(400, "requests must be a non-empty array");
    if (requests.length > MAX_REQUESTS) throw new HttpError(400, `At most ${MAX_REQUESTS} requests per batch`);

    const results = await Promise.all(requests.map(async (r) => {
      try {
        return { ok: true, data: await runRequest(r, user) };
      } catch (e) {
        if (!(e instanceof HttpError)) console.error(e);
        return { ok: false, error: e instanceof HttpError ? e.message : "Server error" };
      }
    }));
    res.status(200).json({ results });
  } catch (e) {
    sendError(res, e);
  }
}
