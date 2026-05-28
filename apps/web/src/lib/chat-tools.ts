import "server-only";
import { z } from "zod";
import { db } from "@/db";
import { watches, changes, snapshots, markdownCache } from "@/db/schema";
import { eq, and, desc, isNull, gt, lt, sql } from "drizzle-orm";
import { bdFetchWithRetry } from "./brightdata";
import { inferSchema, type InferredSchema, type SchemaBreadth } from "./infer-schema";
import { extractFields, sha256 } from "./extract";
import { tryBDScraper, findBDRoute } from "./bd-scrapers";
import { contentLooksUnwatchable } from "./page-access";

/* ------------------------------------------------------------------ */
/* Page cache — Postgres-backed.                                       */
/*                                                                     */
/* `markdown_cache.body`  → BD-converted markdown (link-preserving;    */
/*                          BD's `format=markdown` keeps [text](url),  */
/*                          lists, images. Used directly by inference. */
/* `markdown_cache.html`  → kept in schema for future deterministic-   */
/*                          extractor work; currently unwritten.       */
/* ------------------------------------------------------------------ */

const TTL_MS = 60_000;

export async function fetchMarkdownCached(
  url: string,
): Promise<{ ok: true; body: string } | { ok: false; reason: string; detail: string }> {
  const now = new Date();
  const [hit] = await db
    .select({ body: markdownCache.body })
    .from(markdownCache)
    .where(and(eq(markdownCache.url, url), gt(markdownCache.expiresAt, now)))
    .limit(1);
  if (hit && hit.body) return { ok: true, body: hit.body };

  const r = await bdFetchWithRetry({ url, format: "markdown", fallbackToBrowser: true });
  if (!r.ok) return { ok: false, reason: r.reason, detail: r.detail };
  await writeMarkdownCache(url, r.body);
  return { ok: true, body: r.body };
}

export async function writeMarkdownCache(url: string, body: string): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TTL_MS);
  await db.delete(markdownCache).where(lt(markdownCache.expiresAt, now)).catch(() => {});
  await db
    .insert(markdownCache)
    .values({ url, body, fetchedAt: now, expiresAt })
    .onConflictDoUpdate({
      target: markdownCache.url,
      set: { body, fetchedAt: now, expiresAt },
    });
}

/* ------------------------------------------------------------------ */
/* 2-tier inference: BD pre-built scraper → universal-prompt LLM       */
/* ------------------------------------------------------------------ */

export type InferSource = "bd_scraper" | "llm";

export interface InferOrFetchResult {
  source: InferSource;
  schema: InferredSchema;
  extracted: Record<string, unknown>;
  contentMarkdown: string;
}

export async function inferOrFetch(
  url: string,
  intent?: string,
  breadth: SchemaBreadth = "focused",
): Promise<{ ok: true; result: InferOrFetchResult } | { ok: false; reason: string; detail: string }> {
  // 1. Bright Data pre-built scraper for known sites.
  const bd = await tryBDScraper(url);
  if (bd.ok) {
    return {
      ok: true,
      result: {
        source: "bd_scraper",
        schema: bd.result.schema,
        extracted: bd.result.extracted,
        contentMarkdown: bd.result.contentMarkdown,
      },
    };
  }

  // 2. LLM single-pass inference. BD's `format=markdown` returns link-preserving
  //    markdown directly; no HTML/cheerio middlestep needed. Universal mutation
  //    prompt — no archetype catalog, no special-case rules. The LLM produces
  //    a minimum-useful schema given page + user intent.
  const md = await fetchMarkdownCached(url);
  if (!md.ok) return { ok: false, reason: md.reason, detail: md.detail };
  // Layer-2 gate: if BD returned a login wall / error / near-empty page, don't
  // hand it to the LLM — it would invent a schema around the error text.
  const access = contentLooksUnwatchable(md.body);
  if (!access.ok) return { ok: false, reason: access.reason, detail: access.detail };
  let schema: InferredSchema;
  try {
    schema = await inferSchema({ url, markdown: md.body, userIntent: intent, breadth });
  } catch (e: unknown) {
    return { ok: false, reason: "inference_failed", detail: String((e as Error)?.message ?? e) };
  }

  let extracted: Record<string, unknown> = {};
  try {
    extracted = await extractFields({ schema, markdown: md.body });
  } catch {
    extracted = {};
  }

  return {
    ok: true,
    result: { source: "llm", schema, extracted, contentMarkdown: md.body },
  };
}

