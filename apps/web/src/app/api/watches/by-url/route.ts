import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { watches, changes, snapshots } from "@/db/schema";
import { and, eq, sql, isNull } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const u = new URL(req.url);
  const target = u.searchParams.get("url");
  if (!target) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const [w] = await db
    .select()
    .from(watches)
    .where(and(eq(watches.userId, session.user.id), eq(watches.url, target)))
    .limit(1);

  if (!w) return NextResponse.json({ watched: false });

  const [{ count: changeCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(changes)
    .where(eq(changes.watchId, w.id));
  const [{ count: snapshotCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(snapshots)
    .where(eq(snapshots.watchId, w.id));
  const [{ count: unseenCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(changes)
    .where(and(eq(changes.watchId, w.id), isNull(changes.seenAt)));

  return NextResponse.json({
    watched: true,
    watch: {
      id: w.id,
      title: w.title,
      status: w.status,
      intervalMinutes: w.intervalMinutes,
      changeCount,
      snapshotCount,
      unseenCount,
      lastFetchedAt: w.lastFetchedAt?.toISOString() ?? null,
      nextFetchAt: w.nextFetchAt?.toISOString() ?? null,
    },
  });
}
