import { requireUserId } from "@/lib/auth-helpers";
import { db } from "@/db";
import { users, watches, mcpTokens, sessions } from "@/db/schema";
import { eq, and, isNull, gt } from "drizzle-orm";
import { SettingsClient } from "./SettingsClient";

const DEFAULT_PREFS = { email: true, digest: false, onChange: true, onError: true };

export default async function SettingsPage() {
  const userId = await requireUserId();

  const [user] = await db
    .select({ name: users.name, email: users.email, prefs: users.notificationPrefs })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return null;

  const watchCount = await db
    .select({ id: watches.id })
    .from(watches)
    .where(eq(watches.userId, userId))
    .then((r) => r.length);

  const mcpKeyCount = await db
    .select({ id: mcpTokens.id })
    .from(mcpTokens)
    .where(and(eq(mcpTokens.userId, userId), isNull(mcpTokens.revokedAt)))
    .then((r) => r.length);

  const sessionCount = await db
    .select({ token: sessions.sessionToken })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expires, new Date())))
    .then((r) => r.length);

  return (
    <SettingsClient
      initialName={user.name ?? user.email.split("@")[0]}
      email={user.email}
      prefs={{ ...DEFAULT_PREFS, ...(user.prefs ?? {}) }}
      watchCount={watchCount}
      mcpKeyCount={mcpKeyCount}
      sessionCount={sessionCount}
    />
  );
}
