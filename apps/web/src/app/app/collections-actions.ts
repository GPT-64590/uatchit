"use server";
import { db } from "@/db";
import { collections, watches } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { requireUserId } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";

export async function createCollection(name: string, color?: string): Promise<{ id: string } | { error: string }> {
  const userId = await requireUserId();
  const trimmed = name.trim().slice(0, 40);
  if (!trimmed) return { error: "Name can't be empty" };

  const [row] = await db
    .insert(collections)
    .values({ userId, name: trimmed, color: color?.trim() || null })
    .returning({ id: collections.id });
  revalidatePath("/app");
  revalidatePath("/app/activity");
  return { id: row.id };
}

export async function renameCollection(id: string, name: string): Promise<{ ok: true } | { error: string }> {
  const userId = await requireUserId();
  const trimmed = name.trim().slice(0, 40);
  if (!trimmed) return { error: "Name can't be empty" };
  await db
    .update(collections)
    .set({ name: trimmed })
    .where(and(eq(collections.id, id), eq(collections.userId, userId)));
  revalidatePath("/app");
  return { ok: true };
}

export async function deleteCollection(id: string): Promise<{ ok: true }> {
  const userId = await requireUserId();
  await db
    .delete(collections)
    .where(and(eq(collections.id, id), eq(collections.userId, userId)));
  revalidatePath("/app");
  return { ok: true };
}

export async function setWatchCollection(
  watchId: string,
  collectionId: string | null,
): Promise<{ ok: true }> {
  const userId = await requireUserId();
  await db
    .update(watches)
    .set({ collectionId })
    .where(and(eq(watches.id, watchId), eq(watches.userId, userId)));
  revalidatePath("/app");
  revalidatePath(`/app/watches/${watchId}`);
  return { ok: true };
}

export async function addWatchesToCollection(
  collectionId: string,
  watchIds: string[],
): Promise<{ ok: true; count: number }> {
  const userId = await requireUserId();
  if (watchIds.length === 0) return { ok: true, count: 0 };
  // Confirm the collection belongs to this user (defence-in-depth — and(...userId) on update also enforces)
  const [coll] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(and(eq(collections.id, collectionId), eq(collections.userId, userId)))
    .limit(1);
  if (!coll) return { ok: true, count: 0 };

  const result = await db
    .update(watches)
    .set({ collectionId })
    .where(and(eq(watches.userId, userId), inArray(watches.id, watchIds)))
    .returning({ id: watches.id });
  revalidatePath("/app");
  return { ok: true, count: result.length };
}

export async function removeWatchesFromCollection(
  watchIds: string[],
): Promise<{ ok: true; count: number }> {
  const userId = await requireUserId();
  if (watchIds.length === 0) return { ok: true, count: 0 };
  const result = await db
    .update(watches)
    .set({ collectionId: null })
    .where(and(eq(watches.userId, userId), inArray(watches.id, watchIds)))
    .returning({ id: watches.id });
  revalidatePath("/app");
  return { ok: true, count: result.length };
}