/* ------------------------------------------------------------------ */
/* Tool context                                                        */
/* ------------------------------------------------------------------ */

export interface ToolCtx {
  userId: string;
  pageContext?: { url?: string; title?: string; markdown?: string };
}

export interface ToolDef<I, O> {
  name: string;
  description: string;
  input: z.ZodType<I>;
  display:
    | "watches-list"
    | "changes-list"
    | "watch-state"
    | "schema-preview"
    | "watch-created"
    | "watch-updated"
    | "watch-deleted"
    | "page-fetched"
    | "error";
  execute: (ctx: ToolCtx, args: I) => Promise<O>;
}

function hostOf(url: string): string {
  try { return new URL(url).host; } catch { return url; }
}

/* ------------------------------------------------------------------ */
/* Tools                                                               */
/* ------------------------------------------------------------------ */

const listWatchesTool: ToolDef<
  { filter?: "active" | "paused" | "all"; limit?: number },
  { watches: Array<{ id: string; url: string; host: string; title: string | null; status: string; intervalMinutes: number; lastFetchedAt: string | null; createdAt: string }> }
> = {
  name: "list_watches",
  description:
    "List the user's watches. Use when the user asks 'what am I watching', 'show my watches', or needs to act on an existing watch by name.",
  input: z.object({
    filter: z.enum(["active", "paused", "all"]).optional().default("all"),
    limit: z.number().int().min(1).max(50).optional().default(20),
  }),
  display: "watches-list",
  execute: async (ctx, args) => {
    const conditions = [eq(watches.userId, ctx.userId)];
    if (args.filter && args.filter !== "all") conditions.push(eq(watches.status, args.filter));
    const rows = await db
      .select()
      .from(watches)
      .where(and(...conditions))
      .orderBy(desc(watches.createdAt))
      .limit(args.limit ?? 20);
    return {
      watches: rows.map((w) => ({
        id: w.id,
        url: w.url,
        host: hostOf(w.url),
        title: w.title,
        status: w.status,
        intervalMinutes: w.intervalMinutes,
        lastFetchedAt: w.lastFetchedAt?.toISOString() ?? null,
        createdAt: w.createdAt.toISOString(),
      })),
    };
  },
};

const getRecentChangesTool: ToolDef<
  { watchId?: string; since?: string; limit?: number; onlyUnseen?: boolean },
  {
    changes: Array<{
      id: string;
      watchId: string;
      narration: string;
      diff: unknown;
      createdAt: string;
      seenAt: string | null;
      watchTitle: string | null;
      watchUrl: string;
      host: string;
    }>;
  }
> = {
  name: "get_recent_changes",
  description:
    "Get recent changes across the user's watches (or for one specific watch). Use when the user asks 'what changed', 'any updates', 'what's new', or for context before answering questions about activity.",
  input: z.object({
    watchId: z.string().uuid().optional(),
    since: z.string().datetime().optional(),
    limit: z.number().int().min(1).max(50).optional().default(10),
    onlyUnseen: z.boolean().optional().default(false),
  }),
  display: "changes-list",
  execute: async (ctx, args) => {
    const conditions = [eq(changes.userId, ctx.userId)];
    if (args.watchId) conditions.push(eq(changes.watchId, args.watchId));
    if (args.since) conditions.push(gt(changes.createdAt, new Date(args.since)));
    if (args.onlyUnseen) conditions.push(isNull(changes.seenAt));

    const rows = await db
      .select({
        id: changes.id,
        watchId: changes.watchId,
        narration: changes.narration,
        diff: changes.diff,
        createdAt: changes.createdAt,
        seenAt: changes.seenAt,
        watchTitle: watches.title,
        watchUrl: watches.url,
      })
      .from(changes)
      .innerJoin(watches, eq(changes.watchId, watches.id))
      .where(and(...conditions))
      .orderBy(desc(changes.createdAt))
      .limit(args.limit ?? 10);

    return {
      changes: rows.map((r) => ({
        id: r.id,
        watchId: r.watchId,
        narration: r.narration,
        diff: r.diff,
        createdAt: r.createdAt.toISOString(),
        seenAt: r.seenAt?.toISOString() ?? null,
        watchTitle: r.watchTitle,
        watchUrl: r.watchUrl,
        host: hostOf(r.watchUrl),
      })),
    };
  },
};

