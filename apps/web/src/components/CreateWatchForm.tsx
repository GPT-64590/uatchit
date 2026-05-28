"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function CreateWatchForm() {
  const [url, setUrl] = useState("");
  const [intent, setIntent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/watches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, intent: intent || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? data.error ?? "Failed");
        return;
      }
      setUrl("");
      setIntent("");
      router.refresh();
      router.push(`/app/watches/${data.watchId}`);
    });
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-border bg-surface backdrop-blur-card p-5 shadow-card"
    >
      <label className="block text-xs uppercase tracking-[0.04em] text-text-dim font-mono mb-2">
        Paste a URL to watch
      </label>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        type="url"
        required
        placeholder="https://stripe.com/pricing"
        className="w-full rounded-md bg-bg-2 border border-border-strong px-3 py-2.5 text-sm focus:outline-none focus:border-accent transition mb-3"
      />
      <label className="block text-xs uppercase tracking-[0.04em] text-text-dim font-mono mb-2">
        What to track <span className="text-text-faint normal-case lowercase">(optional)</span>
      </label>
      <textarea
        value={intent}
        onChange={(e) => setIntent(e.target.value)}
        placeholder="Notify me when any plan changes price or features"
        rows={2}
        className="w-full rounded-md bg-bg-2 border border-border-strong px-3 py-2.5 text-sm focus:outline-none focus:border-accent transition mb-3 resize-none"
      />
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-text-faint">
          {isPending ? "Inferring schema… this takes ~20s on a fresh page." : "AI infers what to track. You'll confirm."}
        </p>
        <button
          type="submit"
          disabled={isPending || !url}
          className="rounded-md bg-white text-bg-1 px-4 py-2 text-sm font-medium shadow-cta transition hover:bg-white/90 disabled:opacity-50"
        >
          {isPending ? "Watching…" : "Start watching"}
        </button>
      </div>
      {error && <p className="text-rm text-xs mt-2 font-mono">{error}</p>}
    </form>
  );
}
