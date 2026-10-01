import "server-only";
import pg from "pg";

const { Pool } = pg;
const globalForPg = globalThis as typeof globalThis & { dSayurPool?: InstanceType<typeof Pool> };

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for the D-Sayur app database.");

export const db = globalForPg.dSayurPool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

if (process.env.NODE_ENV !== "production") globalForPg.dSayurPool = db;
