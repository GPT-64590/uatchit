import { useEffect, useRef, useState } from "react";
import { I } from "./Icons";
import { APP_URL } from "../lib/config";
import type { WatchSummary } from "../lib/chat-protocol";

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: keyof typeof I;
  run: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  watches: WatchSummary[];
  onSend: (msg: string) => void;
}

function hostOf(url: string): string {
  try { return new URL(url).host; } catch { return url; }
}

export function CmdK({ open, onClose, watches, onSend }: Props) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      requestAnimationFrame(() => ref.current?.focus());
    }
  }, [open]);

  if (!open) return null;

  const commands: Command[] = [
    {
      id: "open-dashboard",
      label: "Open dashboard",
      icon: "Layers",
      hint: "↗",
      run: () => window.open(`${APP_URL}/app`, "_blank", "noreferrer"),
    },
    {
      id: "new-watch",
      label: "New watch from current tab",
      icon: "Eye",
      run: () => onSend("Watch this page for me. Show me the schema first."),
    },
    {
      id: "whats-new",
      label: "What changed recently?",
      icon: "Sparkles",
      run: () => onSend("What changed across my watches recently?"),
    },
    {
      id: "list-watches",
      label: "List my watches",
      icon: "Layers",
      run: () => onSend("List all of my watches."),
    },
    {
      id: "settings",
      label: "Open settings",
      icon: "More",
      hint: "↗",
      run: () => window.open(`${APP_URL}/app/settings`, "_blank", "noreferrer"),
    },
    {
      id: "mcp",
      label: "Open mcp keys",
      icon: "Copy",
      hint: "↗",
      run: () => window.open(`${APP_URL}/app/settings/mcp`, "_blank", "noreferrer"),
    },
  ];

  const ql = q.trim().toLowerCase();
  const filteredCmds = ql ? commands.filter((c) => c.label.toLowerCase().includes(ql)) : commands;
  const filteredWatches = ql
    ? watches.filter((w) => (w.title ?? w.url).toLowerCase().includes(ql) || w.host.toLowerCase().includes(ql))
    : watches.slice(0, 5);

  type Row =
    | { kind: "cmd"; cmd: Command }
    | { kind: "watch"; w: WatchSummary };
  const rows: Row[] = [
    ...filteredCmds.map((c) => ({ kind: "cmd" as const, cmd: c })),
    ...filteredWatches.map((w) => ({ kind: "watch" as const, w })),
  ];

  function pick(idx: number) {
    const r = rows[idx];
    if (!r) return;
    if (r.kind === "cmd") r.cmd.run();
    else window.open(`${APP_URL}/app/watches/${r.w.id}`, "_blank", "noreferrer");
    onClose();
  }

  return (
    <div className="cmdk-overlay" onClick={onClose}>
      <div className="cmdk" onClick={(e) => e.stopPropagation()}>
        <div className="cmdk-input-row">
          <I.Sparkles width={13} height={13} />
          <input
            ref={ref}
            className="cmdk-input"
            placeholder="Search or run a command…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(rows.length - 1, a + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
              else if (e.key === "Enter") { e.preventDefault(); pick(active); }
            }}
          />
          <span className="cmdk-esc">esc</span>
        </div>
        <div className="cmdk-list">
          {filteredCmds.length > 0 && (
            <div className="cmdk-section">
              <div className="cmdk-section-h">Commands</div>
              {filteredCmds.map((c, i) => {
                const Icon = I[c.icon];
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`cmdk-row ${i === active ? "cmdk-row-active" : ""}`}
                    onClick={() => pick(i)}
                    onMouseEnter={() => setActive(i)}
                  >
                    <Icon width={13} height={13} />
                    <span className="cmdk-row-label">{c.label}</span>
                    {c.hint && <span className="cmdk-row-hint">{c.hint}</span>}
                  </button>
                );
              })}
            </div>
          )}
          {filteredWatches.length > 0 && (
            <div className="cmdk-section">
              <div className="cmdk-section-h">Watches</div>
              {filteredWatches.map((w, j) => {
                const i = filteredCmds.length + j;
                return (
                  <button
                    key={w.id}
                    type="button"
                    className={`cmdk-row ${i === active ? "cmdk-row-active" : ""}`}
                    onClick={() => pick(i)}
                    onMouseEnter={() => setActive(i)}
                  >
                    <I.Eye width={13} height={13} />
                    <span className="cmdk-row-label">{w.title ?? hostOf(w.url)}</span>
                    <span className="cmdk-row-hint mono">{w.host}</span>
                  </button>
                );
              })}
            </div>
          )}
          {rows.length === 0 && <div className="cmdk-empty">No matches.</div>}
        </div>
      </div>
    </div>
  );
}
