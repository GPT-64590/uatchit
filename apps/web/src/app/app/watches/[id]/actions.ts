"use server";
import { db } from "@/db";
import { watches, changes } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { requireUserId } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function pauseWatch(watchId: string): Promise<void> {
  const userId = await requireUserId();
  await db
    .update(watches)
    .set({ status: "paused", updatedAt: new Date() })
    .where(and(eq(watches.id, watchId), eq(watches.userId, userId)));
  revalidatePath(`/app/watches/${watchId}`);
  revalidatePath("/app");
}

export async function resumeWatch(watchId: string): Promise<void> {
  const userId = await requireUserId();
  await db
    .update(watches)
    .set({
      status: "active",
      updatedAt: new Date(),
      nextFetchAt: new Date(Date.now() + 60_000),
    })
    .where(and(eq(watches.id, watchId), eq(watches.userId, userId)));
  revalidatePath(`/app/watches/${watchId}`);
  revalidatePath("/app");
}

export async function deleteWatch(watchId: string): Promise<void> {
  const userId = await requireUserId();
  await db
    .delete(watches)
    .where(and(eq(watches.id, watchId), eq(watches.userId, userId)));
  revalidatePath("/app");
  revalidatePath("/app/activity");
  redirect("/app");
}

export async function updateCadence(watchId: string, intervalMinutes: number): Promise<void> {
  const userId = await requireUserId();
  if (intervalMinutes < 30 || intervalMinutes > 10_080) return;
  await db
    .update(watches)
    .set({
      intervalMinutes,
      updatedAt: new Date(),
      nextFetchAt: new Date(Date.now() + intervalMinutes * 60_000),
    })
    .where(and(eq(watches.id, watchId), eq(watches.userId, userId)));
  revalidatePath(`/app/watches/${watchId}`);
}

export async function rerunNow(watchId: string): Promise<void> {
  const userId = await requireUserId();
  await db
    .update(watches)
    .set({ nextFetchAt: new Date(Date.now() - 1000) })
    .where(and(eq(watches.id, watchId), eq(watches.userId, userId)));
  revalidatePath(`/app/watches/${watchId}`);
}

export async function markChangeSeen(changeId: string): Promise<void> {
  const userId = await requireUserId();
  await db
    .update(changes)
    .set({ seenAt: new Date() })
    .where(and(eq(changes.id, changeId), eq(changes.userId, userId)));
}

export async function markAllSeen(watchId: string): Promise<void> {
  const userId = await requireUserId();
  await db
    .update(changes)
    .set({ seenAt: new Date() })
    .where(and(eq(changes.watchId, watchId), eq(changes.userId, userId), isNull(changes.seenAt)));
  revalidatePath(`/app/watches/${watchId}`);
  revalidatePath("/app/activity");
}
