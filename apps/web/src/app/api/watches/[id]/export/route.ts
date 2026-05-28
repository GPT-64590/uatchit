import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { watches, snapshots, changes } from "@/db/schema";
import { and, eq, desc, inArray, gte } from "drizzle-orm";
import type { InferredSchema } from "@/lib/infer-schema";

type Format = "json" | "ndjson" | "csv";

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s: string;
  if (typeof v === "string") s = v;
  else if (typeof v === "number" || typeof v === "boolean") s = String(v);
  else s = JSON.stringify(v);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rangeStart(range: string | null): Date | null {
  if (!range || range === "all") return null;
  const now = Date.now();
  if (range === "24h") return new Date(now - 24 * 60 * 60 * 1000);
  if (range === "7d") return new Date(now - 7 * 24 * 60 * 60 * 1000);
  if (range === "30d") return new Date(now - 30 * 24 * 60 * 60 * 1000);
  return null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { id } = await params;
  const url = new URL(req.url);
  const format = (url.searchParams.get("format") ?? "json") as Format;
  const range = url.searchParams.get("range");
  const onlyChanges = url.searchParams.get("onlyChanges") === "1";

  if (!["json", "ndjson", "csv"].includes(format)) {
    return NextResponse.json({ error: "bad_format" }, { status: 400 });
  }

  const [watch] = await db
    .select()
    .from(watches)
    .where(and(eq(watches.id, id), eq(watches.userId, userId)))
    .limit(1);
  if (!watch) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const schema = watch.schema as InferredSchema;
  const fieldNames = schema.fields.map((f) => f.name);

  const since = rangeStart(range);
  const conditions = [eq(snapshots.watchId, id), eq(snapshots.userId, userId)];
  if (since) conditions.push(gte(snapshots.fetchedAt, since));

  let snaps = await db
    .select({
      id: snapshots.id,
      extracted: snapshots.extracted,
      fetchedAt: snapshots.fetchedAt,
      contentHash: snapshots.contentHash,
    })
    .from(snapshots)
    .where(and(...conditions))
    .orderBy(desc(snapshots.fetchedAt));

  if (onlyChanges && snaps.length > 0) {
    // Keep only snapshots that produced a change (either as fromSnapshot or toSnapshot).
    const changedSnapIds = await db
      .select({ toSnapshotId: changes.toSnapshotId })
      .from(changes)
      .where(and(
        eq(changes.watchId, id),
        eq(changes.userId, userId),
        inArray(changes.toSnapshotId, snaps.map((s) => s.id)),
      ));
    const allow = new Set(changedSnapIds.map((c) => c.toSnapshotId));
    snaps = snaps.filter((s) => allow.has(s.id));
  }

  const watchHost = (() => {
    try { return new URL(watch.url).host; } catch { return "watch"; }
  })();
  const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
  const baseFilename = `uatchit-${watchHost}-${stamp}`;

  if (format === "csv") {
    const header = ["fetched_at", "snapshot_id", "content_hash", ...fieldNames]
      .map(csvEscape)
      .join(",");
    const lines = snaps.map((s) => {
      const ex = (s.extracted ?? {}) as Record<string, unknown>;
      const row = [
        s.fetchedAt.toISOString(),
        s.id,
        s.contentHash,
        ...fieldNames.map((f) => ex[f]),
      ];
      return row.map(csvEscape).join(",");
    });
    const body = [header, ...lines].join("\n") + "\n";
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseFilename}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  if (format === "ndjson") {
    const body = snaps
      .map((s) => JSON.stringify({
        fetched_at: s.fetchedAt.toISOString(),
        snapshot_id: s.id,
        content_hash: s.contentHash,
        data: s.extracted,
      }))
      .join("\n") + "\n";
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Content-Disposition": `attachment; filename="${baseFilename}.ndjson"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  // JSON (default)
  const body = JSON.stringify({
    watch: {
      id: watch.id,
      url: watch.url,
      title: watch.title,
      page_type: schema.pageType,
      schema_fields: schema.fields,
    },
    exported_at: new Date().toISOString(),
    count: snaps.length,
    snapshots: snaps.map((s) => ({
      fetched_at: s.fetchedAt.toISOString(),
      snapshot_id: s.id,
      content_hash: s.contentHash,
      data: s.extracted,
    })),
  }, null, 2);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${baseFilename}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
