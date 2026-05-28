import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { users, sessions, verificationTokens } from "@/db/schema";
import { hashCode } from "@/lib/otp";
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  SESSION_MAX_AGE_S,
} from "@/lib/auth-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// In-memory rate limit. Single-VPS, single Next.js process — module state
// persists across requests. A durable limiter is a post-hackathon item.
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 6;
const WINDOW_MS = 10 * 60 * 1000;

function isRateLimited(email: string): boolean {
  const now = Date.now();
  const rec = attempts.get(email);
  if (!rec || now > rec.resetAt) {
    attempts.set(email, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  rec.count += 1;
  return rec.count > MAX_ATTEMPTS;
}

export async function POST(req: NextRequest) {
  let body: { email?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const code = (body.code ?? "").replace(/\D/g, "");
  if (!email || code.length !== 6) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }
  if (isRateLimited(email)) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  // One-time use: delete the matching code row and inspect what came back.
  const [row] = await db
    .delete(verificationTokens)
    .where(and(eq(verificationTokens.identifier, email), eq(verificationTokens.token, hashCode(code))))
    .returning();

  if (!row) {
    return NextResponse.json({ ok: false, error: "invalid_code" }, { status: 401 });
  }
  if (row.expires.getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: "expired" }, { status: 401 });
  }

  // Find or create the user (mirrors Auth.js email-provider login-or-register).
  let [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) {
    [user] = await db.insert(users).values({ email, emailVerified: new Date() }).returning();
  } else if (!user.emailVerified) {
    await db.update(users).set({ emailVerified: new Date() }).where(eq(users.id, user.id));
  }

  // Sign-in succeeded — invalidate every outstanding token for this email
  // (the sibling magic-link token and any other pending codes).
  await db.delete(verificationTokens).where(eq(verificationTokens.identifier, email));

  // Mint a database session and set the same cookie Auth.js would.
  const sessionToken = randomUUID();
  const expires = new Date(Date.now() + SESSION_MAX_AGE_S * 1000);
  await db.insert(sessions).values({ sessionToken, userId: user.id, expires });

  attempts.delete(email);

  const res = NextResponse.json({ ok: true, user: { id: user.id, email: user.email } });
  res.cookies.set(SESSION_COOKIE_NAME, sessionToken, { ...SESSION_COOKIE_OPTIONS, expires });
  return res;
}