const getWatchByUrlTool: ToolDef<
  { url: string },
  {
    watched: boolean;
    watch?: {
      id: string;
      title: string | null;
      status: string;
      intervalMinutes: number;
      changeCount: number;
      snapshotCount: number;
      lastFetchedAt: string | null;
      createdAt: string;
    };
  }
> = {
  name: "get_watch_by_url",
  description:
    "Check whether a URL is already being watched. Returns counts and status if so. Useful before suggesting create_watch.",
  input: z.object({ url: z.string().url() }),
  display: "watch-state",
  execute: async (ctx, args) => {
    const [w] = await db
      .select()
      .from(watches)
      .where(and(eq(watches.userId, ctx.userId), eq(watches.url, args.url)))
      .limit(1);
    if (!w) return { watched: false };
    const [{ count: changeCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(changes)
      .where(eq(changes.watchId, w.id));
    const [{ count: snapshotCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(snapshots)
      .where(eq(snapshots.watchId, w.id));
    return {
      watched: true,
      watch: {
        id: w.id,
        title: w.title,
        status: w.status,
        intervalMinutes: w.intervalMinutes,
        changeCount,
        snapshotCount,
        lastFetchedAt: w.lastFetchedAt?.toISOString() ?? null,
        createdAt: w.createdAt.toISOString(),
      },
    };
  },
};

// Compact a freshly-extracted record for the preview card + agent context:
// arrays → first 2 items, long strings clipped. Keeps the wire small while
// showing REAL fetched values (so a broad schema never looks falsely empty).
function sampleExtracted(extracted: Record<string, unknown>): Record<string, unknown> {
  const clip = (v: unknown): unknown => {
    if (typeof v === "string") return v.length > 160 ? v.slice(0, 160) + "…" : v;
    if (Array.isArray(v)) return v.slice(0, 2).map(clip);
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, clip(x)]));
    }
    return v;
  };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(extracted)) out[k] = clip(v);
  return out;
}

const previewSchemaTool: ToolDef<
  { url: string; intent?: string; breadth?: SchemaBreadth },
  {
    ok: true;
    source: InferSource;
    schema: InferredSchema;
    sourceUrl: string;
    extracted: Record<string, unknown>;
  } | {
    ok: false;
    reason: string;
    detail: string;
  }
> = {
  name: "preview_schema",
  description:
    "Infer (without committing) a structured schema for what's worth tracking on a URL. Known sites (LinkedIn, Amazon, etc.) get deterministic schemas; everything else goes through the LLM. Set breadth='broad' when the user wants to TRACK EVERYTHING / all changes (comprehensive coverage, still noise-filtered); leave it 'focused' (default) for a minimal mutation-only schema. ALWAYS call this before create_watch. Returns `extracted` — the REAL current values pulled from the page (sampled). If a field a user asked for comes back empty/absent, the page doesn't have that section — say so, don't invent it. If it returns ok:false with reason gated/error/empty, the page can't be watched — tell the user plainly, do NOT retry or invent a schema.",
  input: z.object({
    url: z.string().url(),
    intent: z.string().max(1000).optional(),
    breadth: z.enum(["focused", "broad"]).optional(),
  }),
  display: "schema-preview",
  execute: async (_ctx, args) => {
    const r = await inferOrFetch(args.url, args.intent, args.breadth ?? "focused");
    if (!r.ok) return { ok: false, reason: r.reason, detail: r.detail };
    return { ok: true, source: r.result.source, schema: r.result.schema, sourceUrl: args.url, extracted: sampleExtracted(r.result.extracted) };
  },
};

const createWatchTool: ToolDef<
  { url: string; intent?: string; intervalMinutes?: number; useSchema?: InferredSchema; breadth?: SchemaBreadth },
  | { ok: true; watchId: string; title: string; pageType: string; fieldCount: number; source: InferSource }
  | { ok: false; reason: string; detail: string }
