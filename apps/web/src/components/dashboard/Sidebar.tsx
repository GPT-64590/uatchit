"use client";
import { useEffect, useState, useRef, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { I } from "@/components/marketing/_p/Icons";
import { createCollection } from "@/app/app/collections-actions";

interface CollectionRow {
  id: string;
  name: string;
  color: string | null;
  count: number;
}

interface Props {
  watchCount: number;
  activityCount: number;
  mcpCount: number;
  userName: string;
  userInitials: string;
  collections: CollectionRow[];
  logoutAction: () => Promise<void>;
}

const STORAGE_KEY = "uatchit-sidebar-collapsed";

const COLLECTION_COLORS = [
  "oklch(72% 0.14 245)", // blue (accent)
  "oklch(72% 0.18 18)",  // rose
  "oklch(78% 0.16 80)",  // amber
  "oklch(78% 0.16 152)", // green
  "oklch(64% 0.20 300)", // violet
];

export function Sidebar({
  watchCount,
  activityCount,
  mcpCount,
  userName,
  userInitials,
  collections,
  logoutAction,
}: Props) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [popOpen, setPopOpen] = useState(false);
  const [collModal, setCollModal] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);

  // Read persisted collapse state once
  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (stored === "1") setCollapsed(true);
    setMounted(true);
  }, []);

  // Persist + toggle parent .app's class
  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    const app = document.querySelector(".app");
    if (app) app.classList.toggle("app-collapsed", collapsed);
  }, [collapsed, mounted]);

  // Close popover on outside click / Esc
  useEffect(() => {
    if (!popOpen) return;
    function onDown(e: MouseEvent) {
      if (!popRef.current?.contains(e.target as Node)) setPopOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPopOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [popOpen]);

  // Cmd/Ctrl+B toggles the sidebar
  useEffect(() => {
    if (!mounted) return;
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        setCollapsed((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mounted]);

  function isActive(href: string, exact = false): boolean {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  const activeCollectionId = sp?.get("collection") ?? null;

  return (
    <aside className="sb">
      <div className="sb-brand">
        <span className="sb-brand-mark"><I.Logo width={20} height={20} /></span>
        <span className="sb-brand-label">uatchit</span>
        <span className="sb-brand-tag">beta</span>
        <button
          type="button"
          className="sb-collapse"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={`${collapsed ? "Expand" : "Collapse"} sidebar · ⌘B`}
        >
          <I.PanelLeft width={14} height={14} />
        </button>
      </div>

      <Link href="/app/new" className="sb-new" data-tip="New watch">
        <I.Plus width={14} height={14} />
        <span className="sb-new-label">New watch</span>
        <span className="sb-new-kbd">⌘N</span>
      </Link>

      <div className="sb-section">
        <div className="sb-section-label">Workspace</div>
        <Link
          className={`sb-link ${pathname === "/app" && !activeCollectionId ? "active" : ""}`}
          href="/app"
          data-tip="Watches"
        >
          <I.Eye width={15} height={15} />
          <span className="sb-link-label">Watches</span>
          <span className="sb-link-count">{watchCount}</span>
        </Link>
        <Link
          className={`sb-link ${isActive("/app/activity") ? "active" : ""}`}
          href="/app/activity"
          data-tip="Activity"
        >
          <I.Activity width={15} height={15} />
          <span className="sb-link-label">Activity</span>
          {activityCount > 0 && <span className="sb-link-count">{activityCount}</span>}
        </Link>
        <Link
          className={`sb-link ${isActive("/app/settings/mcp") ? "active" : ""}`}
          href="/app/settings/mcp"
          data-tip="MCP keys"
        >
          <I.Key width={15} height={15} />
          <span className="sb-link-label">MCP keys</span>
          {mcpCount > 0 && <span className="sb-link-count">{mcpCount}</span>}
        </Link>
        <Link
          className={`sb-link ${isActive("/app/settings", true) ? "active" : ""}`}
          href="/app/settings"
          data-tip="Settings"
        >
          <I.Settings width={15} height={15} />
          <span className="sb-link-label">Settings</span>
        </Link>
      </div>

      <div className="sb-section">
        {collections.length > 0 && (
          <div className="sb-section-label">Collections</div>
        )}
        {collections.map((c, i) => {
          const color = c.color ?? COLLECTION_COLORS[i % COLLECTION_COLORS.length];
          return (
            <Link
              key={c.id}
              className={`sb-link ${activeCollectionId === c.id ? "active" : ""}`}
              href={`/app?collection=${c.id}`}
              data-tip={c.name}
            >
              <span className="sb-coll-dot" style={{ background: color }} aria-hidden />
              <span className="sb-link-label">{c.name}</span>
              {c.count > 0 && <span className="sb-link-count">{c.count}</span>}
            </Link>
          );
        })}
        <button
          type="button"
          className="sb-link sb-link-add"
          onClick={() => setCollModal(true)}
          data-tip={collections.length === 0 ? "Create your first collection" : "New collection"}
        >
          <I.Plus width={15} height={15} />
          <span className="sb-link-label">
            {collections.length === 0 ? "New collection" : "New collection"}
          </span>
        </button>
      </div>

      <div className="sb-foot" ref={popRef}>
        <button
          type="button"
          className="sb-foot-avatar"
          title={collapsed ? `${userName} · account` : userName}
          onClick={() => collapsed && setPopOpen((v) => !v)}
          aria-label={collapsed ? "Account menu" : undefined}
          aria-expanded={collapsed ? popOpen : undefined}
          tabIndex={collapsed ? 0 : -1}
        >
          {userInitials}
        </button>
        <div className="sb-foot-text">
          <div className="sb-foot-name">{userName}</div>
        </div>
        <button
          type="button"
          className="sb-foot-more"
          onClick={() => setPopOpen((v) => !v)}
          aria-label="Account menu"
          aria-expanded={popOpen}
        >
          <I.More width={13} height={13} />
        </button>
        {popOpen && (
          <div className="sb-pop" role="menu">
            {/* Theme toggle parked during beta — see ThemeProvider.tsx */}
            <form action={logoutAction}>
              <button type="submit" className="sb-pop-row sb-pop-row-danger" style={{ width: "100%" }}>
                <I.ExternalLink width={13} height={13} /> Sign out
              </button>
            </form>
          </div>
        )}
      </div>

      {collModal && (
        <NewCollectionModal
          onCancel={() => setCollModal(false)}
          onCreated={(id) => {
            setCollModal(false);
            router.push(`/app?collection=${id}`);
            router.refresh();
          }}
        />
      )}
    </aside>
  );
}

function NewCollectionModal({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLLECTION_COLORS[0]);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    start(async () => {
      const r = await createCollection(name, color);
      if ("error" in r) {
        setErr(r.error);
        return;
      }
      onCreated(r.id);
    });
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2 className="modal-h">New collection</h2>
        <p className="modal-sub">
          Group related watches together. You can move watches into collections from the watch detail page.
        </p>
        <label className="new-label">Name</label>
        <input
          className="set-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Competitors"
          autoFocus
          maxLength={40}
        />
        <label className="new-label" style={{ marginTop: 14 }}>Color</label>
        <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
          {COLLECTION_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="coll-swatch"
              aria-label={`Color ${c}`}
              aria-pressed={color === c}
              style={{ background: c, outline: color === c ? "2px solid var(--text)" : "none", outlineOffset: 2 }}
            />
          ))}
        </div>
        {err && <div className="new-err">{err}</div>}
        <div className="modal-foot" style={{ marginTop: 20 }}>
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={pending || !name.trim()}>
            {pending ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}
