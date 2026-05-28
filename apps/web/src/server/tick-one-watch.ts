import "server-only";
import { db } from "@/db";
import { watches, snapshots, changes, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { bdFetchWithRetry } from "@/lib/brightdata";
import { extractFields, sha256 } from "@/lib/extract";
import { diffExtracted, isMaterialDiff } from "@/lib/diff";
import { narrateDiff } from "@/lib/narrate";
import { sendChangeNotification } from "@/lib/send-email";
import type { InferredSchema } from "@/lib/infer-schema";

export interface TickResult {
  watchId: string;
  status: "no_change" | "changed" | "fetch_error" | "extract_error" | "narrate_error" | "email_error";
  detail?: string;
  durationMs: number;
}

export async function tickOneWatch(watchId: string): Promise<TickResult> {
  const started = Date.now();

  const [watch] = await db.select().from(watches).where(eq(watches.id, watchId)).limit(1);
  if (!watch) {
    return { watchId, status: "fetch_error", detail: "watch not found", durationMs: Date.now() - started };
  }
  if (watch.status !== "active") {
    return { watchId, status: "no_change", detail: "watch paused", durationMs: Date.now() - started };
  }

  const bd = await bdFetchWithRetry({ url: watch.url, format: "markdown", fallbackToBrowser: true });
  if (!bd.ok) {
    await db.update(watches).set({
      status: "error",
      lastFetchedAt: new Date(),
      nextFetchAt: new Date(Date.now() + watch.intervalMinutes * 60_000),
    }).where(eq(watches.id, watchId));
    return { watchId, status: "fetch_error", detail: `${bd.reason}: ${bd.detail}`, durationMs: Date.now() - started };
  }

  const schema = watch.schema as InferredSchema;
  let extracted: Record<string, unknown>;
  try {
    extracted = await extractFields({ schema, markdown: bd.body });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return { watchId, status: "extract_error", detail: String(err?.message ?? e), durationMs: Date.now() - started };
  }

  const [prev] = await db
    .select({ id: snapshots.id, extracted: snapshots.extracted })
    .from(snapshots)
    .where(eq(snapshots.watchId, watchId))
    .orderBy(desc(snapshots.fetchedAt))
    .limit(1);

  const diff = diffExtracted(prev?.extracted as Record<string, unknown> | undefined, extracted);
  const hash = await sha256(bd.body);

  const [newSnapshot] = await db.insert(snapshots).values({
    watchId,
    userId: watch.userId,
    contentHash: hash,
    contentMarkdown: bd.body,
    extracted,
    bdDurationMs: bd.durationMs,
    bdZone: bd.zone,
  }).returning();

  await db.update(watches).set({
    status: "active",
    lastFetchedAt: new Date(),
    nextFetchAt: new Date(Date.now() + watch.intervalMinutes * 60_000),
  }).where(eq(watches.id, watchId));

  if (!isMaterialDiff(diff)) {
    return { watchId, status: "no_change", durationMs: Date.now() - started };
  }

  let narration: string;
  try {
    narration = await narrateDiff({ watchTitle: watch.title ?? watch.url, schema, diff });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return { watchId, status: "narrate_error", detail: String(err?.message ?? e), durationMs: Date.now() - started };
  }

  await db.insert(changes).values({
    watchId,
    userId: watch.userId,
    fromSnapshotId: prev?.id ?? null,
    toSnapshotId: newSnapshot.id,
    narration,
    diff,
  });

  try {
    const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, watch.userId)).limit(1);
    if (user?.email) {
      await sendChangeNotification({
        to: user.email,
        watchId,
        watchTitle: watch.title ?? watch.url,
        watchUrl: watch.url,
        narration,
        diff,
        schema,
        cadenceMinutes: watch.intervalMinutes,
      });
    }
  } catch (e: unknown) {
    const err = e as { message?: string };
    return { watchId, status: "email_error", detail: String(err?.message ?? e), durationMs: Date.now() - started };
  }

  return { watchId, status: "changed", durationMs: Date.now() - started };
}
