import "server-only";
import { db } from "@/db";
import { watches, snapshots, changes, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { bdFetchWithRetry } from "@/lib/brightdata";
import { extractFields, sha256 } from "@/lib/extract";
import { diffExtracted, isMaterialDiff } from "@/lib/diff";
import { narrateDiff, fallbackNarration } from "@/lib/narrate";
import { sendChangeNotification, sendWatchUnreachableNotice } from "@/lib/send-email";
import { looksLikeErrorPage, allTrackedValuesDropped } from "@/lib/page-access";
import type { InferredSchema } from "@/lib/infer-schema";

export interface TickResult {
  watchId: string;
  status: "no_change" | "changed" | "unavailable" | "fetch_error" | "extract_error" | "email_error";
  detail?: string;
  durationMs: number;
}

// Tolerate one transient failure; flag the watch on the 2nd consecutive one.
const FAILURE_THRESHOLD = 2;

// Records a failed/unavailable tick. Below the threshold the watch stays active
// and retries next cadence, so a transient outage self-heals. At/above it the
// watch is flagged "error" (drops out of cron until resumed). Returns
// justFlagged=true on the single tick that crosses the threshold, so the caller
// can send exactly one notice. The counter resets to 0 on any successful tick.
async function recordFailure(
  watch: { id: string; intervalMinutes: number; consecutiveFailures: number },
): Promise<{ flagged: boolean; justFlagged: boolean }> {
  const failures = (watch.consecutiveFailures ?? 0) + 1;
  const flagged = failures >= FAILURE_THRESHOLD;
  const wasFlagged = (watch.consecutiveFailures ?? 0) >= FAILURE_THRESHOLD;
  await db.update(watches).set({
    status: flagged ? "error" : "active",
    consecutiveFailures: failures,
    lastFetchedAt: new Date(),
    nextFetchAt: new Date(Date.now() + watch.intervalMinutes * 60_000),
  }).where(eq(watches.id, watch.id));
  return { flagged, justFlagged: flagged && !wasFlagged };
}

// One-time, prefs-gated "we can no longer reach this page" notice. Best-effort:
// a send failure must not fail the tick.
async function maybeNotifyUnreachable(
  watch: { id: string; userId: string; url: string; title: string | null; intervalMinutes: number },
  detail: string,
): Promise<void> {
  const [user] = await db
    .select({ email: users.email, prefs: users.notificationPrefs })
    .from(users)
    .where(eq(users.id, watch.userId))
    .limit(1);
  if (!(user?.email && user.prefs?.email && user.prefs?.onError)) return;
  try {
    await sendWatchUnreachableNotice({
      to: user.email,
      userId: watch.userId,
      watchId: watch.id,
      watchTitle: watch.title ?? watch.url,
      watchUrl: watch.url,
      detail,
      cadenceMinutes: watch.intervalMinutes,
    });
  } catch {
    /* notice is best-effort */
  }
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
    const { justFlagged } = await recordFailure(watch);
    // A 404/410/451 is the page being gone, not a transient fetch failure.
    const unavailable = bd.reason === "not_found";
    if (justFlagged) {
      await maybeNotifyUnreachable(watch, unavailable ? "it returned not found (404)" : `the fetch keeps failing (${bd.reason})`);
    }
    return { watchId, status: unavailable ? "unavailable" : "fetch_error", detail: `${bd.reason}: ${bd.detail}`, durationMs: Date.now() - started };
  }

  // Source-availability guard (pre-extraction): a page that now serves an error
  // shell ("Page not found", "Request Failed"…) comes back from Bright Data as
  // ok content. Diffing that against the real prior snapshot fires a false
  // "everything changed" alert — the #1 cause of spurious emails. Flag instead.
  if (looksLikeErrorPage(bd.body)) {
    const { justFlagged } = await recordFailure(watch);
    if (justFlagged) await maybeNotifyUnreachable(watch, "the page now returns an error / not-found shell instead of content");
    return { watchId, status: "unavailable", detail: "page now returns an error/not-found shell instead of content", durationMs: Date.now() - started };
  }

  const schema = watch.schema as InferredSchema;
  let extracted: Record<string, unknown>;
  try {
    extracted = await extractFields({ schema, markdown: bd.body });
  } catch (e: unknown) {
    // Count it toward the failure threshold (so it advances nextFetchAt and
    // eventually flags + stops, instead of re-burning a fetch+LLM call every
    // cycle), but don't email — extraction failure is an internal error, not a
    // page problem the user can act on.
    await recordFailure(watch);
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
    const { justFlagged } = await recordFailure(watch);
    if (justFlagged) await maybeNotifyUnreachable(watch, "every tracked field dropped — the page is likely broken, gated, or removed");
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
    consecutiveFailures: 0, // successful tick — reset the transient-failure counter
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
        userId: watch.userId,
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