> = {
  name: "create_watch",
  description:
    "Commit a new watch. Prefer to call preview_schema first and confirm the fields with the user before calling this. cadence defaults to 360 minutes (6 hours). Pass useSchema set to the schema returned by preview_schema to preserve the exact field set the user approved (only used for Gemini-inferred schemas; BD-scraper and JSON-LD paths always use their canonical schema).",
  input: z.object({
    url: z.string().url(),
    intent: z.string().max(1000).optional(),
    intervalMinutes: z.number().int().min(30).max(10080).optional(),
    useSchema: z.any().optional(),
    breadth: z.enum(["focused", "broad"]).optional(),
  }),
  display: "watch-created",
  execute: async (ctx, args) => {
    const interval = args.intervalMinutes ?? 360;

    // Don't silently create a duplicate. (Agent is told to check first, but
    // enforce it so a skipped check can't leave two watches on one url.)
    const [existing] = await db
      .select({ id: watches.id })
      .from(watches)
      .where(and(eq(watches.userId, ctx.userId), eq(watches.url, args.url)))
      .limit(1);
    if (existing) {
      return { ok: false, reason: "already_watching", detail: "You're already watching this page — I won't create a duplicate. Open or pause the existing watch instead." };
    }

    // Step 1: Try BD scraper first (deterministic, ignores useSchema).
    const bd = await tryBDScraper(args.url);
    let result: InferOrFetchResult | null = null;
    if (bd.ok) {
      result = {
        source: "bd_scraper",
        schema: bd.result.schema,
        extracted: bd.result.extracted,
        contentMarkdown: bd.result.contentMarkdown,
      };
    } else {
      // Step 2: BD native markdown (link-preserving) → LLM single-pass inference.
      const md = await fetchMarkdownCached(args.url);
      if (!md.ok) return { ok: false, reason: md.reason, detail: md.detail };
      // Don't create a watch on a login wall / error / empty page.
      const access = contentLooksUnwatchable(md.body);
      if (!access.ok) return { ok: false, reason: access.reason, detail: access.detail };
      if (args.useSchema && typeof args.useSchema === "object") {
        // Step 3a: User pre-approved a schema — extract values only.
        let extracted: Record<string, unknown> = {};
        try {
          extracted = await extractFields({ schema: args.useSchema as InferredSchema, markdown: md.body });
        } catch {
          extracted = {};
        }
        result = {
          source: "llm",
          schema: args.useSchema as InferredSchema,
          extracted,
          contentMarkdown: md.body,
        };
      } else {
        // Step 3b: Full LLM path (infer + extract).
        let schema: InferredSchema;
        try {
          schema = await inferSchema({ url: args.url, markdown: md.body, userIntent: args.intent, breadth: args.breadth ?? "focused" });
        } catch (e: unknown) {
          return { ok: false, reason: "inference_failed", detail: String((e as Error)?.message ?? e) };
        }
        let extracted: Record<string, unknown> = {};
        try {
          extracted = await extractFields({ schema, markdown: md.body });
        } catch {
          extracted = {};
        }
        result = { source: "llm", schema, extracted, contentMarkdown: md.body };
      }
    }

    const hash = await sha256(result.contentMarkdown);
    const watch = await db.transaction(async (tx) => {
      const [w] = await tx
        .insert(watches)
        .values({
          userId: ctx.userId,
          url: args.url,
          title: result.schema.title,
          pageType: result.schema.pageType,
          schema: result.schema,
          intervalMinutes: interval,
          status: "active",
          lastFetchedAt: new Date(),
          nextFetchAt: new Date(Date.now() + interval * 60_000),
        })
        .returning();
      await tx.insert(snapshots).values({
        watchId: w.id,
        userId: ctx.userId,
        contentHash: hash,
        contentMarkdown: result.contentMarkdown,
        extracted: result.extracted,
      });
      return w;
    });

    return {
      ok: true,
      watchId: watch.id,
      title: result.schema.title,
      pageType: result.schema.pageType,
      fieldCount: result.schema.fields.length,
      source: result.source,
    };
  },
};

const updateWatchTool: ToolDef<
  { watchId: string; intervalMinutes?: number; status?: "active" | "paused" },
  { ok: true; watchId: string; status: string; intervalMinutes: number } | { ok: false; reason: string }
