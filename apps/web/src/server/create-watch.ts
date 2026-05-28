import "server-only";
import { db } from "@/db";
import { watches, snapshots } from "@/db/schema";
import { bdFetchWithRetry } from "@/lib/brightdata";
import { inferSchema } from "@/lib/infer-schema";
import { extractFields, sha256 } from "@/lib/extract";

export interface CreateWatchInput {
  userId: string;
  url: string;
  intent?: string;
  intervalMinutes?: number;
}

export interface CreateWatchOk {
  ok: true;
  watchId: string;
  pageType: string;
  fieldCount: number;
  durationMs: number;
}
export interface CreateWatchErr {
  ok: false;
  reason: string;
  detail: string;
}

export async function createWatch(
  input: CreateWatchInput
): Promise<CreateWatchOk | CreateWatchErr> {
  const started = Date.now();
  const interval = input.intervalMinutes ?? 360;

  const bd = await bdFetchWithRetry({
    url: input.url,
    format: "markdown",
    fallbackToBrowser: true,
  });
  if (!bd.ok) return { ok: false, reason: bd.reason, detail: bd.detail };

  let schema;
  try {
    schema = await inferSchema({ url: input.url, markdown: bd.body, userIntent: input.intent });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return { ok: false, reason: "inference_failed", detail: String(err?.message ?? e) };
  }

  let extracted: Record<string, unknown>;
  try {
    extracted = await extractFields({ schema, markdown: bd.body });
  } catch {
    extracted = {};
  }

  const hash = await sha256(bd.body);
  const result = await db.transaction(async (tx) => {
    const [watch] = await tx.insert(watches).values({
      userId: input.userId,
      url: input.url,
      title: schema.title,
      pageType: schema.pageType,
      schema: schema,
      intervalMinutes: interval,
      status: "active",
      lastFetchedAt: new Date(),
      nextFetchAt: new Date(Date.now() + interval * 60_000),
    }).returning();

    await tx.insert(snapshots).values({
      watchId: watch.id,
      userId: input.userId,
      contentHash: hash,
      contentMarkdown: bd.body,
      extracted,
      bdDurationMs: bd.durationMs,
      bdZone: bd.zone,
    });

    return watch;
  });

  return {
    ok: true,
    watchId: result.id,
    pageType: schema.pageType,
    fieldCount: schema.fields.length,
    durationMs: Date.now() - started,
  };
}
