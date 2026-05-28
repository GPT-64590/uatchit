import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { watches, snapshots, changes } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const [watch] = await db
    .select()
    .from(watches)
    .where(and(eq(watches.id, id), eq(watches.userId, session.user.id)))
    .limit(1);
  if (!watch) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const recentSnapshots = await db
    .select()
    .from(snapshots)
    .where(eq(snapshots.watchId, id))
    .orderBy(desc(snapshots.fetchedAt))
    .limit(5);

  const recentChanges = await db
    .select()
    .from(changes)
    .where(eq(changes.watchId, id))
    .orderBy(desc(changes.createdAt))
    .limit(20);

  return NextResponse.json({ watch, snapshots: recentSnapshots, changes: recentChanges });
}
