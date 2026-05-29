import { db } from "@/db";
import { watches } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { verifyEmailToken } from "@/lib/email-tokens";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One-click pause from a change email. The token is scoped to (userId, watchId)
// and only performs a reversible pause, so it's safe without a login.
export async function GET(req: Request) {
  const p = verifyEmailToken(new URL(req.url).searchParams.get("token"));
  if (!p || p.a !== "pause" || !p.w) {
    return new Response("This pause link isn't valid.", { status: 400 });
  }
  await db
    .update(watches)
    .set({ status: "paused", updatedAt: new Date() })
    .where(and(eq(watches.id, p.w), eq(watches.userId, p.u)));
  // Land them on the watch so they can confirm / resume.
  return Response.redirect(`${env.NEXT_PUBLIC_APP_URL}/app/watches/${p.w}?tab=settings`, 302);
}
