"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { I } from "@/components/marketing/_p/Icons";

const CADENCE_OPTIONS = [
  { label: "every 30 min", value: 30 },
  { label: "every 1 hour", value: 60 },
  { label: "every 6 hours", value: 360 },
  { label: "every 24 hours", value: 1440 },
  { label: "every 7 days", value: 10_080 },
];

export function NewWatchForm() {
  const [url, setUrl] = useState("");
  const [intent, setIntent] = useState("");
  const [interval, setIntervalMin] = useState(360);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await fetch("/api/watches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          intent: intent || undefined,
          intervalMinutes: interval,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? data.error ?? "Failed to create watch");
        return;
      }
      router.refresh();
      router.push(`/app/watches/${data.watchId}`);
    });
  }

  return (
    <form className="new-card" onSubmit={submit}>
      <span className="new-eyebrow">new watch</span>
      <h1 className="new-h">What should uatchit watch?</h1>
      <p className="new-sub">
        Paste a URL. uatchit will fetch the page, infer a schema, and watch it on the cadence you choose.
      </p>

      <div style={{ marginBottom: 14 }}>
        <label className="new-label">Page url</label>
        <input
          type="url"
          required
          placeholder="https://stripe.com/pricing"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="set-input set-input-mono"
          autoFocus
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label className="new-label">
          What to track <span style={{ color: "var(--text-faint)", textTransform: "none", letterSpacing: 0 }}>(optional)</span>
        </label>
        <textarea
          rows={3}
          placeholder="Notify me when any plan changes price or features."
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          className="set-input new-textarea"
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label className="new-label">Re-check cadence</label>
        <select
          value={interval}
          onChange={(e) => setIntervalMin(parseInt(e.target.value, 10))}
          className="set-select"
          style={{ width: "100%", padding: "10px 36px 10px 12px", fontSize: 13, fontFamily: "Geist" }}
        >
          {CADENCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="new-tip">
        <I.Info width={14} height={14} />
        <span>
          uatchit uses Bright Data Web Unlocker for resilient fetches and Gemini Flash-Lite to infer a schema. First fetch takes ~20s; subsequent re-checks are faster.
        </span>
      </div>

      {error && <div className="new-err">{error}</div>}

      <div className="new-foot">
        <span className="new-foot-status">
          {pending ? "Inferring schema… ~20s" : "You'll confirm the schema after creation."}
        </span>
        <button type="submit" className="btn-primary" disabled={pending || !url}>
          {pending ? "Watching…" : <>Start watching <I.ArrowRight width={13} height={13} /></>}
        </button>
      </div>
    </form>
  );
}
