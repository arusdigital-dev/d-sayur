import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { scryptSync, randomBytes } from "node:crypto";
import nextEnv from "@next/env";
import pg from "pg";

nextEnv.loadEnvConfig(process.cwd());
const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("Set DATABASE_URL in .env.local first.");

const pool = new Pool({ connectionString, max: 2 });
try {
  const sql = await readFile(join(process.cwd(), "db", "migrations", "001_storefront.sql"), "utf8");
  await pool.query(sql);

  const username = "admin";
  const email = "admin@example.com";
  const password = process.env.INITIAL_ADMIN_PASSWORD || "admin";
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  const passwordHash = `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
  await pool.query(
    `INSERT INTO customers (username, email, password_hash, name, role)
     VALUES ($1, $2, $3, 'Administrator', 'admin')
     ON CONFLICT (username) DO NOTHING`,
    [username, email, passwordHash],
  );
  console.log("Database schema ready. Initial local admin: username admin.");
} finally {
  await pool.end();
}
