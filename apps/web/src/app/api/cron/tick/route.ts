import { NextResponse } from "next/server";
import { db } from "@/db";
import { watches } from "@/db/schema";
import { and, eq, lte } from "drizzle-orm";
import { tickOneWatch } from "@/server/tick-one-watch";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const due = await db
    .select({ id: watches.id })
    .from(watches)
    .where(and(eq(watches.status, "active"), lte(watches.nextFetchAt, now)))
    .limit(20);

  if (due.length === 0) {
    return NextResponse.json({ ticked: 0, message: "nothing due" });
  }

  const results: Array<Awaited<ReturnType<typeof tickOneWatch>>> = [];
  const concurrency = 5;
  for (let i = 0; i < due.length; i += concurrency) {
    const chunk = due.slice(i, i + concurrency);
    const settled = await Promise.allSettled(chunk.map((w) => tickOneWatch(w.id)));
    for (const s of settled) {
      if (s.status === "fulfilled") results.push(s.value);
      else results.push({ watchId: "?", status: "fetch_error" as const, detail: String(s.reason), durationMs: 0 });
    }
  }

  const summary = {
    ticked: results.length,
    changed: results.filter((r) => r.status === "changed").length,
    no_change: results.filter((r) => r.status === "no_change").length,
    unavailable: results.filter((r) => r.status === "unavailable").length,
    errors: results.filter((r) => r.status.endsWith("_error")).length,
    results,
  };
  return NextResponse.json(summary);
}