> = {
  name: "update_watch",
  description:
    "Modify an existing watch — pause/resume or change the re-check cadence. Use list_watches first if you don't know the watchId.",
  input: z.object({
    watchId: z.string().uuid(),
    intervalMinutes: z.number().int().min(30).max(10080).optional(),
    status: z.enum(["active", "paused"]).optional(),
  }),
  display: "watch-updated",
  execute: async (ctx, args) => {
    const [existing] = await db
      .select()
      .from(watches)
      .where(and(eq(watches.id, args.watchId), eq(watches.userId, ctx.userId)))
      .limit(1);
    if (!existing) return { ok: false, reason: "not_found" };
    const updates: Partial<typeof watches.$inferInsert> = { updatedAt: new Date() };
    if (args.intervalMinutes) {
      updates.intervalMinutes = args.intervalMinutes;
      updates.nextFetchAt = new Date(Date.now() + args.intervalMinutes * 60_000);
    }
    if (args.status) updates.status = args.status;
    const [w] = await db
      .update(watches)
      .set(updates)
      .where(eq(watches.id, args.watchId))
      .returning();
    return { ok: true, watchId: w.id, status: w.status, intervalMinutes: w.intervalMinutes };
  },
};

const deleteWatchTool: ToolDef<
  { watchId: string },
  { ok: true; watchId: string } | { ok: false; reason: string }
> = {
  name: "delete_watch",
  description:
    "Permanently delete a watch and all of its history. Destructive — only call when the user has clearly asked to delete or stop watching something. Prefer pausing via update_watch first.",
  input: z.object({ watchId: z.string().uuid() }),
  display: "watch-deleted",
  execute: async (ctx, args) => {
    const r = await db
      .delete(watches)
      .where(and(eq(watches.id, args.watchId), eq(watches.userId, ctx.userId)))
      .returning({ id: watches.id });
    if (r.length === 0) return { ok: false, reason: "not_found" };
    return { ok: true, watchId: r[0].id };
  },
};

const fetchPageTool: ToolDef<
  { url: string },
  { ok: true; url: string; title: string | null; excerpt: string; length: number } | { ok: false; reason: string; detail: string }
> = {
  name: "fetch_page",
  description:
    "Fetch the live markdown of any URL (uses Bright Data, caches for 60s). Use this when you need to know what's on a page that isn't the current tab — for example, to compare two competitors. Returns the first ~3000 characters; full content is not returned to keep tokens bounded.",
  input: z.object({ url: z.string().url() }),
  display: "page-fetched",
  execute: async (_ctx, args) => {
    const r = await fetchMarkdownCached(args.url);
    if (!r.ok) return { ok: false, reason: r.reason, detail: r.detail };
    const firstLineMatch = r.body.match(/^#\s+(.+)$/m);
    const title = firstLineMatch ? firstLineMatch[1].trim() : null;
    return {
      ok: true,
      url: args.url,
      title,
      excerpt: r.body.slice(0, 3000),
      length: r.body.length,
    };
  },
};

/* ------------------------------------------------------------------ */
/* Registry                                                            */
/* ------------------------------------------------------------------ */

export const TOOLS: Record<string, ToolDef<unknown, unknown>> = {
  list_watches: listWatchesTool as ToolDef<unknown, unknown>,
  get_recent_changes: getRecentChangesTool as ToolDef<unknown, unknown>,
  get_watch_by_url: getWatchByUrlTool as ToolDef<unknown, unknown>,
  preview_schema: previewSchemaTool as ToolDef<unknown, unknown>,
  create_watch: createWatchTool as ToolDef<unknown, unknown>,
  update_watch: updateWatchTool as ToolDef<unknown, unknown>,
  delete_watch: deleteWatchTool as ToolDef<unknown, unknown>,
  fetch_page: fetchPageTool as ToolDef<unknown, unknown>,
};

export async function executeTool(
  name: string,
  rawArgs: unknown,
  ctx: ToolCtx,
): Promise<{ ok: true; display: ToolDef<unknown, unknown>["display"]; result: unknown } | { ok: false; display: "error"; result: { reason: string; detail: string } }> {
  const tool = TOOLS[name];
  if (!tool) {
    return { ok: false, display: "error", result: { reason: "unknown_tool", detail: `No tool named ${name}` } };
  }
  const parsed = tool.input.safeParse(rawArgs);
  if (!parsed.success) {
    return {
      ok: false,
      display: "error",
      result: { reason: "bad_args", detail: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") },
    };
  }
  try {
    const result = await tool.execute(ctx, parsed.data);
    return { ok: true, display: tool.display, result };
  } catch (e: unknown) {
    return {
      ok: false,
      display: "error",
      result: { reason: "execution_failed", detail: String((e as Error)?.message ?? e) },
    };
  }
}

// Re-export for tests / scripts
export { findBDRoute };
