import { MongoClient, Db } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "sar_iso_dashboard";

// Reuse one client across hot reloads (dev) and warm serverless invocations (Vercel).
const g = globalThis as unknown as { _mongo?: Promise<MongoClient> };

export async function getDb(): Promise<Db> {
  if (!uri) throw new Error("MONGODB_URI is not set");
  if (!g._mongo) {
    g._mongo = new MongoClient(uri, { serverSelectionTimeoutMS: 8000, maxPoolSize: 5 }).connect();
    g._mongo.catch(() => { g._mongo = undefined; });
  }
  return (await g._mongo).db(dbName);
}
