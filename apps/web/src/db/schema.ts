import {
  pgTable,
  text,
  timestamp,
  integer,
  primaryKey,
  uuid,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

export const users = pgTable("user", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email").unique().notNull(),
  emailVerified: timestamp("emailVerified", { mode: "date", withTimezone: true }),
  image: text("image"),
  notificationPrefs: jsonb("notificationPrefs")
    .$type<{ email: boolean; digest: boolean; onChange: boolean; onError: boolean }>()
    .notNull()
    .default({ email: true, digest: false, onChange: true, onError: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export const accounts = pgTable(
  "account",
  {
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (a) => ({ pk: primaryKey({ columns: [a.provider, a.providerAccountId] }) })
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: uuid("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
  },
  (vt) => ({ pk: primaryKey({ columns: [vt.identifier, vt.token] }) })
);

// === uatchit domain tables ===

export const collections = pgTable(
  "collection",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color"), // optional accent hint (oklch hue or hex)
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("collection_user_idx").on(t.userId),
  })
);

export const watches = pgTable(
  "watch",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    collectionId: uuid("collectionId").references(() => collections.id, { onDelete: "set null" }),
    url: text("url").notNull(),
    title: text("title"),
    favicon: text("favicon"),
    pageType: text("pageType"),
    schema: jsonb("schema").notNull(),
    intervalMinutes: integer("intervalMinutes").notNull().default(360),
    status: text("status").notNull().default("active"),
    // Consecutive failed/unavailable ticks. Tolerates transient outages: the
    // watch keeps retrying until this crosses a threshold, then it's flagged
    // (status="error") and the user gets one notice. Reset to 0 on any success.
    consecutiveFailures: integer("consecutiveFailures").notNull().default(0),
    lastFetchedAt: timestamp("lastFetchedAt", { withTimezone: true }),
    nextFetchAt: timestamp("nextFetchAt", { withTimezone: true }),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("watch_user_idx").on(t.userId),
    collectionIdx: index("watch_collection_idx").on(t.collectionId),
    nextFetchIdx: index("watch_next_fetch_idx").on(t.nextFetchAt),
  })
);

export const snapshots = pgTable(
  "snapshot",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    watchId: uuid("watchId")
      .notNull()
      .references(() => watches.id, { onDelete: "cascade" }),
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    contentHash: text("contentHash").notNull(),
    contentMarkdown: text("contentMarkdown").notNull(),
    extracted: jsonb("extracted").notNull(),
    bdDurationMs: integer("bdDurationMs"),
    bdZone: text("bdZone"),
    fetchedAt: timestamp("fetchedAt", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    watchIdx: index("snapshot_watch_idx").on(t.watchId),
    userIdx: index("snapshot_user_idx").on(t.userId),
  })
);

export const changes = pgTable(
  "change",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    watchId: uuid("watchId")
      .notNull()
      .references(() => watches.id, { onDelete: "cascade" }),
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fromSnapshotId: uuid("fromSnapshotId").references(() => snapshots.id),
    toSnapshotId: uuid("toSnapshotId").notNull().references(() => snapshots.id),
    narration: text("narration").notNull(),
    diff: jsonb("diff").notNull(),
    notifiedAt: timestamp("notifiedAt", { withTimezone: true }),
    seenAt: timestamp("seenAt", { withTimezone: true }),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    watchIdx: index("change_watch_idx").on(t.watchId),
    userIdx: index("change_user_idx").on(t.userId),
    createdIdx: index("change_created_idx").on(t.createdAt),
  })
);

export const waitlistSignups = pgTable("waitlist_signup", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  source: text("source"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export const markdownCache = pgTable(
  "markdown_cache",
  {
    url: text("url").primaryKey(),
    body: text("body").notNull(), // BD-converted markdown
    html: text("html"),           // optional raw HTML, populated when structure extraction is needed
    fetchedAt: timestamp("fetchedAt", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  },
  (t) => ({
    expiresIdx: index("markdown_cache_expires_idx").on(t.expiresAt),
  })
);

export const mcpTokens = pgTable(
  "mcp_token",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenHash: text("tokenHash").notNull().unique(),
    prefix: text("prefix").notNull(),
    lastUsedAt: timestamp("lastUsedAt", { withTimezone: true }),
    revokedAt: timestamp("revokedAt", { withTimezone: true }),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("mcp_token_user_idx").on(t.userId),
  })
);
