"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { I } from "@/components/marketing/_p/Icons";
import type { InferredSchema } from "@/lib/infer-schema";

interface SnapshotRow {
  id: string;
  fetchedAt: string;       // ISO string from server
  contentHash: string;
  extracted: Record<string, unknown> | null;
  isChange: boolean;       // true if this snapshot produced a diff
}

interface Props {
  watchId: string;
  watchTitle: string;
  schema: InferredSchema;
  snapshots: SnapshotRow[];
  totalSnapshotCount: number;
}

type Range = "all" | "24h" | "7d" | "30d";

function renderCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v.length > 80 ? `${v.slice(0, 80)}…` : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v).slice(0, 80);
}

function relTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString();
}

function absTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString([], { year: "2-digit", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}

export function DataTab({ watchId, watchTitle, schema, snapshots, totalSnapshotCount }: Props) {
  const [range, setRange] = useState<Range>("all");
  const [onlyChanges, setOnlyChanges] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const now = Date.now();
    let cutoff: number | null = null;
    if (range === "24h") cutoff = now - 24 * 60 * 60 * 1000;
    else if (range === "7d") cutoff = now - 7 * 24 * 60 * 60 * 1000;
    else if (range === "30d") cutoff = now - 30 * 24 * 60 * 60 * 1000;
    return snapshots.filter((s) => {
      if (cutoff && new Date(s.fetchedAt).getTime() < cutoff) return false;
      if (onlyChanges && !s.isChange) return false;
      return true;
    });
  }, [snapshots, range, onlyChanges]);

  function exportHref(format: "json" | "ndjson" | "csv"): string {
    const params = new URLSearchParams({ format });
    if (range !== "all") params.set("range", range);
    if (onlyChanges) params.set("onlyChanges", "1");
    return `/api/watches/${watchId}/export?${params.toString()}`;
  }

  function copyJson() {
    void navigator.clipboard.writeText(
      JSON.stringify(
        filtered.map((s) => ({
          fetched_at: s.fetchedAt,
          snapshot_id: s.id,
          content_hash: s.contentHash,
          data: s.extracted,
        })),
        null,
        2,
      ),
    ).then(() => {
      setCopied("clip");
      window.setTimeout(() => setCopied(null), 1400);
    });
  }

  const fields = schema.fields;

  return (
    <div>
      <div className="data-bar">
        <div className="data-bar-filters">
          <div className="data-bar-label">range</div>
          <div className="data-bar-chips">
            {(["all", "24h", "7d", "30d"] as Range[]).map((r) => (
              <button
                key={r}
                type="button"
                className={`filter-btn ${range === r ? "filter-btn-active" : ""}`}
                onClick={() => setRange(r)}
              >
                {r}
              </button>
            ))}
          </div>
          <label className="data-bar-toggle">
            <input
              type="checkbox"
              checked={onlyChanges}
              onChange={(e) => setOnlyChanges(e.target.checked)}
            />
            <span>Only snapshots that changed</span>
          </label>
        </div>
        <div className="data-bar-actions">
          <button type="button" className="btn-ghost" onClick={copyJson}>
            {copied === "clip" ? <><I.Check width={12} height={12} /> Copied</> : <><I.Copy width={12} height={12} /> Copy JSON</>}
          </button>
          <a className="btn-ghost" href={exportHref("csv")} download>
            <I.ExternalLink width={12} height={12} /> .csv
          </a>
          <a className="btn-ghost" href={exportHref("ndjson")} download>
            <I.ExternalLink width={12} height={12} /> .ndjson
          </a>
          <a className="btn-primary" href={exportHref("json")} download>
            <I.ExternalLink width={12} height={12} /> Download JSON
          </a>
        </div>
      </div>

      <div className="data-meta mono">
        <span>{filtered.length} of {totalSnapshotCount} snapshot{totalSnapshotCount === 1 ? "" : "s"}</span>
        <span style={{ color: "var(--text-faint)" }}>·</span>
        <span>{fields.length} field{fields.length === 1 ? "" : "s"}</span>
        <span style={{ color: "var(--text-faint)" }}>·</span>
        <Link href={`?tab=mcp`} style={{ color: "var(--text-dim)" }}>
          MCP feed for the same data
        </Link>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-card" style={{ marginTop: 18 }}>
          <div className="empty-mark">
            <I.Layers width={28} height={28} />
          </div>
          <h2 className="empty-h">
            {snapshots.length === 0 ? "No snapshots yet" : "Nothing matches this filter"}
          </h2>
          <p className="empty-sub">
            {snapshots.length === 0
              ? `Once uatchit fetches ${watchTitle} the first time, every snapshot lands here as a structured row you can browse and download.`
              : "Try widening the range or turning off the Only-changes toggle."}
          </p>
        </div>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="data-col-time">fetched</th>
                {fields.map((f) => (
                  <th key={f.name}>
                    <span className="data-col-name">{f.name}</span>
                    <span className="data-col-type">{f.type}</span>
                  </th>
                ))}
                <th className="data-col-id">snapshot</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const ex = s.extracted ?? {};
                return (
                  <tr key={s.id} className={s.isChange ? "data-row-changed" : ""}>
                    <td className="data-col-time" title={absTime(s.fetchedAt)}>
                      {s.isChange && <span className="data-row-dot" aria-label="had a change" />}
                      <span>{relTime(s.fetchedAt)}</span>
                      <span className="data-abs">{absTime(s.fetchedAt)}</span>
                    </td>
                    {fields.map((f) => (
                      <td key={f.name}>
                        <span className="data-cell">{renderCell(ex[f.name])}</span>
                      </td>
                    ))}
                    <td className="data-col-id">
                      <span className="data-id mono">{s.id.slice(0, 8)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalSnapshotCount > snapshots.length && (
        <div className="data-foot mono">
          Showing the most recent {snapshots.length} of {totalSnapshotCount}. Use{" "}
          <a href={exportHref("json")} download>Download JSON</a> to get every row.
        </div>
      )}
    </div>
  );
}
