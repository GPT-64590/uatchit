"use server";
import { db } from "@/db";
import { users, watches, changes, snapshots, sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUserId } from "@/lib/auth-helpers";
import { signOut } from "@/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type NotificationPrefs = {
  email: boolean;
  digest: boolean;
  onChange: boolean;
  onError: boolean;
};

const DEFAULTS: NotificationPrefs = {
  email: true,
  digest: false,
  onChange: true,
  onError: true,
};

export async function updateName(name: string): Promise<{ ok: true } | { error: string }> {
  const userId = await requireUserId();
  const trimmed = name.trim().slice(0, 60);
  if (!trimmed) return { error: "Name can't be empty" };
  await db.update(users).set({ name: trimmed }).where(eq(users.id, userId));
  revalidatePath("/app/settings");
  return { ok: true };
}

export async function updateNotificationPref(
  key: keyof NotificationPrefs,
  value: boolean,
): Promise<{ ok: true }> {
  const userId = await requireUserId();
  const [u] = await db.select({ prefs: users.notificationPrefs }).from(users).where(eq(users.id, userId)).limit(1);
  const current: NotificationPrefs = { ...DEFAULTS, ...(u?.prefs ?? {}) };
  current[key] = value;
  await db.update(users).set({ notificationPrefs: current }).where(eq(users.id, userId));
  revalidatePath("/app/settings");
  return { ok: true };
}

export async function signOutAllSessions(): Promise<void> {
  const userId = await requireUserId();
  await db.delete(sessions).where(eq(sessions.userId, userId));
  await signOut({ redirectTo: "/" });
}

export async function deleteAllWatches(): Promise<{ ok: true; count: number }> {
  const userId = await requireUserId();
  const rows = await db.delete(watches).where(eq(watches.userId, userId)).returning({ id: watches.id });
  revalidatePath("/app");
  revalidatePath("/app/activity");
  revalidatePath("/app/settings");
  return { ok: true, count: rows.length };
}

export async function deleteAccount(): Promise<void> {
  const userId = await requireUserId();
  // cascade deletes watches, snapshots, changes, mcp_tokens, sessions, accounts via FK on user.id
  await db.delete(changes).where(eq(changes.userId, userId));
  await db.delete(snapshots).where(eq(snapshots.userId, userId));
  await db.delete(watches).where(eq(watches.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
  redirect("/");
}
