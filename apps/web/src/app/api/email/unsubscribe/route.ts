import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyEmailToken } from "@/lib/email-tokens";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sets the user's master email toggle off. Stateless HMAC token = the recipient
// can unsubscribe straight from their inbox with no login bounce.
async function unsubscribe(token: string | null): Promise<boolean> {
  const p = verifyEmailToken(token);
  if (!p || p.a !== "unsubscribe") return false;
  const [u] = await db.select({ prefs: users.notificationPrefs }).from(users).where(eq(users.id, p.u)).limit(1);
  if (!u) return false;
  await db.update(users).set({ notificationPrefs: { ...u.prefs, email: false } }).where(eq(users.id, p.u));
  return true;
}

function page(ok: boolean): string {
  const title = ok ? "You're unsubscribed" : "Link not valid";
  const body = ok
    ? "You won't receive change emails from uatchit anymore. You can re-enable them anytime in Settings → Notifications."
    : "This unsubscribe link isn't valid. If you meant to unsubscribe, open Settings → Notifications.";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>uatchit</title><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#0a0a0d;color:#e7e7ea;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}.c{max-width:420px;padding:32px;text-align:center}h1{font-weight:500;font-size:20px;letter-spacing:-0.02em}p{color:#9a9aa3;line-height:1.6;font-size:14px}a{color:#7cb0ff;text-decoration:none}</style></head><body><div class="c"><h1>${title}</h1><p>${body}</p><p><a href="${env.NEXT_PUBLIC_APP_URL}/app/settings">Manage notifications →</a></p></div></body></html>`;
}

export async function GET(req: Request) {
  const ok = await unsubscribe(new URL(req.url).searchParams.get("token"));
  return new Response(page(ok), {
    status: ok ? 200 : 400,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

// RFC 8058 one-click: mail clients POST here directly from the List-Unsubscribe header.
export async function POST(req: Request) {
  const ok = await unsubscribe(new URL(req.url).searchParams.get("token"));
  return new Response(null, { status: ok ? 200 : 400 });
}
