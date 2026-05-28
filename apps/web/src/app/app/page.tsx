import { db } from "@/db";
import { watches, changes, snapshots, collections } from "@/db/schema";
import { eq, desc, and, gt, inArray } from "drizzle-orm";
import { requireUserId } from "@/lib/auth-helpers";
import { CreateWatchForm } from "@/components/CreateWatchForm";
import { I } from "@/components/marketing/_p/Icons";
import Link from "next/link";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { CollectionToolbar } from "@/components/dashboard/CollectionToolbar";

function faviconGradient(host: string): string {
  let hash = 0;
  for (let i = 0; i < host.length; i++) hash = (hash * 31 + host.charCodeAt(i)) | 0;
  const h1 = Math.abs(hash) % 360;
  const h2 = (h1 + 50) % 360;
  return `linear-gradient(135deg, oklch(58% 0.16 ${h1}), oklch(70% 0.14 ${h2}))`;
}

function hostOf(url: string): string {
  try { return new URL(url).host + new URL(url).pathname.replace(/\/$/, ""); } catch { return url; }
}

function cadenceLabel(m: number): string {
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.round(m / 60)}h`;
  return `${Math.round(m / 1440)}d`;
}

export default async function DashboardHome({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; collection?: string }>;
}) {
  const userId = await requireUserId();
  const sp = await searchParams;
  const filter = (sp.filter === "changed" || sp.filter === "paused") ? sp.filter : "all";
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const collectionId = sp.collection && UUID_RE.test(sp.collection) ? sp.collection : null;

  const rows = await db
    .select()
    .from(watches)
    .where(eq(watches.userId, userId))
    .orderBy(desc(watches.createdAt));

  // Active collection (for header label)
  let activeCollection: { id: string; name: string; color: string | null } | null = null;
  if (collectionId) {
    const [c] = await db
      .select({ id: collections.id, name: collections.name, color: collections.color })
      .from(collections)
      .where(and(eq(collections.id, collectionId), eq(collections.userId, userId)))
      .limit(1);
    if (c) activeCollection = c;
  }

  // Latest change per watch (used for chip count + change description per row)
  const recent = await db
    .select()
    .from(changes)
    .where(eq(changes.userId, userId))
    .orderBy(desc(changes.createdAt))
    .limit(50);
  const changeByWatch = new Map<string, { narration: string; createdAt: Date }>();
  for (const c of recent) {
    if (!changeByWatch.has(c.watchId)) {
      changeByWatch.set(c.watchId, { narration: c.narration, createdAt: c.createdAt });
    }
  }

  // Stats
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [changedThisWeek, fetchesThisMonth, sinceLastVisit, changesThisMonth] = await Promise.all([
    db
      .select({ id: changes.id })
      .from(changes)
      .where(and(eq(changes.userId, userId), gt(changes.createdAt, weekAgo)))
      .then((r) => r.length),
    db
      .select({ id: snapshots.id })
      .from(snapshots)
      .where(and(eq(snapshots.userId, userId), gt(snapshots.fetchedAt, monthStart)))
      .then((r) => r.length),
    db
      .select({ id: changes.id })
      .from(changes)
      .where(and(eq(changes.userId, userId), gt(changes.createdAt, yesterday)))
      .then((r) => r.length),
    db
      .select({ id: changes.id })
      .from(changes)
      .where(and(eq(changes.userId, userId), gt(changes.createdAt, monthStart)))
      .then((r) => r.length),
  ]);

  const signalDensity = fetchesThisMonth === 0
    ? "—"
    : (Math.round((changesThisMonth / fetchesThisMonth) * 100) / 100).toFixed(2);
  const signalDensityTrend = fetchesThisMonth === 0
    ? "no fetches yet"
    : changesThisMonth === 0
      ? "all quiet"
      : "stable";

  // Sparklines (last 13 days per watch)
  const sparkByWatch = new Map<string, number[]>();
  if (rows.length > 0) {
    const thirteenDaysAgo = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000);
    const sparkRows = await db
      .select({ watchId: snapshots.watchId, fetchedAt: snapshots.fetchedAt })
      .from(snapshots)
      .where(
        and(
          inArray(snapshots.watchId, rows.map((r) => r.id)),
          gt(snapshots.fetchedAt, thirteenDaysAgo),
        ),
      );

    const startOfDay = new Date(new Date().toDateString());
    const buckets = new Map<string, number[]>();
    for (const w of rows) buckets.set(w.id, new Array(13).fill(0));

    for (const s of sparkRows) {
      const ageDays = Math.floor(
        (startOfDay.getTime() - new Date(s.fetchedAt).setHours(0, 0, 0, 0)) /
          (24 * 60 * 60 * 1000),
      );
      const idx = 12 - ageDays;
      if (idx >= 0 && idx <= 12) {
        const arr = buckets.get(s.watchId);
        if (arr) arr[idx] += 1;
      }
    }
    for (const [id, arr] of buckets) {
      sparkByWatch.set(id, arr.every((v) => v === arr[0]) ? arr.map((v, i) => v + (i === 12 ? 1 : 0)) : arr);
    }
  }

  // Compose filtered list
  const filteredRows = rows.filter((w) => {
    if (collectionId && w.collectionId !== collectionId) return false;
    if (filter === "paused") return w.status === "paused";
    if (filter === "changed") return changeByWatch.has(w.id);
    return true;
  });

  // Header label
  const headerTitle = activeCollection
    ? activeCollection.name
    : "Good to see you.";
  const headerSub = activeCollection
    ? `${filteredRows.length} watch${filteredRows.length === 1 ? "" : "es"} in this collection.`
    : sinceLastVisit > 0
      ? `${sinceLastVisit} change${sinceLastVisit === 1 ? "" : "s"} in the last 24h · ${rows.length} watch${rows.length === 1 ? "" : "es"} running.`
      : rows.length > 0
        ? `${rows.length} watch${rows.length === 1 ? "" : "es"} running.`
        : "Let's start by watching your first page.";

  const filterBase = collectionId ? `/app?collection=${collectionId}` : "/app";
  const withFilter = (f: "all" | "changed" | "paused") => {
    const params = new URLSearchParams();
    if (collectionId) params.set("collection", collectionId);
    if (f !== "all") params.set("filter", f);
    const qs = params.toString();
    return `/app${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      <div className="top">
        <div style={{ minWidth: 0 }}>
          <h1 className="top-title">
            {activeCollection && (
              <span
                className="top-coll-dot"
                style={{ background: activeCollection.color ?? "var(--accent)" }}
                aria-hidden
              />
            )}
            {headerTitle}
          </h1>
          <div className="top-sub">{headerSub}</div>
        </div>
        <div className="top-actions">
          <div className="search">
            <I.Search width={14} height={14} />
            <input placeholder="Search watches, changes, schemas…" />
            <span className="kbd search-kbd">⌘K</span>
          </div>
          <button className="btn btn-ghost" aria-label="Notifications"><I.Bell width={13} height={13} /></button>
        </div>
      </div>

      <div className="stats">
        <Stat label="Active watches" icon={<I.Eye width={11} height={11} />} value={String(rows.filter((r) => r.status === "active").length)} trend={rows.length > 0 ? `${rows.length} total` : "none yet"} dim={rows.length === 0} />
        <Stat label="Changes detected" icon={<I.Trend width={11} height={11} />} value={String(changedThisWeek)} trend={changedThisWeek > 0 ? "this week" : "none yet"} dim={changedThisWeek === 0} />
        <Stat label="Avg signal density" icon={<I.Activity width={11} height={11} />} value={signalDensity} trend={signalDensityTrend} dim />
        <Stat label="Fetches this month" icon={<I.Refresh width={11} height={11} />} value={fetchesThisMonth.toLocaleString()} trend="of 3,000" dim />
      </div>

      {rows.length === 0 ? (
        <DashboardEmpty />
      ) : (
        <>
          {activeCollection && (
            <CollectionToolbar
              collection={activeCollection}
              watches={rows.map((w) => ({
                id: w.id,
                title: w.title,
                url: w.url,
                inCollection: w.collectionId === activeCollection.id,
              }))}
            />
          )}
          <div className="section-h">
            <div className="dash-section-title">
              {activeCollection ? `${activeCollection.name} watches` : "Your watches"}
            </div>
            <div className="section-h-tools">
              <Link href={withFilter("all")} className={`filter-btn ${filter === "all" ? "filter-btn-active" : ""}`}>all · {collectionId ? filteredRows.length : rows.length}</Link>
              <Link href={withFilter("changed")} className={`filter-btn ${filter === "changed" ? "filter-btn-active" : ""}`}>changed · {changeByWatch.size}</Link>
              <Link href={withFilter("paused")} className={`filter-btn ${filter === "paused" ? "filter-btn-active" : ""}`}>paused · {rows.filter((r) => r.status === "paused").length}</Link>
              <button className="filter-btn" type="button" title="More filters — coming soon">
                <I.Filter width={11} height={11} /> filter
              </button>
              {collectionId && (
                <Link href={filterBase} className="filter-btn" title="Clear collection filter">
                  <I.X width={11} height={11} /> clear
                </Link>
              )}
            </div>
          </div>

          {filteredRows.length === 0 ? (
            <FilteredEmpty
              filter={filter}
              collectionName={activeCollection?.name ?? null}
              backHref={filterBase}
            />
          ) : (
            <div className="watches">
              {filteredRows.map((w) => {
                const recentChange = changeByWatch.get(w.id);
                const host = hostOf(w.url);
                return (
                  <Link key={w.id} href={`/app/watches/${w.id}`} className={`watch ${w.status === "paused" ? "watch-paused" : ""}`}>
                    <div className="watch-fav" style={{ background: faviconGradient(host) }} />
                    <div className="watch-meta">
                      <div className="watch-row1">
                        <div className="watch-title">{w.title ?? host}</div>
                        {recentChange && <span className="watch-tag watch-tag-new">changed</span>}
                        {w.status === "error" && <span className="watch-tag watch-tag-breaking">error</span>}
                      </div>
                      <div className="watch-url">{host}</div>
                      <div className="watch-change">
                        {recentChange ? recentChange.narration : (
                          <em className="em-mute" style={{ color: "var(--text-dim)", fontStyle: "normal" }}>
                            {w.status === "paused" ? "Paused" : "No change since last check."}
                          </em>
                        )}
                      </div>
                    </div>
                    <div className="watch-cadence">
                      <I.Clock width={11} height={11} /> {cadenceLabel(w.intervalMinutes)}
                    </div>
                    <Sparkline data={sparkByWatch.get(w.id) ?? [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3]} />
                    <button className={`watch-status ${w.status === "paused" ? "watch-status-paused" : ""}`} aria-label="actions">
                      {w.status === "paused" ? <I.Play width={13} height={13} /> : <I.More width={14} height={14} />}
                    </button>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );
}

function Stat({ label, icon, value, trend, dim }: { label: string; icon: React.ReactNode; value: string; trend: string; dim?: boolean }) {
  return (
    <div className="stat">
      <div className="stat-label">{icon} {label}</div>
      <div className="stat-value">{value}</div>
      <div className={`stat-trend ${dim ? "dim" : ""}`}>{trend}</div>
    </div>
  );
}

function DashboardEmpty() {
  return (
    <div className="empty-card">
      <div className="empty-mark">
        <I.Eye width={28} height={28} />
      </div>
      <h2 className="empty-h">No watches yet</h2>
      <p className="empty-sub">
        Paste any public URL and uatchit will infer a schema in ~20 seconds. Then it watches forever, narrates changes in plain English, and pings you when something moves.
      </p>
      <div style={{ maxWidth: 480, margin: "0 auto", width: "100%" }}>
        <CreateWatchForm />
      </div>
      <p className="empty-tip">
        Or use the Chrome extension and right-click any page.
      </p>
    </div>
  );
}

function FilteredEmpty({
  filter,
  collectionName,
  backHref,
}: {
  filter: string;
  collectionName: string | null;
  backHref: string;
}) {
  const msg = collectionName && filter === "all"
    ? `No watches in “${collectionName}” yet.`
    : filter === "changed"
      ? "No changes detected in this view."
      : filter === "paused"
        ? "Nothing paused here."
        : "No watches match this filter.";
  return (
    <div className="empty-soft">
      <I.Check width={18} height={18} style={{ color: "var(--text-dim)" }} />
      <span>{msg}</span>
      <Link href={backHref} className="btn-ghost" style={{ marginLeft: "auto" }}>
        clear
      </Link>
    </div>
  );
}
