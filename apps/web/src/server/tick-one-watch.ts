import "server-only";
import { db } from "@/db";
import { watches, snapshots, changes, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { bdFetchWithRetry } from "@/lib/brightdata";
import { extractFields, sha256 } from "@/lib/extract";
import { diffExtracted, isMaterialDiff } from "@/lib/diff";
import { narrateDiff, fallbackNarration } from "@/lib/narrate";
import { sendChangeNotification } from "@/lib/send-email";
import { looksLikeErrorPage, allTrackedValuesDropped } from "@/lib/page-access";
import type { InferredSchema } from "@/lib/infer-schema";

export interface TickResult {
  watchId: string;
  status: "no_change" | "changed" | "unavailable" | "fetch_error" | "extract_error" | "email_error";
  detail?: string;
  durationMs: number;
}

// A failed/dead fetch and a recoverable error share the same persistence: flag
// the watch (so it surfaces in the dashboard + drops out of the cron selection)
// and advance the schedule. Resuming the watch re-activates it.
async function setWatchErrored(watchId: string, intervalMinutes: number): Promise<void> {
  await db.update(watches).set({
    status: "error",
    lastFetchedAt: new Date(),
    nextFetchAt: new Date(Date.now() + intervalMinutes * 60_000),
  }).where(eq(watches.id, watchId));
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
    await setWatchErrored(watchId, watch.intervalMinutes);
    // A 404/410/451 is the page being gone, not a transient fetch failure.
    const status = bd.reason === "not_found" ? "unavailable" : "fetch_error";
    return { watchId, status, detail: `${bd.reason}: ${bd.detail}`, durationMs: Date.now() - started };
  }

  // Source-availability guard (pre-extraction): a page that now serves an error
  // shell ("Page not found", "Request Failed"…) comes back from Bright Data as
  // ok content. Diffing that against the real prior snapshot fires a false
  // "everything changed" alert — the #1 cause of spurious emails. Flag instead.
  if (looksLikeErrorPage(bd.body)) {
    await setWatchErrored(watchId, watch.intervalMinutes);
    return { watchId, status: "unavailable", detail: "page now returns an error/not-found shell instead of content", durationMs: Date.now() - started };
  }

  const schema = watch.schema as InferredSchema;
  let extracted: Record<string, unknown>;
  try {
    extracted = await extractFields({ schema, markdown: bd.body });
  } catch (e: unknown) {
    // Advance the schedule + flag the watch — otherwise nextFetchAt stays in the
    // past and the cron re-selects this watch every cycle, re-burning a Bright
    // Data + LLM call forever on a watch that keeps failing extraction.
    await setWatchErrored(watchId, watch.intervalMinutes);
    const err = e as { message?: string };
    return { watchId, status: "extract_error", detail: String(err?.message ?? e), durationMs: Date.now() - started };
  }

  const [prev] = await db
    .select({ id: snapshots.id, extracted: snapshots.extracted })
    .from(snapshots)
    .where(eq(snapshots.watchId, watchId))
    .orderBy(desc(snapshots.fetchedAt))
    .limit(1);

  // Source-availability guard (post-extraction): if every previously-populated
  // field dropped to null, the page broke/gated rather than "everything changed".
  // Don't write a spurious all-removed change or email; flag the watch and keep
  // the last good snapshot as the baseline so it recovers cleanly on resume.
  if (allTrackedValuesDropped(prev?.extracted as Record<string, unknown> | undefined, extracted)) {
    await setWatchErrored(watchId, watch.intervalMinutes);
    return { watchId, status: "unavailable", detail: "all tracked fields dropped — likely a broken or gated page, not a real change", durationMs: Date.now() - started };
  }

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

  // Narration is a nicety; a failure here must NOT drop the detected change.
  // Fall back to a deterministic summary so the change row + email still go out.
  let narration: string;
  try {
    narration = await narrateDiff({ watchTitle: watch.title ?? watch.url, schema, diff });
  } catch {
    narration = fallbackNarration(diff);
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
    const [user] = await db
      .select({ email: users.email, prefs: users.notificationPrefs })
      .from(users)
      .where(eq(users.id, watch.userId))
      .limit(1);
    // Honor the user's notification preferences — never email someone who turned
    // change alerts off (CAN-SPAM / GDPR). prefs is NOT NULL with a default, so
    // it's always present; the optional chaining is belt-and-suspenders.
    if (user?.email && user.prefs?.email && user.prefs?.onChange) {
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
