import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { watches, snapshots, changes, collections } from "@/db/schema";
import { and, eq, desc, isNull, asc } from "drizzle-orm";
import { requireUserId } from "@/lib/auth-helpers";
import type { InferredSchema } from "@/lib/infer-schema";
import { I } from "@/components/marketing/_p/Icons";
import { SchemaTab } from "./SchemaTab";
import { SettingsTab } from "./SettingsTab";
import { McpTab } from "./McpTab";
import { DataTab } from "./DataTab";
import {
  MarkSeenButton,
  CopyDiffButton,
  MarkAllSeenButton,
  HeaderActions,
} from "./TimelineActions";

type Tab = "timeline" | "data" | "schema" | "settings" | "mcp";
const VALID: Tab[] = ["timeline", "data", "schema", "settings", "mcp"];

function hostOf(url: string): string {
  try { return new URL(url).host; } catch { return url; }
}

function pathOf(url: string): string {
  try { return new URL(url).host + new URL(url).pathname.replace(/\/$/, ""); } catch { return url; }
}

function faviconGradient(host: string): string {
  let hash = 0;
  for (let i = 0; i < host.length; i++) hash = (hash * 31 + host.charCodeAt(i)) | 0;
  const h1 = Math.abs(hash) % 360;
  const h2 = (h1 + 50) % 360;
  return `linear-gradient(135deg, oklch(58% 0.18 ${h1}), oklch(70% 0.16 ${h2}))`;
}

