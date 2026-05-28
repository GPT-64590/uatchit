import { db } from "@/db";
import { watches, mcpTokens, users, changes, collections } from "@/db/schema";
import { eq, and, isNull, gt, asc, sql } from "drizzle-orm";
import { requireUserId } from "@/lib/auth-helpers";
import { signOut } from "@/auth";
import { Sidebar } from "@/components/dashboard/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const userId = await requireUserId();

  const [user] = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const watchCount = await db
    .select({ id: watches.id })
    .from(watches)
    .where(eq(watches.userId, userId))
    .then((r) => r.length);

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const activityCount = await db
    .select({ id: changes.id })
    .from(changes)
    .where(and(eq(changes.userId, userId), gt(changes.createdAt, yesterday)))
    .then((r) => r.length);

  const mcpCount = await db
    .select({ id: mcpTokens.id })
    .from(mcpTokens)
    .where(and(eq(mcpTokens.userId, userId), isNull(mcpTokens.revokedAt)))
    .then((r) => r.length);

  // Real collections, with watch counts
  const collectionRows = await db
    .select({
      id: collections.id,
      name: collections.name,
      color: collections.color,
      count: sql<number>`count(${watches.id})::int`,
    })
    .from(collections)
    .leftJoin(watches, eq(watches.collectionId, collections.id))
    .where(eq(collections.userId, userId))
    .groupBy(collections.id)
    .orderBy(asc(collections.createdAt));

  const userName = user?.name ?? user?.email?.split("@")[0] ?? "You";
  const initials = (user?.name ?? user?.email ?? "U?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <div className="app">
      <Sidebar
        watchCount={watchCount}
        activityCount={activityCount}
        mcpCount={mcpCount}
        userName={userName}
        userInitials={initials}
        collections={collectionRows.map((c) => ({
          id: c.id,
          name: c.name,
          color: c.color,
          count: c.count,
        }))}
        logoutAction={logout}
      />
      <main className="main">{children}</main>
    </div>
  );
}
