import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { changes } from "@/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ authenticated: false, count: 0 }, { status: 200 });
  }
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(changes)
    .where(and(eq(changes.userId, session.user.id), isNull(changes.seenAt)));
  return NextResponse.json({ authenticated: true, count });
}
