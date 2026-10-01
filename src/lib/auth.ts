import "server-only";
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { db } from "@/lib/db";

const scrypt = promisify(scryptCallback);
export const SESSION_COOKIE = "dsayur_session";
const SESSION_DAYS = 14;

export type AppUser = { id: number; username: string; email: string; name: string; role: "customer" | "admin"; phone: string };

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function hashSession(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, saltHex, hashHex] = stored.split("$");
  if (algorithm !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = (await scrypt(password, Buffer.from(saltHex, "hex"), expected.length)) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function createSession(customerId: number) {
  const token = randomBytes(32).toString("base64url");
  await db.query(
    "INSERT INTO customer_sessions (token_hash, customer_id, expires_at) VALUES ($1, $2, now() + ($3 * interval '1 day'))",
    [hashSession(token), customerId, SESSION_DAYS],
  );
  return token;
}

export async function getSessionUser(token?: string | null): Promise<AppUser | null> {
  if (!token) return null;
  const result = await db.query<AppUser>(
    `SELECT c.id, COALESCE(c.username, '') AS username, c.email, c.name, c.role, c.phone
     FROM customer_sessions s JOIN customers c ON c.id = s.customer_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashSession(token)],
  );
  return result.rows[0] ?? null;
}

export async function deleteSession(token?: string | null) {
  if (token) await db.query("DELETE FROM customer_sessions WHERE token_hash = $1", [hashSession(token)]);
}

export function toCustomer(user: AppUser) {
  return { id: user.id, name: user.name, email: user.email, phone: user.phone };
}
