import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { changes, watches } from "@/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hostOf(url: string): string {
  try { return new URL(url).host; } catch { return url; }
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(20, Number(url.searchParams.get("limit") ?? 5)));
  const onlyUnseen = url.searchParams.get("onlyUnseen") === "1";

  const conditions = [eq(changes.userId, session.user.id)];
  if (onlyUnseen) conditions.push(isNull(changes.seenAt));

  const rows = await db
    .select({
      id: changes.id,
      watchId: changes.watchId,
      narration: changes.narration,
      createdAt: changes.createdAt,
      seenAt: changes.seenAt,
      diff: changes.diff,
      url: watches.url,
      title: watches.title,
    })
    .from(changes)
    .innerJoin(watches, eq(changes.watchId, watches.id))
    .where(and(...conditions))
    .orderBy(desc(changes.createdAt))
    .limit(limit);

  return NextResponse.json({
    changes: rows.map((r) => ({
      id: r.id,
      watchId: r.watchId,
      narration: r.narration,
      createdAt: r.createdAt.toISOString(),
      seenAt: r.seenAt?.toISOString() ?? null,
      fieldCount: Object.keys((r.diff ?? {}) as Record<string, unknown>).length,
      title: r.title,
      url: r.url,
      host: hostOf(r.url),
    })),
  });
}
