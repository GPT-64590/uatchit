import "server-only";
import crypto from "node:crypto";
import { env } from "@/lib/env";

/**
 * Stateless, HMAC-signed tokens for one-click email actions (unsubscribe, pause).
 * No DB token table needed — the signature (keyed by AUTH_SECRET) is the auth, so
 * an unauthenticated recipient can act from their inbox without a login bounce.
 * Tokens don't expire: unsubscribe links must work indefinitely, and a pause
 * token is scoped to the user's own watch and only performs a reversible action.
 */
export type EmailAction = "unsubscribe" | "pause";

interface TokenPayload {
  u: string; // userId
  w?: string; // watchId (for pause)
  a: EmailAction;
}

export function signEmailToken(payload: TokenPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", env.AUTH_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyEmailToken(token: string | null | undefined): TokenPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", env.AUTH_SECRET).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as TokenPayload;
    if (!p || typeof p.u !== "string" || (p.a !== "unsubscribe" && p.a !== "pause")) return null;
    return p;
  } catch {
    return null;
  }
}