function cadenceLabel(m: number): string {
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.round(m / 60)}h`;
  return `${Math.round(m / 1440)}d`;
}

function relTime(d: Date | null): { rel: string; abs: string } {
  if (!d) return { rel: "—", abs: "" };
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60_000);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  if (min < 1) return { rel: "just now", abs: time };
  if (min < 60) return { rel: `${min}m ago`, abs: time };
  const hr = Math.round(min / 60);
  if (hr < 24) return { rel: `${hr}h ago`, abs: time };
  const day = Math.round(hr / 24);
  if (day < 7) return { rel: `${day}d ago`, abs: time };
  return { rel: d.toLocaleDateString(), abs: time };
}

interface DiffField {
  kind: "changed" | "added" | "removed";
  before?: unknown;
  after?: unknown;
}

function renderVal(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "string") return `"${v}"`;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v).slice(0, 60);
}

function formatDiffText(narration: string, diff: Record<string, DiffField>): string {
  const lines = [narration, ""];
  for (const [key, f] of Object.entries(diff)) {
    if (f.kind === "changed") lines.push(`${key}: ${renderVal(f.before)} → ${renderVal(f.after)}`);
    else if (f.kind === "added") lines.push(`${key}: + ${renderVal(f.after)}`);
    else if (f.kind === "removed") lines.push(`${key}: - ${renderVal(f.before)}`);
  }
  return lines.join("\n");
}

export default async function WatchDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const userId = await requireUserId();
  const { id } = await params;
  const sp = await searchParams;
  const tab: Tab = VALID.includes(sp.tab as Tab) ? (sp.tab as Tab) : "timeline";

  const [watch] = await db
    .select()
    .from(watches)
    .where(and(eq(watches.id, id), eq(watches.userId, userId)))
    .limit(1);
  if (!watch) notFound();

  const recentSnapshots = await db
    .select()
    .from(snapshots)
    .where(eq(snapshots.watchId, id))
    .orderBy(desc(snapshots.fetchedAt))
    .limit(100);

  const recentChanges = await db
    .select()
    .from(changes)
    .where(eq(changes.watchId, id))
    .orderBy(desc(changes.createdAt))
    .limit(30);

  const totalSnapshotCount = await db
    .select({ id: snapshots.id })
    .from(snapshots)
    .where(eq(snapshots.watchId, id))
    .then((r) => r.length);

  const changedSnapIds = new Set(
    recentChanges.map((c) => c.toSnapshotId),
  );

  const unseenCount = await db
    .select({ id: changes.id })
    .from(changes)
    .where(and(eq(changes.watchId, id), eq(changes.userId, userId), isNull(changes.seenAt)))
    .then((r) => r.length);

  const userCollections = await db
    .select({ id: collections.id, name: collections.name, color: collections.color })
    .from(collections)
    .where(eq(collections.userId, userId))
    .orderBy(asc(collections.createdAt));

  const schema = watch.schema as InferredSchema;
  const host = hostOf(watch.url);
  const path = pathOf(watch.url);
  const mcpUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/mcp`;

  // Group changes by day
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
  const startOfWeek = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);

  const groups: Record<string, typeof recentChanges> = {
    Today: [],
    Yesterday: [],
    "Last week": [],
    Earlier: [],
  };
  for (const c of recentChanges) {
    if (c.createdAt >= startOfToday) groups.Today.push(c);
    else if (c.createdAt >= startOfYesterday) groups.Yesterday.push(c);
    else if (c.createdAt >= startOfWeek) groups["Last week"].push(c);
    else groups.Earlier.push(c);
  }

  const firstSnapshot = recentSnapshots[recentSnapshots.length - 1];
  const firstWatched = firstSnapshot?.fetchedAt ?? watch.createdAt;
  const daysWatched = Math.floor((Date.now() - firstWatched.getTime()) / (24 * 60 * 60 * 1000));
  const showQuietRow = recentSnapshots.length > recentChanges.length;

  const latestSnap = recentSnapshots[0];
  const latestExtracted = latestSnap?.extracted as Record<string, unknown> | undefined;

  return (
    <div className="wd-container">
      <div className="crumbs">
        <Link href="/app">Watches</Link>
        <span className="crumbs-sep">›</span>
        <span className="crumbs-current">{watch.title ?? host}</span>
      </div>

      <div className="head">
        <div className="head-fav" style={{ background: faviconGradient(host) }} />
        <div className="head-meta">
          <div className="head-row1">
            <div className="head-title">{watch.title ?? host}</div>
            {watch.status === "active" && (
              <span className="head-badge"><span className="head-badge-dot" /> watching</span>
            )}
            {watch.status === "paused" && (
              <span className="head-badge" style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-dim)" }}>
                <span className="head-badge-dot" style={{ background: "var(--text-faint)", boxShadow: "none" }} /> paused
              </span>
            )}
            {watch.status === "error" && (
              <span className="head-badge" style={{ background: "var(--rm-soft)", borderColor: "var(--rm)", color: "var(--rm)" }}>
                <span className="head-badge-dot" style={{ background: "var(--rm)" }} /> error
              </span>
            )}
          </div>
          <div className="head-url">
            <I.Globe width={13} height={13} />
            <a href={watch.url} target="_blank" rel="noreferrer">{path}</a>
            <I.ExternalLink width={11} height={11} />
          </div>
          <div className="head-meta-row mono">
            <span><I.Clock width={12} height={12} /> re-checks every {cadenceLabel(watch.intervalMinutes)}</span>
            <span><I.Refresh width={12} height={12} /> last · {relTime(watch.lastFetchedAt).rel}</span>
            <span><I.Activity width={12} height={12} /> {recentChanges.length} changes · {recentSnapshots.length} checks</span>
            <span><I.Bell width={12} height={12} /> email + mcp</span>
          </div>
        </div>
        <div className="head-actions">
          <HeaderActions watchId={watch.id} status={watch.status} />
        </div>
      </div>

      <div className="tabs">
        <Link href={`?tab=timeline`} className={`tab ${tab === "timeline" ? "active" : ""}`}>
          <I.Activity width={14} height={14} /> Timeline <span className="tab-count">{recentChanges.length}</span>
        </Link>
        <Link href={`?tab=data`} className={`tab ${tab === "data" ? "active" : ""}`}>
          <I.Layers width={14} height={14} /> Data <span className="tab-count">{totalSnapshotCount}</span>
        </Link>
        <Link href={`?tab=schema`} className={`tab ${tab === "schema" ? "active" : ""}`}>
          <I.Layers width={14} height={14} /> Schema <span className="tab-count">{schema.fields.length}</span>
        </Link>
        <Link href={`?tab=settings`} className={`tab ${tab === "settings" ? "active" : ""}`}>
          <I.Settings width={14} height={14} /> Settings
        </Link>
        <Link href={`?tab=mcp`} className={`tab ${tab === "mcp" ? "active" : ""}`}>
          <I.Key width={14} height={14} /> MCP
        </Link>
      </div>

      {tab === "timeline" && (
        <>
          <div className="wd-stats">
            <WdStat k="First watched" v={`${daysWatched}d ago`} />
            <WdStat k="Total changes" v={String(recentChanges.length)} />
            <WdStat k="Total fetches" v={String(recentSnapshots.length)} />
            <WdStat k="Cadence" v={cadenceLabel(watch.intervalMinutes)} />
            <WdStat k="Last fetch" v={relTime(watch.lastFetchedAt).rel} />
            <WdStat k="Schema" v={`${schema.fields.length} field${schema.fields.length === 1 ? "" : "s"}`} />
          </div>
          <div className="tl">
            {recentChanges.length > 0 && unseenCount > 0 && (
              <div style={{ marginBottom: 18, display: "flex", justifyContent: "flex-end" }}>
                <MarkAllSeenButton watchId={watch.id} unseenCount={unseenCount} />
              </div>
            )}
            {(["Today", "Yesterday", "Last week", "Earlier"] as const).map((day) => {
              const items = groups[day];
              if (items.length === 0) return null;
              return (
                <div key={day} className="tl-group">
                  <div className="tl-group-head">
                    <span className="tl-group-dot" /> {day}
                  </div>
                  {items.map((c, i) => {
                    const diff = c.diff as Record<string, DiffField>;
                    const fieldEntries = Object.entries(diff);
                    const featured = day === "Today" && i === 0;
                    return (
                      <div key={c.id} className="tl-item">
                        <div className="tl-marker"><span className="tl-marker-dot" /></div>
                        <div className={`change-card ${featured ? "change-card-featured" : ""}`}>
                          <div className="ch-head">
                            <div className="ch-narr">
                              <span className="ch-narr-mark"><I.Sparkles width={13} height={13} /></span>
                              <strong>{c.narration}</strong>
                            </div>
                            <div className="ch-time">
                              {relTime(c.createdAt).abs}<br />
                              <span style={{ color: "var(--text-faint)" }}>{relTime(c.createdAt).rel}</span>
                            </div>
                          </div>
                          {fieldEntries.length > 0 && (
                            <div className="ch-body" style={{ gridTemplateColumns: "1fr" }}>
                              <div className="ch-fields">
                                {fieldEntries.slice(0, 6).map(([key, change]) => (
                                  <ChangeFieldRow key={key} name={key} change={change} />
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="ch-foot">
                            <span>recheck #{recentSnapshots.length - i}</span>
                            <span>·</span>
                            <span>{fieldEntries.length} field{fieldEntries.length === 1 ? "" : "s"} changed</span>
                            <div className="ch-foot-actions">
                              <CopyDiffButton diffText={formatDiffText(c.narration, diff)} />
                              <a href={watch.url} target="_blank" rel="noreferrer" className="ch-foot-btn">
                                <I.ExternalLink width={11} height={11} /> Open page
                              </a>
                              <MarkSeenButton changeId={c.id} alreadySeen={!!c.seenAt} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {recentChanges.length === 0 && (
              <div className="tl-group">
                <div className="tl-group-head">
                  <span className="tl-group-dot" /> Today
                </div>
                <div className="tl-item">
                  <div className="tl-marker"><span className="tl-marker-dot tl-marker-dot-quiet" /></div>
                  <div className="change-card">
                    <div className="ch-quiet">
                      <I.Check width={14} height={14} />
                      <span>No changes detected yet — {recentSnapshots.length} check{recentSnapshots.length === 1 ? "" : "s"} so far.</span>
                      <span className="ch-quiet-time">{relTime(watch.lastFetchedAt).rel}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {showQuietRow && recentChanges.length > 0 && (
              <div className="tl-item">
                <div className="tl-marker"><span className="tl-marker-dot tl-marker-dot-quiet" /></div>
                <div className="change-card">
                  <div className="ch-quiet">
                    <I.Check width={14} height={14} />
                    <span>{recentSnapshots.length - recentChanges.length} no-change re-fetches</span>
                    <span className="ch-quiet-time">interleaved</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {tab === "data" && (
        <DataTab
          watchId={watch.id}
          watchTitle={watch.title ?? host}
          schema={schema}
          totalSnapshotCount={totalSnapshotCount}
          snapshots={recentSnapshots.map((s) => ({
            id: s.id,
            fetchedAt: s.fetchedAt.toISOString(),
            contentHash: s.contentHash,
            extracted: s.extracted as Record<string, unknown> | null,
            isChange: changedSnapIds.has(s.id),
          }))}
        />
      )}

      {tab === "schema" && (
        <div style={{ maxWidth: 880 }}>
          <SchemaTab schema={schema} latestExtracted={latestExtracted ?? null} />
        </div>
      )}

      {tab === "settings" && (
        <div style={{ maxWidth: 720 }}>
          <SettingsTab
            watchId={watch.id}
            status={watch.status}
            intervalMinutes={watch.intervalMinutes}
            url={watch.url}
            collectionId={watch.collectionId}
            collections={userCollections}
          />
        </div>
      )}

      {tab === "mcp" && (
        <div style={{ maxWidth: 880 }}>
          <McpTab watchId={watch.id} watchTitle={watch.title ?? host} mcpUrl={mcpUrl} />
        </div>
      )}
    </div>
  );
}

function WdStat({ k, v }: { k: string; v: string }) {
  return (
    <div className="wd-stat">
      <div className="wd-stat-k">{k}</div>
      <div className="wd-stat-v">{v}</div>
    </div>
  );
}

function ChangeFieldRow({ name, change }: { name: string; change: DiffField }) {
  return (
    <div className="field">
      <div className="field-key">{name}</div>
      <div className="field-vals">
        {change.kind === "changed" && (
          <>
            <span className="dv dv-rm">{renderVal(change.before)}</span>
            <I.ArrowRight width={11} height={11} style={{ color: "var(--text-faint)" }} />
            <span className="dv dv-add">{renderVal(change.after)}</span>
          </>
        )}
        {change.kind === "added" && <span className="dv dv-add">+ {renderVal(change.after)}</span>}
        {change.kind === "removed" && <span className="dv dv-rm">{renderVal(change.before)}</span>}
      </div>
    </div>
  );
}

