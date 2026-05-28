"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { I } from "@/components/marketing/_p/Icons";
import {
  pauseWatch,
  resumeWatch,
  deleteWatch,
  updateCadence,
  rerunNow,
} from "./actions";
import { setWatchCollection } from "@/app/app/collections-actions";

interface Collection {
  id: string;
  name: string;
  color: string | null;
}

interface Props {
  watchId: string;
  status: string;
  intervalMinutes: number;
  url: string;
  collectionId: string | null;
  collections: Collection[];
}

const CADENCE_OPTIONS = [
  { label: "every 30 minutes", value: 30 },
  { label: "every 1 hour", value: 60 },
  { label: "every 6 hours", value: 360 },
  { label: "every 24 hours", value: 1440 },
  { label: "every 7 days", value: 10_080 },
];

export function SettingsTab({ watchId, status, intervalMinutes, url, collectionId, collections }: Props) {
  const router = useRouter();
  const [cadence, setCadence] = useState(intervalMinutes);
  const [coll, setColl] = useState<string | null>(collectionId);
  const [pending, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [phrase, setPhrase] = useState("");

  function onCadenceChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = parseInt(e.target.value, 10);
    setCadence(v);
    start(async () => {
      await updateCadence(watchId, v);
    });
  }

  function onPause() {
    start(async () => {
      if (status === "paused") await resumeWatch(watchId);
      else await pauseWatch(watchId);
      router.refresh();
    });
  }

  function onRerun() {
    start(async () => {
      await rerunNow(watchId);
      router.refresh();
    });
  }

  function onDelete() {
    start(async () => {
      await deleteWatch(watchId);
    });
  }

  return (
    <div>
      <div className="set-section">
        <div className="set-section-h">cadence</div>
        <div className="set-row">
          <div>
            <div className="set-row-k">Re-check interval</div>
            <div className="set-row-k-sub">
              How often uatchit fetches and compares. Faster = more API spend.
            </div>
          </div>
          <select className="set-select" value={cadence} onChange={onCadenceChange} disabled={pending}>
            {CADENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="set-row">
          <div>
            <div className="set-row-k">Re-check now</div>
            <div className="set-row-k-sub">Queue an immediate fetch for the next cron tick (within 60s).</div>
          </div>
          <button className="btn-ghost" onClick={onRerun} disabled={pending}>
            <I.Refresh width={12} height={12} /> Re-check
          </button>
        </div>
      </div>

      <div className="set-section">
        <div className="set-section-h">status</div>
        <div className="set-row">
          <div>
            <div className="set-row-k">{status === "paused" ? "Paused" : status === "error" ? "Errored" : "Active"}</div>
            <div className="set-row-k-sub">
              {status === "paused"
                ? "uatchit will not re-check this URL until you resume."
                : status === "error"
                ? "Last fetch failed. Retries continue on the normal cadence."
                : "uatchit is watching this URL on the cadence above."}
            </div>
          </div>
          <button className="btn-ghost" onClick={onPause} disabled={pending}>
            {status === "paused" ? <><I.Play width={12} height={12} /> Resume</> : <><I.Pause width={12} height={12} /> Pause</>}
          </button>
        </div>
      </div>

      <div className="set-section">
        <div className="set-section-h">collection</div>
        <div className="set-row">
          <div>
            <div className="set-row-k">Assign to collection</div>
            <div className="set-row-k-sub">
              {collections.length === 0
                ? "No collections yet. Create one from the sidebar to group related watches."
                : "Watches in a collection get filtered together on the dashboard."}
            </div>
          </div>
          <select
            className="set-select"
            value={coll ?? ""}
            disabled={pending || collections.length === 0}
            onChange={(e) => {
              const next = e.target.value || null;
              setColl(next);
              start(async () => {
                await setWatchCollection(watchId, next);
                router.refresh();
              });
            }}
          >
            <option value="">— none —</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="set-section">
        <div className="set-section-h">source</div>
        <div className="set-row" style={{ gridTemplateColumns: "1fr" }}>
          <div>
            <div className="set-row-k">URL</div>
            <div style={{ marginTop: 6, fontFamily: "'Geist Mono', monospace", fontSize: 12, color: "var(--text-dim)", wordBreak: "break-all" }}>
              {url}
            </div>
          </div>
        </div>
      </div>

      <div className="set-section set-danger">
        <div className="set-section-h">
          <I.Trash width={11} height={11} style={{ display: "inline", verticalAlign: -2, marginRight: 6 }} />
          Danger zone
        </div>
        <div className="set-row">
          <div>
            <div className="set-row-k">Delete this watch</div>
            <div className="set-row-k-sub">Removes the watch, every snapshot, and every change. There's no undo.</div>
          </div>
          <button className="btn-danger" onClick={() => setConfirmDelete(true)} disabled={pending}>
            <I.Trash width={12} height={12} /> Delete
          </button>
        </div>
      </div>

      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-h">Delete this watch?</h2>
            <p className="modal-sub">
              uatchit will forget every snapshot, every change, and stop re-checking the page. There is no undo.
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
              <button className="btn-ghost" onClick={() => setConfirmDelete(false)} disabled={pending}>
                Cancel
              </button>
              <button
                className="btn-danger"
                onClick={onDelete}
                disabled={pending || phrase.trim().toLowerCase() !== "delete"}
              >
                {pending ? "Deleting…" : "Delete watch"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
