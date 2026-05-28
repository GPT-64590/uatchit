"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { I } from "@/components/marketing/_p/Icons";
import {
  renameCollection,
  deleteCollection,
  addWatchesToCollection,
  removeWatchesFromCollection,
} from "@/app/app/collections-actions";

interface Collection {
  id: string;
  name: string;
  color: string | null;
}

interface WatchOption {
  id: string;
  title: string | null;
  url: string;
  inCollection: boolean;
}

interface Props {
  collection: Collection;
  watches: WatchOption[];
}

function hostOf(u: string): string {
  try { return new URL(u).host; } catch { return u; }
}

export function CollectionToolbar({ collection, watches }: Props) {
  const [mode, setMode] = useState<null | "manage" | "add">(null);

  return (
    <>
      <div className="coll-bar">
        <button
          type="button"
          className="btn-ghost"
          onClick={() => setMode("add")}
        >
          <I.Plus width={13} height={13} /> Add watches
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => setMode("manage")}
        >
          <I.Settings width={13} height={13} /> Manage
        </button>
      </div>

      {mode === "add" && (
        <AddWatchesModal
          collection={collection}
          watches={watches}
          onClose={() => setMode(null)}
        />
      )}
      {mode === "manage" && (
        <ManageModal
          collection={collection}
          onClose={() => setMode(null)}
        />
      )}
    </>
  );
}

function AddWatchesModal({
  collection,
  watches,
  onClose,
}: {
  collection: Collection;
  watches: WatchOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(
    new Set(watches.filter((w) => w.inCollection).map((w) => w.id)),
  );
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function save() {
    const initial = new Set(watches.filter((w) => w.inCollection).map((w) => w.id));
    const toAdd = [...selected].filter((id) => !initial.has(id));
    const toRemove = [...initial].filter((id) => !selected.has(id));
    start(async () => {
      if (toAdd.length > 0) await addWatchesToCollection(collection.id, toAdd);
      if (toRemove.length > 0) await removeWatchesFromCollection(toRemove);
      onClose();
      router.refresh();
    });
  }

  const filtered = watches.filter((w) => {
    const hay = `${w.title ?? ""} ${w.url}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 560 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="modal-h">
          Add watches to <span style={{ color: collection.color ?? "var(--accent)" }}>{collection.name}</span>
        </h2>
        <p className="modal-sub">
          Pick which watches belong to this collection. Unchecked watches are removed from it.
        </p>

        <div className="set-input" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 11px" }}>
          <I.Search width={13} height={13} style={{ color: "var(--text-dim)" }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter watches…"
            style={{ background: "none", border: 0, outline: "none", flex: 1, color: "var(--text)", fontSize: 13, fontFamily: "inherit" }}
          />
        </div>

        <div className="coll-picker">
          {filtered.length === 0 ? (
            <div className="empty-soft" style={{ marginTop: 12 }}>
              {watches.length === 0
                ? "You don't have any watches yet."
                : "No watches match this filter."}
            </div>
          ) : filtered.map((w) => {
            const checked = selected.has(w.id);
            return (
              <label key={w.id} className={`coll-pick ${checked ? "coll-pick-on" : ""}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(w.id)}
                />
                <span className="coll-pick-meta">
                  <span className="coll-pick-title">{w.title ?? hostOf(w.url)}</span>
                  <span className="coll-pick-url">{hostOf(w.url)}</span>
                </span>
              </label>
            );
          })}
        </div>

        <div className="modal-foot" style={{ marginTop: 18 }}>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={save} disabled={pending}>
            {pending ? "Saving…" : `Save (${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}

function ManageModal({
  collection,
  onClose,
}: {
  collection: Collection;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(collection.name);
  const [phase, setPhase] = useState<"edit" | "deleting">("edit");
  const [phrase, setPhrase] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (name.trim() === collection.name) {
      onClose();
      return;
    }
    start(async () => {
      const r = await renameCollection(collection.id, name);
      if ("error" in r) {
        setErr(r.error);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  function onDelete() {
    start(async () => {
      await deleteCollection(collection.id);
      onClose();
      router.push("/app");
      router.refresh();
    });
  }

  if (phase === "deleting") {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h2 className="modal-h">Delete “{collection.name}”?</h2>
          <p className="modal-sub">
            Watches inside this collection stay; they just lose the grouping.
            There is no undo for the collection itself.
          </p>
          <label className="new-label">
            Type <code style={{ color: "var(--rm)", fontFamily: "'Geist Mono', monospace" }}>delete</code> to confirm
          </label>
          <input
            className="set-input set-input-mono"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            autoFocus
          />
          <div className="modal-foot" style={{ marginTop: 18 }}>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => { setPhase("edit"); setPhrase(""); }}
              disabled={pending}
            >
              Back
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={onDelete}
              disabled={pending || phrase.trim().toLowerCase() !== "delete"}
            >
              {pending ? "Deleting…" : "Delete collection"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal" onSubmit={onSave} onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-h">Manage collection</h2>
        <p className="modal-sub">
          Rename, or delete to ungroup these watches.
        </p>
        <label className="new-label">Name</label>
        <input
          className="set-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          maxLength={40}
        />
        {err && <div className="new-err">{err}</div>}
        <div className="modal-foot" style={{ marginTop: 20, justifyContent: "space-between" }}>
          <button
            type="button"
            className="btn-danger"
            onClick={() => setPhase("deleting")}
            disabled={pending}
          >
            <I.Trash width={12} height={12} /> Delete
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn-ghost" onClick={onClose} disabled={pending}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={pending || !name.trim()}>
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
