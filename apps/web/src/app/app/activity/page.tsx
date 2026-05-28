import Link from "next/link";
import { db } from "@/db";
import { changes, watches } from "@/db/schema";
import { and, eq, desc, lt, isNull } from "drizzle-orm";
import { requireUserId } from "@/lib/auth-helpers";
import { I } from "@/components/marketing/_p/Icons";

const PAGE_SIZE = 30;

function faviconGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const h1 = Math.abs(hash) % 360;
  const h2 = (h1 + 50) % 360;
  return `linear-gradient(135deg, oklch(58% 0.18 ${h1}), oklch(70% 0.16 ${h2}))`;
}

function hostOf(url: string): string {
  try { return new URL(url).host; } catch { return url; }
}

function relTime(d: Date): { rel: string; abs: string } {
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

function dayBucket(d: Date, today: Date, yesterday: Date, weekAgo: Date): string {
  if (d >= today) return "Today";
  if (d >= yesterday) return "Yesterday";
  if (d >= weekAgo) return "Last week";
  return "Earlier";
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; before?: string }>;
}) {
  const userId = await requireUserId();
  const sp = await searchParams;
  const filter = sp.filter === "unseen" ? "unseen" : "all";
  const beforeParam = sp.before;
  const before = beforeParam ? new Date(beforeParam) : null;

  const conditions = [eq(changes.userId, userId)];
  if (filter === "unseen") conditions.push(isNull(changes.seenAt));
  if (before && !isNaN(before.getTime())) conditions.push(lt(changes.createdAt, before));

  const rows = await db
    .select({
      id: changes.id,
      watchId: changes.watchId,
      narration: changes.narration,
      createdAt: changes.createdAt,
      seenAt: changes.seenAt,
      diff: changes.diff,
      url: watches.url,
      title: watches.title,
    })
    .from(changes)
    .innerJoin(watches, eq(changes.watchId, watches.id))
    .where(and(...conditions))
    .orderBy(desc(changes.createdAt))
    .limit(PAGE_SIZE + 1);

  const hasMore = rows.length > PAGE_SIZE;
  const items = rows.slice(0, PAGE_SIZE);
  const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;

  const unseenCount = await db
    .select({ id: changes.id })
    .from(changes)
    .where(and(eq(changes.userId, userId), isNull(changes.seenAt)))
    .then((r) => r.length);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
  const startOfWeek = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);

  type Item = (typeof items)[number];
  const groups: Record<string, Item[]> = { Today: [], Yesterday: [], "Last week": [], Earlier: [] };
  for (const it of items) {
    const b = dayBucket(it.createdAt, startOfToday, startOfYesterday, startOfWeek);
    groups[b].push(it);
  }

  return (
    <div className="wd-container act-page">
      <div className="crumbs">
        <Link href="/app">App</Link>
        <span className="crumbs-sep">›</span>
        <span className="crumbs-current">Activity</span>
      </div>

      <div className="act-page-h">
        <div>
          <h1 className="top-title">Activity</h1>
          <div className="top-sub">
            Every change uatchit has narrated for you{unseenCount > 0 ? ` · ${unseenCount} unseen` : ""}.
          </div>
        </div>
        <div className="act-page-filter">
          <Link
            href="/app/activity"
            className={`filter-btn ${filter === "all" ? "filter-btn-active" : ""}`}
          >
            all
          </Link>
          <Link
            href="/app/activity?filter=unseen"
            className={`filter-btn ${filter === "unseen" ? "filter-btn-active" : ""}`}
          >
            unseen{unseenCount > 0 ? ` · ${unseenCount}` : ""}
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="act-feed">
          <div className="act-empty">
            {filter === "unseen"
              ? "Nothing unseen. You're all caught up."
              : "No activity yet. uatchit will show changes here as they happen."}
          </div>
        </div>
      ) : (
        <>
          <div className="act-feed">
            {(["Today", "Yesterday", "Last week", "Earlier"] as const).map((day) => {
              const list = groups[day];
              if (list.length === 0) return null;
              return (
                <div key={day}>
                  <div className="act-day">{day} · {list.length}</div>
                  {list.map((it) => {
                    const host = hostOf(it.url);
                    const isUnseen = !it.seenAt;
                    const fieldCount = Object.keys((it.diff ?? {}) as Record<string, unknown>).length;
                    const t = relTime(it.createdAt);
                    return (
                      <Link
                        key={it.id}
                        href={`/app/watches/${it.watchId}`}
                        className="act-row"
                      >
                        {isUnseen && <span className="act-row-unread" />}
                        <div className="act-row-fav" style={{ background: faviconGradient(host) }} />
                        <div>
                          <div className="act-row-narr">
                            <strong>{it.title ?? host}</strong>
                            <span style={{ color: "var(--text-muted)" }}> — {it.narration}</span>
                          </div>
                          <div className="act-row-meta">
                            <span>{host}</span>
                            <span className="act-row-meta-sep">·</span>
                            <span>{fieldCount} field{fieldCount === 1 ? "" : "s"}</span>
                            <span className="act-row-meta-sep">·</span>
                            <span>{t.abs}</span>
                          </div>
                        </div>
                        <div className="act-row-time">{t.rel}</div>
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <div className="act-pager">
            <span>showing {items.length} item{items.length === 1 ? "" : "s"}</span>
            {nextCursor ? (
              <Link
                href={`/app/activity?${filter === "unseen" ? "filter=unseen&" : ""}before=${encodeURIComponent(nextCursor)}`}
                className="act-pager-btn"
              >
                older <I.ChevronRight width={11} height={11} />
              </Link>
            ) : (
              <span className="act-pager-btn" aria-disabled="true">no more</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
