import "server-only";
import { z } from "zod";
import { db } from "@/db";
import { watches, snapshots, changes } from "@/db/schema";
import { and, eq, desc, gt } from "drizzle-orm";

export async function listWatches(userId: string) {
  const rows = await db
    .select()
    .from(watches)
    .where(eq(watches.userId, userId))
    .orderBy(desc(watches.createdAt));
  return rows.map((w) => ({
    id: w.id,
    url: w.url,
    title: w.title,
    pageType: w.pageType,
    status: w.status,
    intervalMinutes: w.intervalMinutes,
    lastFetchedAt: w.lastFetchedAt,
    createdAt: w.createdAt,
  }));
}

export async function getWatch(userId: string, watchId: string) {
  const [w] = await db
    .select()
    .from(watches)
    .where(and(eq(watches.id, watchId), eq(watches.userId, userId)))
    .limit(1);
  if (!w) return null;
  return w;
}

export async function getLatestSnapshot(userId: string, watchId: string) {
  const own = await getWatch(userId, watchId);
  if (!own) return null;

  const [snap] = await db
    .select()
    .from(snapshots)
    .where(eq(snapshots.watchId, watchId))
    .orderBy(desc(snapshots.fetchedAt))
    .limit(1);
  if (!snap) return null;
  return {
    id: snap.id,
    watchId: snap.watchId,
    contentHash: snap.contentHash,
    extracted: snap.extracted,
    fetchedAt: snap.fetchedAt,
  };
}

export async function getChanges(userId: string, watchId: string, sinceIso?: string, limit = 20) {
  const own = await getWatch(userId, watchId);
  if (!own) return null;

  const since = sinceIso ? new Date(sinceIso) : null;
  const whereClause = since
    ? and(eq(changes.watchId, watchId), gt(changes.createdAt, since))
    : eq(changes.watchId, watchId);

  const rows = await db
    .select()
    .from(changes)
    .where(whereClause)
    .orderBy(desc(changes.createdAt))
    .limit(Math.min(Math.max(limit, 1), 100));

  return rows.map((c) => ({
    id: c.id,
    watchId: c.watchId,
    narration: c.narration,
    diff: c.diff,
    createdAt: c.createdAt,
  }));
}

export async function getSchema(userId: string, watchId: string) {
  const w = await getWatch(userId, watchId);
  return w?.schema ?? null;
}

export const inputSchemas = {
  listWatches: z.object({}),
  getWatch: z.object({ watchId: z.string().uuid() }),
  getLatestSnapshot: z.object({ watchId: z.string().uuid() }),
  getChanges: z.object({
    watchId: z.string().uuid(),
    since: z.string().datetime().optional(),
    limit: z.number().int().positive().max(100).default(20),
  }),
  getSchema: z.object({ watchId: z.string().uuid() }),
};
