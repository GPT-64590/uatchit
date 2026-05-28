import "server-only";
import { createHash, randomInt } from "node:crypto";
import { env } from "./env";

// A 6-digit panel sign-in code lives alongside the strong magic-link token.
// Short TTL because 6 digits is low entropy — the verify route is also rate-limited.
export const CODE_TTL_MS = 15 * 60 * 1000;

export function generateCode(): string {
  return String(randomInt(100000, 1000000)); // 100000–999999, CSPRNG
}

// Stored/compared as SHA-256(code + AUTH_SECRET). This is OUR scheme for the
// code row — independent of Auth.js's link-token hashing — so insert (auth.ts)
// and verify (verify-otp route) just have to agree with each other.
export function hashCode(code: string): string {
  return createHash("sha256").update(`${code}${env.AUTH_SECRET}`).digest("hex");
}
