import "server-only";
import { db } from "@/db";
import { mcpTokens } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function authenticateMcpRequest(req: Request): Promise<
  { ok: true; userId: string; tokenId: string }
  | { ok: false; status: number; message: string }
> {
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) {
    return { ok: false, status: 401, message: "missing bearer token" };
  }
  const token = header.slice("Bearer ".length).trim();
  if (!token.startsWith("ut_") || token.length < 32) {
    return { ok: false, status: 401, message: "malformed token" };
  }

  const hash = await sha256Hex(token);
  const [row] = await db
    .select()
    .from(mcpTokens)
    .where(and(eq(mcpTokens.tokenHash, hash), isNull(mcpTokens.revokedAt)))
    .limit(1);

  if (!row) {
    return { ok: false, status: 401, message: "invalid or revoked token" };
  }

  db.update(mcpTokens).set({ lastUsedAt: new Date() }).where(eq(mcpTokens.id, row.id)).catch(() => {});

  return { ok: true, userId: row.userId, tokenId: row.id };
}

export async function generateMcpToken(): Promise<{ plaintext: string; hash: string; prefix: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const body = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  const plaintext = `ut_${body}`;
  const hash = await sha256Hex(plaintext);
  const prefix = plaintext.slice(0, 10);
  return { plaintext, hash, prefix };
}
