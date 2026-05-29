import "./style.css";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { I } from "./components/Icons";
import { APP_URL } from "./lib/config";
import { CmdK } from "./components/CmdK";
import { AttachMenu, type AttachKind } from "./components/AttachMenu";
import { SignInForm } from "./components/SignInForm";
import { OtpForm } from "./components/OtpForm";
import {
  readNdjsonStream,
  type AgentEvent,
  type InferredSchemaShape,
  type ChangeSummary,
  type WatchSummary,
} from "./lib/chat-protocol";

interface NewsItem {
  id: string;
  watchId: string;
  narration: string;
  createdAt: string;
  seenAt: string | null;
  fieldCount: number;
  title: string | null;
  host: string;
}
import { extractActiveTab, toMarkdown, type ExtractedPage } from "./lib/page-extract";

const AUTH_TIMEOUT_MS = 3000;

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type AuthState =
  | { kind: "loading" }
  | { kind: "anon" }
  | { kind: "magic-link-sent"; email: string }
  | { kind: "signed-in"; email: string }
  | { kind: "error"; detail: string };

interface ActiveTab {
  url: string;
  title?: string;
}

type WatchState =
  | { kind: "checking" }
  | { kind: "idle" }
  | { kind: "watching"; watch: WatchStateRecord }
  | { kind: "paused"; watch: WatchStateRecord }
  | { kind: "error"; watch: WatchStateRecord };

interface WatchStateRecord {
  id: string;
  title: string | null;
  status: string;
  intervalMinutes: number;
  changeCount: number;
  snapshotCount: number;
  unseenCount: number;
  lastFetchedAt: string | null;
}

type Msg =
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "model"; text: string }
  | {
      id: string;
      kind: "tool_pending";
      callId: string;
      name: string;
      args: Record<string, unknown>;
    }
  | {
      id: string;
      kind: "tool_result";
      callId: string;
      name: string;
      display: string;
      ok: boolean;
      result: unknown;
    }
  | { id: string; kind: "event"; text: string; href?: string }
  | { id: string; kind: "error"; text: string };

interface Intent {
  kind: "page";
  url?: string;
  title?: string;
  selection?: string | null;
  timestamp: number;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function uid(): string { return crypto.randomUUID(); }

function safeHost(url: string): string | null {
  try { return new URL(url).host; } catch { return null; }
}

function gradientFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const h1 = Math.abs(h) % 360;
  const h2 = (h1 + 50) % 360;
  return `linear-gradient(135deg, oklch(58% 0.18 ${h1}), oklch(70% 0.16 ${h2}))`;
}

function cadenceLabel(m: number): string {
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.round(m / 60)}h`;
  return `${Math.round(m / 1440)}d`;
}

function relTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

async function asyncSendMessage<T>(msg: unknown, timeoutMs = AUTH_TIMEOUT_MS): Promise<T | null> {
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      resolve(null);
    }, timeoutMs);
    try {
      chrome.runtime.sendMessage(msg, (resp: T) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (chrome.runtime.lastError) resolve(null);
        else resolve(resp ?? null);
      });
    } catch {
      done = true;
      clearTimeout(timer);
      resolve(null);
    }
  });
}

async function getActiveTab(): Promise<ActiveTab | null> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const t = tabs[0];
    if (t?.url) return { url: t.url, title: t.title };
  } catch {}
  return null;
}

// Read WITHOUT consuming. The caller clears it (clearPendingIntent) only after
// the intent is actually dispatched, so a boot that's cancelled or errors before
// dispatch leaves the intent in storage for the next open to recover — previously
// it was removed up-front and the watch trigger silently failed with no feedback.
async function readPendingIntent(): Promise<Intent | null> {
  try {
    const result = await chrome.storage.local.get("pending-intent");
    const i = result["pending-intent"];
    if (!i || typeof i !== "object") return null;
    return i as Intent;
  } catch {
    return null;
  }
}

async function clearPendingIntent(): Promise<void> {
  try { await chrome.storage.local.remove("pending-intent"); } catch {}
}

async function fetchWatchState(url: string): Promise<WatchState> {
  try {
    const res = await fetch(`${APP_URL}/api/watches/by-url?url=${encodeURIComponent(url)}`, { credentials: "include" });
    if (!res.ok) return { kind: "idle" };
    const data = await res.json();
    if (!data.watched) return { kind: "idle" };
    const w = data.watch as WatchStateRecord;
    if (w.status === "paused") return { kind: "paused", watch: w };
    if (w.status === "error") return { kind: "error", watch: w };
    return { kind: "watching", watch: w };
  } catch {
    return { kind: "idle" };
  }
}

/* Derive watch state for a URL from the already-loaded watch list — NO server
 * call. Used on tab switches so we don't phone home every URL the user visits.
 * Counts are 0 here; full detail is fetched only on deliberate actions. */
function localWatchState(url: string, watches: WatchSummary[]): WatchState {
  const w = watches.find((x) => x.url === url);
  if (!w) return { kind: "idle" };
  const rec: WatchStateRecord = {
    id: w.id,
    title: w.title,
    status: w.status,
    intervalMinutes: w.intervalMinutes,
    changeCount: 0,
    snapshotCount: 0,
    unseenCount: 0,
    lastFetchedAt: w.lastFetchedAt,
  };
  if (w.status === "paused") return { kind: "paused", watch: rec };
  if (w.status === "error") return { kind: "error", watch: rec };
  return { kind: "watching", watch: rec };
}

/* ------------------------------------------------------------------ */
/* Wire-history conversion                                             */
/* ------------------------------------------------------------------ */

type WireMessage =
  | { role: "user"; text: string }
  | { role: "model"; text?: string; toolCalls?: Array<{ id: string; name: string; args: Record<string, unknown> }> }
  | { role: "tool"; results: Array<{ id: string; name: string; ok: boolean; result: unknown }> };

function msgsToWire(msgs: Msg[]): WireMessage[] {
  const out: WireMessage[] = [];
  let modelBuf: { text: string; toolCalls: Array<{ id: string; name: string; args: Record<string, unknown> }> } | null = null;
  let toolBuf: Array<{ id: string; name: string; ok: boolean; result: unknown }> = [];

  function flushModel() {
    if (modelBuf && (modelBuf.text || modelBuf.toolCalls.length)) {
      const wire: WireMessage = { role: "model" };
      if (modelBuf.text) wire.text = modelBuf.text;
      if (modelBuf.toolCalls.length) wire.toolCalls = modelBuf.toolCalls;
      out.push(wire);
    }
    modelBuf = null;
  }
  function flushTool() {
    if (toolBuf.length) {
      out.push({ role: "tool", results: toolBuf });
      toolBuf = [];
    }
  }

  for (const m of msgs) {
    if (m.kind === "user") {
      flushModel(); flushTool();
      out.push({ role: "user", text: m.text });
    } else if (m.kind === "model") {
      flushTool();
      if (!modelBuf) modelBuf = { text: "", toolCalls: [] };
      modelBuf.text = (modelBuf.text + m.text).slice(0, 8000);
    } else if (m.kind === "tool_pending") {
      flushTool();
      if (!modelBuf) modelBuf = { text: "", toolCalls: [] };
      modelBuf.toolCalls.push({ id: m.callId, name: m.name, args: m.args });
    } else if (m.kind === "tool_result") {
      // If this result has no matching pending in the current model buffer,
      // synthesize one — Gemini requires a model functionCall before every
      // tool functionResponse. (Happens for picker-injected schemas.)
      const hasMatchingCall = modelBuf?.toolCalls.some((tc) => tc.id === m.callId);
      if (!hasMatchingCall) {
        if (!modelBuf) modelBuf = { text: "", toolCalls: [] };
        modelBuf.toolCalls.push({ id: m.callId, name: m.name, args: {} });
      }
      flushModel();
      toolBuf.push({ id: m.callId, name: m.name, ok: m.ok, result: m.result });
    }
    // event/error are presentation-only
  }
  flushModel(); flushTool();
  return out;
}

/* ------------------------------------------------------------------ */
/* Main panel                                                          */
/* ------------------------------------------------------------------ */

export default function SidePanel() {
  const [auth, setAuth] = useState<AuthState>({ kind: "loading" });
  const [activeTab, setActiveTab] = useState<ActiveTab | null>(null);
  /* The page THIS watch conversation is about. Pinned when a watch flow
   * starts (right-click / "watch this page") and frozen across turns — so a
   * clarifying-question answer targets the original page, not whatever tab the
   * user wandered to. Cleared when the watch is created or a new flow starts. */
  const [subject, setSubject] = useState<{ url: string; title?: string; markdown?: string } | null>(null);
  const [watchState, setWatchState] = useState<WatchState>({ kind: "checking" });
  const [pageExtract, setPageExtract] = useState<ExtractedPage | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [text, setText] = useState("");
  const [fatal, setFatal] = useState<string | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachments, setAttachments] = useState<{ page: boolean; selection: string | null }>({ page: false, selection: null });
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [allWatches, setAllWatches] = useState<WatchSummary[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  const msgsRef = useRef<Msg[]>([]);
  /* Tracks last-processed pending-intent timestamp so the boot path
   * and the runtime-message path can't double-fire the same intent. */
  const lastIntentTsRef = useRef<number>(0);
  /* Tracks the currently active tab url so a tab-switch listener can
   * detect a real change (and emit a "now looking at" event row). */
  const activeTabUrlRef = useRef<string | null>(null);
  /* Tracks last user-submitted text + timestamp for the duplicate-submit
   * guard (Enter double-fire / race during streaming kickoff). */
  const lastSendRef = useRef<{ text: string; ts: number }>({ text: "", ts: 0 });
  /* Latest auth, readable from listeners/handlers without stale closures. */
  const authRef = useRef<AuthState>(auth);
  /* A watch intent that arrived while signed-out — replayed after sign-in. */
  const pendingIntentRef = useRef<{ intent: Intent; tab: ActiveTab | null } | null>(null);
  /* Latest watch list, for client-side watch-state matching on tab switches. */
  const allWatchesRef = useRef<WatchSummary[]>(allWatches);
  /* Pinned subject, readable from send()/handlers without stale closures. */
  const subjectRef = useRef<{ url: string; title?: string; markdown?: string } | null>(subject);

  useEffect(() => { msgsRef.current = msgs; }, [msgs]);
  useEffect(() => { activeTabUrlRef.current = activeTab?.url ?? null; }, [activeTab]);
  useEffect(() => { authRef.current = auth; }, [auth]);
  useEffect(() => { allWatchesRef.current = allWatches; }, [allWatches]);
  useEffect(() => { subjectRef.current = subject; }, [subject]);

  /* --- Boot ----------------------------------------------------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Cold MV3 service workers can take >3s to wake. Retry once with a
        // longer window so a signed-in user isn't wrongly shown the login form.
        const authCheck = async () => {
          let r = await asyncSendMessage<{ authenticated: boolean; user?: { email: string } }>({ type: "AUTH_CHECK" }, 4000);
          if (r === null) r = await asyncSendMessage<{ authenticated: boolean; user?: { email: string } }>({ type: "AUTH_CHECK" }, 8000);
          return r;
        };
        const [authResp, tab, intent] = await Promise.all([
          authCheck(),
          getActiveTab(),
          readPendingIntent(),
        ]);
        if (cancelled) return;

        if (tab) setActiveTab(tab);

        if (!authResp || !authResp.authenticated) {
          setAuth({ kind: "anon" });
        } else if (authResp.user?.email) {
          setAuth({ kind: "signed-in", email: authResp.user.email });
        } else {
          setAuth({ kind: "anon" });
        }

        if (tab && authResp?.authenticated) {
          const state = await fetchWatchState(tab.url);
          if (cancelled) return;
          setWatchState(state);
          fetchWatchesList().then((ws) => { if (!cancelled) setAllWatches(ws); });
        }

        if (intent) {
          lastIntentTsRef.current = intent.timestamp;
          if (authResp?.authenticated) {
            handleIntent(intent, tab);
            clearPendingIntent(); // dispatched — safe to consume
          } else {
            // Signed out: stash for in-session replay AND leave it in storage so a
            // reload before sign-in can still recover it (cleared after replay).
            pendingIntentRef.current = { intent, tab };
          }
        }
      } catch (e: unknown) {
        setFatal(String((e as Error)?.message ?? e));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --- Replay a stashed watch intent once signed in ------------ */
  useEffect(() => {
    if (auth.kind !== "signed-in") return;
    const pending = pendingIntentRef.current;
    if (pending) {
      pendingIntentRef.current = null;
      handleIntent(pending.intent, pending.tab);
      clearPendingIntent(); // replayed after sign-in — consume it
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.kind]);

  /* --- Poll session while a code/link sign-in is pending ------- */
  useEffect(() => {
    if (auth.kind !== "magic-link-sent") return;
    let cancelled = false;
    const tick = async () => {
      const r = await asyncSendMessage<{ authenticated: boolean; user?: { email: string } }>(
        { type: "AUTH_CHECK" },
        2500,
      );
      if (cancelled) return;
      // Catches the magic-link-click path (cookie appears via the dashboard tab).
      if (r?.authenticated && r.user?.email) handleSignedIn(r.user.email);
    };
    const id = setInterval(tick, 3000);
    // First check faster so a fast-clicker doesn't wait the full 3s
    const fast = setTimeout(tick, 800);
    return () => {
      cancelled = true;
      clearInterval(id);
      clearTimeout(fast);
    };
  }, [auth.kind]);

  /* --- Fetch "what's new" once signed in ----------------------- */
  useEffect(() => {
    if (auth.kind !== "signed-in") return;
    let cancelled = false;
    fetch(`${APP_URL}/api/changes/recent?limit=3&onlyUnseen=1`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { changes?: NewsItem[] }) => { if (!cancelled) setNews(d.changes ?? []); })
      .catch(() => { /* leave empty */ });
    return () => { cancelled = true; };
  }, [auth.kind]);

  /* --- React to active-tab changes ----------------------------- */
  useEffect(() => {
    if (auth.kind !== "signed-in") return;
    const onActivated = async () => {
      // Don't follow tabs while a watch-creation flow is pinned, or when the
      // conversation is pinned to a subject page (header stays on the subject).
      if (pendingIntentRef.current || subjectRef.current) return;
      const t = await getActiveTab();
      if (!t) return;
      setActiveTab(t);
      setPageExtract(null);
      setAttachments({ page: false, selection: null });
      // Match against the loaded list first — NO per-tab server ping for random
      // browsing (the panel isn't a browsing log).
      const local = localWatchState(t.url, allWatchesRef.current);
      setWatchState(local);
      // Only the user's OWN watched pages get a full fetch (accurate change
      // counts). That URL is already in their watch list, so it's not a new
      // privacy leak — and it fixes the misleading "Timeline · 0".
      if (local.kind !== "idle") {
        const full = await fetchWatchState(t.url);
        setWatchState(full);
      }
    };
    const onUpdated = (_tabId: number, info: chrome.tabs.TabChangeInfo) => {
      if (info.status === "complete") onActivated();
    };
    chrome.tabs.onActivated.addListener(onActivated);
    chrome.tabs.onUpdated.addListener(onUpdated);
    return () => {
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };
  }, [auth.kind]);

  /* --- Cmd+K ---------------------------------------------------- */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdkOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* --- Auto-scroll --------------------------------------------- */
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [msgs, streaming]);

  /* --- Listen for cross-context push --------------------------- */
  useEffect(() => {
    function onMsg(m: {
      type?: string;
      watchId?: string;
      narration?: string;
      intent?: Intent;
    }) {
      if (m?.type === "WATCH_CHANGED" && m.narration) {
        pushMsg({ id: uid(), kind: "event", text: m.narration, href: m.watchId ? `${APP_URL}/app/watches/${m.watchId}` : undefined });
        return;
      }
      // Right-click "Watch with uatchit" while panel is already open.
      // The boot effect won't re-run, so background broadcasts here too.
      // Dedup against boot path via timestamp.
      if (m?.type === "WATCH_INTENT" && m.intent) {
        const intent = m.intent;
        if (intent.timestamp <= lastIntentTsRef.current) return;
        lastIntentTsRef.current = intent.timestamp;
        const tab: ActiveTab | null = activeTab ?? (intent.url ? { url: intent.url, title: intent.title } : null);
        handleIntent(intent, tab);
        clearPendingIntent(); // handled live — clear the cold-boot fallback copy
      }
    }
    chrome.runtime.onMessage.addListener(onMsg);
    return () => chrome.runtime.onMessage.removeListener(onMsg);
    // activeTab is referenced inside the listener; recreate listener when it changes
    // so the closure stays in sync with the user's current context.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  /* --- Msg helpers --------------------------------------------- */
  const pushMsg = useCallback((m: Msg) => {
    setMsgs((prev) => [...prev, m]);
  }, []);

  function patchMsg(id: string, p: Partial<Msg>) {
    setMsgs((prev) => prev.map((m) => (m.id === id ? ({ ...m, ...p } as Msg) : m)));
  }

  function appendModelDelta(currentId: string | null, delta: string): string {
    if (!currentId) {
      const id = uid();
      pushMsg({ id, kind: "model", text: delta });
      return id;
    }
    setMsgs((prev) => prev.map((m) => (m.id === currentId && m.kind === "model" ? { ...m, text: m.text + delta } : m)));
    return currentId;
  }

  /* --- Watches list (for CmdK) -------------------------------- */
  async function fetchWatchesList(): Promise<WatchSummary[]> {
    try {
      const res = await fetch(`${APP_URL}/api/watches`, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.watches ?? []).map((w: { id: string; url: string; title: string | null; status: string; intervalMinutes: number; lastFetchedAt: string | null; createdAt: string }) => ({
        ...w,
        host: safeHost(w.url) ?? w.url,
      })) as WatchSummary[];
    } catch {
      return [];
    }
  }

  async function refreshWatchState() {
    // Prefer the pinned subject URL (the page we just acted on) over the live tab.
    const url = subjectRef.current?.url ?? activeTab?.url;
    if (url) {
      const s = await fetchWatchState(url);
      setWatchState(s);
      fetchWatchesList().then(setAllWatches);
    }
  }

  /* --- Sign-in transition (shared by OTP verify + link poll) --- */
  async function handleSignedIn(email: string) {
    setAuth({ kind: "signed-in", email });
    chrome.runtime.sendMessage({ type: "POLL_UNSEEN_NOW" }).catch(() => {});
    // If a watch intent is queued, let the replay pin context to ITS page —
    // don't adopt whatever tab the user detoured to (e.g. their email).
    if (pendingIntentRef.current) return;
    const t = await getActiveTab();
    if (t) {
      setActiveTab(t);
      setWatchState(await fetchWatchState(t.url));
    }
    // A stashed watch intent (pendingIntentRef) is replayed by the
    // auth.kind effect once auth flips to "signed-in".
  }

  /* --- Intent handler ----------------------------------------- */
  async function handleIntent(intent: Intent, tab: ActiveTab | null) {
    const url = intent.url ?? tab?.url ?? "";
    if (!url) return;
    // Only http(s) pages are fetchable. chrome://, file://, extension pages,
    // etc. would otherwise fail server-side url validation with a cryptic error.
    if (!/^https?:\/\//i.test(url)) {
      if (authRef.current.kind === "signed-in") {
        pushMsg({ id: uid(), kind: "event", text: "I can only watch http/https websites — this looks like a browser page, not a watchable site." });
      }
      return;
    }
    // Signed out: don't open a tab — keep it in-panel. Stash and replay
    // after sign-in completes (OTP verify or magic-link poll).
    if (authRef.current.kind !== "signed-in") {
      pendingIntentRef.current = { intent, tab };
      return;
    }
    // Pin this page as the conversation subject. Every turn (including the
    // answer to a clarifying question) now targets THIS page, even if the user
    // navigates away mid-flow — so we never silently watch the wrong tab.
    setSubject({ url, title: intent.title ?? tab?.title ?? undefined });
    setWatchState(localWatchState(url, allWatchesRef.current));
    if (intent.selection) {
      // User highlighted text + right-clicked Watch with uatchit. The selection
      // IS the intent — agent must pass it as preview_schema(intent=...) and
      // build a minimal schema focused on that section, not the whole page.
      const sel = intent.selection.slice(0, 500);
      const m = `Watch this page. I highlighted this — make it the focus of the schema:\n\n"${sel}"`;
      send(m, { withPage: true, withSelection: intent.selection });
    } else {
      const m = `Watch this page for me — show me the schema first so I can confirm.`;
      send(m, { withPage: true });
    }
  }

  /* --- Send (the big function) ---------------------------------- */
  async function send(userText: string, opts?: { withPage?: boolean; withSelection?: string | null }) {
    // Never punt to a browser tab. Callers are gated on signed-in; this is
    // just a defensive no-op (the input box only renders when signed in).
    if (authRef.current.kind !== "signed-in") return;
    if (streaming) return;

    // Duplicate-submit guard — covers Enter double-fire and any race where the
    // same exact text is submitted within 3s. The agent has its own state-aware
    // recovery ("already active"), but suppressing the duplicate at the source
    // is cleaner UX than letting two identical bubbles render.
    const now = Date.now();
    if (userText === lastSendRef.current.text && now - lastSendRef.current.ts < 3_000) {
      return;
    }
    lastSendRef.current = { text: userText, ts: now };

    pushMsg({ id: uid(), kind: "user", text: userText });
    setStreaming(true);
    setText("");

    // Build pageContext from the pinned SUBJECT (the page this conversation is
    // about), not the live tab — so answering a clarifying question after a tab
    // switch still targets the right page. Falls back to the live tab, and the
    // first page-attached message pins the subject if none is set yet.
    const needPage = opts?.withPage || attachments.page;
    const sel = opts?.withSelection ?? attachments.selection;
    let base = subjectRef.current ?? (activeTab ? { url: activeTab.url, title: activeTab.title } : null);
    if (!subjectRef.current && needPage && base) {
      setSubject(base); // pin from here for the rest of this conversation
    }
    let pageContext: { url?: string; title?: string; markdown?: string } | undefined;
    if (base) {
      pageContext = { url: base.url, title: base.title, markdown: base.markdown };
      // Only extract client-side content if we're actually on the subject tab;
      // otherwise rely on the server fetching the subject URL (preview_schema
      // re-fetches by url anyway), so a stale tab can't poison the content.
      if (needPage && !pageContext.markdown && activeTab && activeTab.url === base.url) {
        let ex = pageExtract;
        if (!ex) ex = await extractActiveTab();
        if (ex) {
          setPageExtract(ex);
          pageContext.markdown = toMarkdown(ex);
          setSubject((prev) => (prev ? { ...prev, markdown: pageContext!.markdown } : prev));
        }
      }
      if (sel) {
        pageContext.markdown = (pageContext.markdown ?? "") + `\n\n## user-selected\n${sel.slice(0, 1500)}`;
      }
    }
    setAttachments({ page: false, selection: null });

    // Compose wire history (everything pushed so far, including the user msg).
    const wire = msgsToWire([...msgsRef.current, { id: uid(), kind: "user", text: userText }]);

    let res: Response;
    try {
      res = await fetch(`${APP_URL}/api/ai/chat`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: wire, pageContext }),
      });
    } catch (e: unknown) {
      pushMsg({ id: uid(), kind: "error", text: `Couldn't reach uatchit — ${(e as Error)?.message ?? "network error"}` });
      setStreaming(false);
      return;
    }
    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      pushMsg({ id: uid(), kind: "error", text: `Chat failed (${res.status}). ${detail.slice(0, 200)}` });
      setStreaming(false);
      return;
    }

    let currentModelMsgId: string | null = null;
    let didCreateOrUpdate = false;
    try {
      for await (const ev of readNdjsonStream(res.body.getReader())) {
        currentModelMsgId = handleEvent(ev, currentModelMsgId, () => { didCreateOrUpdate = true; });
      }
    } catch (e: unknown) {
      pushMsg({ id: uid(), kind: "error", text: `Stream broke — ${(e as Error)?.message ?? "unknown"}` });
    } finally {
      setStreaming(false);
      if (didCreateOrUpdate) {
        refreshWatchState(); // reads the pinned subject url synchronously first
        setSubject(null); // watch flow done — unpin so the next "watch" uses the current page
      }
    }
  }

  function handleEvent(ev: AgentEvent, currentModelMsgId: string | null, markMutated: () => void): string | null {
    if (ev.type === "text") {
      return appendModelDelta(currentModelMsgId, ev.delta);
    }
    if (ev.type === "tool_call") {
      pushMsg({ id: uid(), kind: "tool_pending", callId: ev.id, name: ev.name, args: ev.args });
      return null; // next text starts a fresh bubble
    }
    if (ev.type === "tool_result") {
      // Find the matching pending and replace it.
      setMsgs((prev) => {
        const next = [...prev];
        const idx = next.findIndex((m) => m.kind === "tool_pending" && m.callId === ev.id);
        const resultMsg: Msg = {
          id: idx >= 0 ? next[idx].id : uid(),
          kind: "tool_result",
          callId: ev.id,
          name: ev.name,
          display: ev.display,
          ok: ev.ok,
          result: ev.result,
        };
        if (idx >= 0) next[idx] = resultMsg;
        else next.push(resultMsg);
        return next;
      });
      if (["watch-created", "watch-updated", "watch-deleted"].includes(ev.display)) {
        markMutated();
        // Refresh the icon badge — the unseen count likely shifted.
        chrome.runtime.sendMessage({ type: "POLL_UNSEEN_NOW" }).catch(() => {});
      }
      return null;
    }
    if (ev.type === "error") {
      pushMsg({ id: uid(), kind: "error", text: ev.detail });
      return null;
    }
    return currentModelMsgId;
  }

  /* --- Chip handlers ------------------------------------------ */
  function onTrackAll(_schema: InferredSchemaShape) {
    // No hardcoded cadence — the agent uses the default (or whatever was discussed).
    send("Yes — track all of those fields.");
  }
  function onTrackEverything(_schema: InferredSchemaShape) {
    // Re-infer comprehensively (agent calls preview_schema breadth="broad"),
    // then the user confirms the broader schema with "Track all".
    send("Actually, track everything that changes on this page — show me the comprehensive schema first.");
  }
  function onRefineFields(schema: InferredSchemaShape) {
    const names = schema.fields.map((f) => f.name).join(", ");
    setText(`Track only these fields: ${names} — remove the ones you don't want. `);
  }
  function onChipChangeCadence(watchId: string, label: string, minutes: number) {
    send(`Set the cadence on watch ${watchId} to ${label}.`);
    void minutes;
  }
  function onPauseWatch(watchId: string) {
    send(`Pause the watch ${watchId}.`);
  }
  function onResumeWatch(watchId: string) {
    send(`Resume the watch ${watchId}.`);
  }

  /* --- Top-level page-card actions ----------------------------- */
  function onHeaderWatch() {
    if (!activeTab) return;
    send(`Watch this page for me — show me the schema first: ${activeTab.url}`, { withPage: true });
  }
  function onHeaderPauseResume() {
    if (watchState.kind === "watching") onPauseWatch(watchState.watch.id);
    else if (watchState.kind === "paused") onResumeWatch(watchState.watch.id);
  }
  function onHeaderViewTimeline() {
    if (watchState.kind !== "idle" && watchState.kind !== "checking") {
      window.open(`${APP_URL}/app/watches/${watchState.watch.id}`, "_blank", "noreferrer");
    }
  }

  /* --- Form ----------------------------------------------------- */
  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || streaming) return;
    send(t);
  }

  /* --- Attach menu --------------------------------------------- */
  async function onAttach(kind: AttachKind) {
    if (kind === "page") {
      let ex = pageExtract;
      if (!ex) {
        ex = await extractActiveTab();
        if (ex) setPageExtract(ex);
      }
      setAttachments((a) => ({ ...a, page: !!ex }));
    } else if (kind === "selection") {
      const ex = await extractActiveTab();
      if (ex) {
        setPageExtract(ex);
        setAttachments((a) => ({ ...a, selection: ex.selection }));
      }
    }
  }

  /* --- Render --------------------------------------------------- */
  // The header shows the conversation SUBJECT when one is pinned (so it tracks
  // the page being watched, not whatever tab you wandered to), else the live tab.
  const displayPage = subject ?? activeTab;
  const host = displayPage?.url ? safeHost(displayPage.url) : null;
  const fav = host ? gradientFor(host) : "linear-gradient(135deg, #635BFF, #00D4FF)";
  // When pinned and the user is now on a DIFFERENT tab, offer to re-target.
  const offTabUrl = subject && activeTab && activeTab.url !== subject.url ? activeTab.url : null;

  if (fatal) {
    return (
      <div className="panel">
        <header className="ph">
          <div className="ph-row">
            <div className="ph-brand"><I.Logo width={17} height={17} /><span>uatchit</span></div>
            <div className="ph-status ph-status-error"><span className="ph-status-dot" /> error</div>
          </div>
        </header>
        <div className="fatal">Side panel crashed during boot.<code>{fatal}</code></div>
      </div>
    );
  }

  if (auth.kind === "loading") {
    return (
      <div className="panel">
        <Header status={{ label: "connecting…", kind: "idle" }} />
        <div className="boot">
          <div className="boot-spin" />
          <div className="boot-text">Checking session…</div>
          <div className="boot-sub">Reading cookie from {APP_URL}</div>
        </div>
      </div>
    );
  }

  if (auth.kind === "anon") {
    return (
      <div className="panel">
        <Header status={{ label: "signed out", kind: "idle" }} />
        <SignInForm onSent={(email) => setAuth({ kind: "magic-link-sent", email })} />
      </div>
    );
  }

  if (auth.kind === "magic-link-sent") {
    return (
      <div className="panel">
        <Header status={{ label: "code sent", kind: "inferring" }} />
        <OtpForm
          email={auth.email}
          onVerified={(email) => handleSignedIn(email)}
          onBack={() => setAuth({ kind: "anon" })}
        />
      </div>
    );
  }

  const pill = pillFromState(watchState, streaming);

  return (
    <div className="panel">
      <Header status={pill} onCmdK={() => setCmdkOpen(true)} />

      {displayPage && (
        <div className="ph" style={{ paddingTop: 0, borderTop: 0 }}>
          <div className="ph-page">
            <div className="ph-page-fav" style={{ background: fav }} />
            <div className="ph-page-meta">
              <div className="ph-page-title">{displayPage.title ?? host ?? "current page"}</div>
              <div className="ph-page-url">
                {host ?? displayPage.url}
                {subject && <> · <span className="accent-em">watching this</span></>}
                {watchState.kind === "watching" && watchState.watch.changeCount > 0 && (
                  <> · <span className="accent-em">{watchState.watch.changeCount} changes</span></>
                )}
                {watchState.kind === "watching" && watchState.watch.lastFetchedAt && (
                  <> · last {relTime(watchState.watch.lastFetchedAt)}</>
                )}
              </div>
              {offTabUrl && (
                <button type="button" className="chip chip-mini" style={{ marginTop: 6 }}
                  onClick={() => setSubject({ url: offTabUrl, title: activeTab?.title ?? undefined })}>
                  watch this tab instead
                </button>
              )}
            </div>
            <button type="button" className="ph-more" aria-label="open in tab"
              onClick={() => displayPage.url && window.open(displayPage.url, "_blank", "noreferrer")}>
              <I.ExternalLink width={13} height={13} />
            </button>
          </div>
          <HeaderActions
            watchState={watchState}
            onWatch={onHeaderWatch}
            onPauseResume={onHeaderPauseResume}
            onViewTimeline={onHeaderViewTimeline}
          />
        </div>
      )}

      <div className="chat" ref={scroller}>
        {msgs.length === 0 && (
          <>
            {news.length > 0 && (
              <div className="panel-news">
                <div className="panel-news-h">
                  {news.length} unseen change{news.length === 1 ? "" : "s"}
                </div>
                {news.map((n) => (
                  <a
                    key={n.id}
                    className="panel-news-row"
                    href={`${APP_URL}/app/watches/${n.watchId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <div className="panel-news-fav" style={{ background: gradientFor(n.host) }} />
                    <div className="panel-news-meta">
                      <div className="panel-news-narr">
                        <strong>{n.title ?? n.host}</strong>
                        <span style={{ color: "var(--text-muted)" }}> — {n.narration}</span>
                      </div>
                      <div className="panel-news-sub mono">
                        {n.host} · {relTime(n.createdAt)}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
            <div className="divider">ready</div>
            <div className="msg msg-ai">
              <div className="msg-avatar"><I.Logo width={12} height={12} /></div>
              <div className="bubble">
                Right-click any page and choose <em className="accent-em">Watch with uatchit</em>, or ask me what's changed across your watches.
              </div>
            </div>
            <div className="chips">
              {watchState.kind === "idle" && activeTab && (
                <button type="button" className="chip chip-primary" onClick={onHeaderWatch}>
                  <I.Eye width={11} height={11} /> Watch this page
                </button>
              )}
              <button type="button" className="chip" onClick={() => send("What changed across my watches recently?")}>
                What's changed?
              </button>
              <button type="button" className="chip" onClick={() => send("List my watches.")}>
                My watches
              </button>
              {activeTab && watchState.kind === "idle" && (
                <button type="button" className="chip" onClick={() => send(`What's worth tracking on ${host}?`, { withPage: true })}>
                  What should I track?
                </button>
              )}
            </div>
          </>
        )}

        {msgs.map((m) => renderMsg(m, {
          onTrackAll,
          onTrackEverything,
          onRefineFields,
          onOpenWatch: (id: string) => window.open(`${APP_URL}/app/watches/${id}`, "_blank", "noreferrer"),
          onChipChangeCadence,
          onPauseWatch,
          onResumeWatch,
        }))}

        {streaming && msgs.length > 0 && msgs[msgs.length - 1].kind !== "tool_pending" && (
          <div className="msg msg-ai">
            <div className="msg-avatar"><I.Logo width={12} height={12} /></div>
            <div className="bubble">
              <span className="thinking">
                <span className="tdots"><i /><i /><i /></span>
                Thinking…
              </span>
            </div>
          </div>
        )}
      </div>

      <form className="compose" onSubmit={onSubmit}>
        <div className="compose-pill">
          {(attachments.page || attachments.selection) && (
            <div className="compose-attachments">
              {attachments.page && pageExtract && (
                <span className="compose-context">
                  <I.Layers width={9} height={9} />
                  page · {pageExtract.hostname}
                  <button type="button" className="compose-context-x" aria-label="remove"
                    onClick={() => setAttachments((a) => ({ ...a, page: false }))}>
                    <I.X width={9} height={9} />
                  </button>
                </span>
              )}
              {attachments.selection && (
                <span className="compose-context">
                  <I.Paperclip width={9} height={9} />
                  selection · {attachments.selection.length} chars
                  <button type="button" className="compose-context-x" aria-label="remove"
                    onClick={() => setAttachments((a) => ({ ...a, selection: null }))}>
                    <I.X width={9} height={9} />
                  </button>
                </span>
              )}
            </div>
          )}
          <div className="compose-row">
            <input
              className="compose-input"
              placeholder={activeTab ? `Ask about ${host}…` : "Ask anything…"}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={streaming}
            />
            <div className="compose-tools" style={{ position: "relative" }}>
              <button
                type="button"
                className="compose-tool"
                aria-label="attach"
                onClick={() => setAttachOpen((o) => !o)}
                aria-expanded={attachOpen}
              >
                <I.Paperclip width={14} height={14} />
              </button>
              <AttachMenu
                open={attachOpen}
                onClose={() => setAttachOpen(false)}
                onPick={onAttach}
                hasSelection={!!pageExtract?.selection || !!(activeTab && pageExtract === null)}
              />
            </div>
            <button
              type="submit"
              className="compose-send"
              aria-label="send"
              disabled={streaming || !text.trim()}
            >
              <I.Send width={13} height={13} />
            </button>
          </div>
        </div>
        <div className="compose-foot">
          <span>Gemini · tools enabled</span>
          <span><span className="kbd">⌘K</span> · <span className="kbd">⏎</span> send</span>
        </div>
      </form>

      <CmdK
        open={cmdkOpen}
        onClose={() => setCmdkOpen(false)}
        watches={allWatches}
        onSend={(m) => send(m)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function Header({ status, onCmdK }: { status: { label: string; kind: "watching" | "paused" | "idle" | "error" | "inferring" }; onCmdK?: () => void }) {
  const statusClass =
    status.kind === "watching" ? ""
      : status.kind === "paused" ? "ph-status-paused"
      : status.kind === "error" ? "ph-status-error"
      : status.kind === "inferring" ? "ph-status-inferring"
      : "ph-status-idle";
  return (
    <header className="ph">
      <div className="ph-row">
        <div className="ph-brand"><I.Logo width={17} height={17} /><span>uatchit</span></div>
        <div className={`ph-status ${statusClass}`}>
          <span className="ph-status-dot" /> {status.label}
        </div>
        {onCmdK && (
          <button type="button" className="ph-more" aria-label="command palette" onClick={onCmdK}>
            <I.Sparkles width={14} height={14} />
          </button>
        )}
      </div>
    </header>
  );
}

function pillFromState(s: WatchState, streaming: boolean): { label: string; kind: "watching" | "paused" | "idle" | "error" | "inferring" } {
  if (streaming) return { label: "thinking", kind: "inferring" };
  if (s.kind === "checking") return { label: "checking…", kind: "idle" };
  if (s.kind === "watching") return { label: "watching", kind: "watching" };
  if (s.kind === "paused") return { label: "paused", kind: "paused" };
  if (s.kind === "error") return { label: "error", kind: "error" };
  return { label: "ready", kind: "idle" };
}

function HeaderActions(props: {
  watchState: WatchState;
  onWatch: () => void;
  onPauseResume: () => void;
  onViewTimeline: () => void;
}) {
  const { watchState, onWatch, onPauseResume, onViewTimeline } = props;
  return (
    <div className="ph-actions">
      {watchState.kind === "idle" && (
        <button type="button" className="ph-action ph-action-primary" onClick={onWatch}>
          <I.Eye width={11} height={11} /> Watch this page
        </button>
      )}
      {(watchState.kind === "watching" || watchState.kind === "paused" || watchState.kind === "error") && (
        <>
          <button type="button" className="ph-action" onClick={onViewTimeline}>
            <I.Activity width={11} height={11} /> Timeline · {watchState.watch.changeCount}
          </button>
          <button type="button" className="ph-action" onClick={onPauseResume}>
            {watchState.kind === "paused"
              ? <><I.Play width={11} height={11} /> Resume</>
              : <><I.Pause width={11} height={11} /> Pause</>}
          </button>
          <span className="ph-action-meta mono">
            every {cadenceLabel(watchState.watch.intervalMinutes)}
          </span>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Message dispatcher                                                  */
/* ------------------------------------------------------------------ */

interface MsgHandlers {
  onTrackAll: (s: InferredSchemaShape) => void;
  onTrackEverything: (s: InferredSchemaShape) => void;
  onRefineFields: (s: InferredSchemaShape) => void;
  onOpenWatch: (id: string) => void;
  onChipChangeCadence: (watchId: string, label: string, minutes: number) => void;
  onPauseWatch: (id: string) => void;
  onResumeWatch: (id: string) => void;
}

function renderMsg(m: Msg, h: MsgHandlers): React.ReactElement {
  if (m.kind === "user") {
    return (
      <div key={m.id} className="msg msg-user">
        <div className="bubble">{m.text}</div>
      </div>
    );
  }
  if (m.kind === "model") {
    return (
      <div key={m.id} className="msg msg-ai">
        <div className="msg-avatar"><I.Logo width={12} height={12} /></div>
        <div className="bubble">{m.text || <span className="thinking"><span className="tdots"><i /><i /><i /></span>Thinking…</span>}</div>
      </div>
    );
  }
  if (m.kind === "tool_pending") {
    return (
      <div key={m.id} className="tool-row">
        <span className="tool-row-dot tool-row-dot-loading" />
        <span className="tool-row-label">{toolLabel(m.name, "pending")}</span>
      </div>
    );
  }
  if (m.kind === "tool_result") {
    return <ToolResultRenderer key={m.id} msg={m} handlers={h} />;
  }
  if (m.kind === "event") {
    return (
      <div key={m.id} className="event">
        <I.Sparkles width={11} height={11} />
        {m.href ? <a href={m.href} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>{m.text}</a> : m.text}
      </div>
    );
  }
  if (m.kind === "error") {
    return (
      <div key={m.id} className="event event-error">
        <I.X width={11} height={11} />
        {m.text}
      </div>
    );
  }
  return <></>;
}

function toolLabel(name: string, phase: "pending" | "done"): string {
  const map: Record<string, string> = {
    list_watches: phase === "pending" ? "Looking up your watches…" : "Looked up your watches",
    get_recent_changes: phase === "pending" ? "Pulling recent changes…" : "Recent changes",
    get_watch_by_url: phase === "pending" ? "Checking this url…" : "Watch state",
    preview_schema: phase === "pending" ? "Inferring schema…" : "Inferred schema",
    create_watch: phase === "pending" ? "Creating watch…" : "Watch created",
    update_watch: phase === "pending" ? "Updating watch…" : "Watch updated",
    delete_watch: phase === "pending" ? "Deleting watch…" : "Watch deleted",
    fetch_page: phase === "pending" ? "Fetching page…" : "Fetched page",
  };
  return map[name] ?? name;
}

/* ------------------------------------------------------------------ */
/* Tool-result renderers                                               */
/* ------------------------------------------------------------------ */

function ToolResultRenderer({ msg, handlers }: { msg: Extract<Msg, { kind: "tool_result" }>; handlers: MsgHandlers }) {
  if (!msg.ok) {
    const r = msg.result as { reason?: string; detail?: string };
    return (
      <div className="tool-row tool-row-error">
        <span className="tool-row-dot tool-row-dot-error" />
        <span className="tool-row-label">{toolLabel(msg.name, "done")} failed</span>
        <span className="tool-row-detail mono">{r.detail ?? r.reason ?? "unknown"}</span>
      </div>
    );
  }
  switch (msg.display) {
    case "schema-preview": return <SchemaPreviewCard result={msg.result} onTrackAll={handlers.onTrackAll} onTrackEverything={handlers.onTrackEverything} onRefine={handlers.onRefineFields} />;
    case "watches-list": return <WatchesListCard result={msg.result} onOpenWatch={handlers.onOpenWatch} onPause={handlers.onPauseWatch} onResume={handlers.onResumeWatch} />;
    case "changes-list": return <ChangesListCard result={msg.result} onOpenWatch={handlers.onOpenWatch} />;
    case "watch-state": return <WatchStateCard result={msg.result} onOpenWatch={handlers.onOpenWatch} />;
    case "watch-created": return <WatchCreatedCard result={msg.result} onOpenWatch={handlers.onOpenWatch} />;
    case "watch-updated": return <WatchUpdatedCard result={msg.result} />;
    case "watch-deleted": return <WatchDeletedCard result={msg.result} />;
    case "page-fetched": return <PageFetchedCard result={msg.result} />;
    default:
      return (
        <div className="tool-row">
          <span className="tool-row-dot" />
          <span className="tool-row-label">{toolLabel(msg.name, "done")}</span>
        </div>
      );
  }
}

function SchemaPreviewCard({ result, onTrackAll, onTrackEverything, onRefine }: { result: unknown; onTrackAll: (s: InferredSchemaShape) => void; onTrackEverything: (s: InferredSchemaShape) => void; onRefine: (s: InferredSchemaShape) => void }) {
  const r = result as { ok?: boolean; schema?: InferredSchemaShape; sourceUrl?: string; reason?: string; detail?: string; extracted?: Record<string, unknown> };
  if (!r.ok || !r.schema) {
    // Gated / error / empty pages get a clear "can't watch" card, not a schema.
    const label =
      r.reason === "gated" ? "Can't watch — login required" :
      r.reason === "empty" ? "Can't watch — no readable content" :
      r.reason === "error" ? "Can't watch — page error" :
      "Couldn't infer a schema";
    return (
      <div className="schema-card">
        <div className="schema-card-head">
          <span className="schema-card-head-mark"><I.X width={11} height={11} /></span>
          <span>{label}</span>
        </div>
        <div className="schema-card-intent">{r.detail ?? r.reason ?? "unknown"}</div>
      </div>
    );
  }
  const s = r.schema;
  return (
    <div className="schema-card">
      <div className="schema-card-head">
        <span className="schema-card-head-mark"><I.Layers width={11} height={11} /></span>
        <span>inferred · {s.pageType.replace(/_/g, " ")}</span>
        <span className="schema-card-head-conf mono">conf {Math.round(s.confidence * 100)}%</span>
      </div>
      <div className="schema-card-title">{s.title}</div>
      <div className="schema-card-intent">{s.intent}</div>
      {s.mutationThesis && (
        <div className="schema-card-thesis">
          {s.mutationThesis.split("\n").map((line, i) => (
            <div key={i} className="schema-card-thesis-line">{line}</div>
          ))}
        </div>
      )}
      <div className="schema-fields">
        {s.fields.slice(0, 8).map((f) => (
          <div key={f.name} className="schema-row">
            <span className="mono mono-key">{f.name}</span>
            <span className="mono mono-val">{f.type}</span>
            <span className="schema-tag mono">{summarizeSample(r.extracted?.[f.name] ?? f.sampleValue)}</span>
          </div>
        ))}
        {s.fields.length > 8 && (
          <div className="schema-row-more mono">+ {s.fields.length - 8} more</div>
        )}
      </div>
      <div className="chips" style={{ marginLeft: 0, marginTop: 10 }}>
        <button type="button" className="chip chip-primary" onClick={() => onTrackAll(s)}>
          <I.Check width={11} height={11} /> Track all {s.fields.length}
        </button>
        <button type="button" className="chip" onClick={() => onTrackEverything(s)}>
          <I.Eye width={11} height={11} /> Track everything
        </button>
        <button type="button" className="chip" onClick={() => onRefine(s)}>
          Refine fields
        </button>
      </div>
    </div>
  );
}

function summarizeSample(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (Array.isArray(v)) {
    if (v.length === 0) return "[]";
    const first = v[0];
    if (first !== null && typeof first === "object") {
      const obj = first as Record<string, unknown>;
      const label = String(obj.title ?? obj.name ?? obj.text ?? obj.headline ?? "item");
      const shown = label.length > 18 ? label.slice(0, 18) + "…" : label;
      return v.length === 1 ? `[${shown}]` : `[${shown}, +${v.length - 1}]`;
    }
    const joined = v.slice(0, 2).map((x) => String(x)).join(", ");
    return v.length > 2 ? `[${joined.slice(0, 18)}…]` : `[${joined.slice(0, 22)}]`;
  }
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 22 ? s.slice(0, 22) + "…" : s;
}

function WatchesListCard({ result, onOpenWatch, onPause, onResume }: { result: unknown; onOpenWatch: (id: string) => void; onPause: (id: string) => void; onResume: (id: string) => void }) {
  const r = result as { watches?: WatchSummary[] };
  const list = r.watches ?? [];
  if (list.length === 0) {
    return (
      <div className="card-soft">
        <div className="card-soft-h">no watches yet</div>
        <div className="card-soft-body">Right-click any page and choose <em className="accent-em">Watch with uatchit</em>.</div>
      </div>
    );
  }
  return (
    <div className="card-soft">
      <div className="card-soft-h">{list.length} watch{list.length === 1 ? "" : "es"}</div>
      <div className="watch-rows">
        {list.slice(0, 6).map((w) => (
          <div key={w.id} className="watch-row">
            <button type="button" className="watch-row-main" onClick={() => onOpenWatch(w.id)}>
              <div className="watch-row-fav" style={{ background: gradientFor(w.host) }} />
              <div className="watch-row-meta">
                <div className="watch-row-title">{w.title ?? w.host}</div>
                <div className="watch-row-sub mono">
                  {w.host} · every {cadenceLabel(w.intervalMinutes)} · {w.status}
                </div>
              </div>
            </button>
            <button type="button" className="chip chip-mini" onClick={() => (w.status === "active" ? onPause(w.id) : onResume(w.id))}>
              {w.status === "active" ? "Pause" : "Resume"}
            </button>
          </div>
        ))}
        {list.length > 6 && <div className="row-more mono">+ {list.length - 6} more</div>}
      </div>
    </div>
  );
}

function ChangesListCard({ result, onOpenWatch }: { result: unknown; onOpenWatch: (id: string) => void }) {
  const r = result as { changes?: ChangeSummary[] };
  const list = r.changes ?? [];
  if (list.length === 0) {
    return (
      <div className="card-soft">
        <div className="card-soft-h">no changes detected</div>
        <div className="card-soft-body">uatchit watches everything in the background — the timeline will fill in as pages change.</div>
      </div>
    );
  }
  return (
    <div className="card-soft">
      <div className="card-soft-h">{list.length} recent change{list.length === 1 ? "" : "s"}</div>
      <div className="change-rows">
        {list.slice(0, 5).map((c) => (
          <button key={c.id} type="button" className="change-row" onClick={() => onOpenWatch(c.watchId)}>
            <span className="change-row-mark"><I.Sparkles width={11} height={11} /></span>
            <div>
              <div className="change-row-narr"><strong>{c.watchTitle ?? c.host}</strong> — {c.narration}</div>
              <div className="change-row-sub mono">{c.host} · {relTime(c.createdAt)}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function WatchStateCard({ result, onOpenWatch }: { result: unknown; onOpenWatch: (id: string) => void }) {
  const r = result as { watched?: boolean; watch?: { id: string; title: string | null; changeCount: number; status: string; intervalMinutes: number } };
  if (!r.watched) {
    return (
      <div className="tool-row">
        <span className="tool-row-dot" />
        <span className="tool-row-label">Not watched yet.</span>
      </div>
    );
  }
  const w = r.watch!;
  return (
    <button type="button" className="card-soft card-soft-button" onClick={() => onOpenWatch(w.id)}>
      <div className="card-soft-h">already watching · {w.status}</div>
      <div className="card-soft-body">
        <strong>{w.title ?? "this page"}</strong> · {w.changeCount} change{w.changeCount === 1 ? "" : "s"} · re-checks every {cadenceLabel(w.intervalMinutes)}
      </div>
    </button>
  );
}

function WatchCreatedCard({ result, onOpenWatch }: { result: unknown; onOpenWatch: (id: string) => void }) {
  const r = result as { ok?: boolean; watchId?: string; title?: string; fieldCount?: number; reason?: string; detail?: string };
  if (!r.ok || !r.watchId) {
    return (
      <div className="tool-row tool-row-error">
        <span className="tool-row-dot tool-row-dot-error" />
        <span className="tool-row-label">Couldn't create watch</span>
        <span className="tool-row-detail mono">{r.detail ?? r.reason ?? "unknown"}</span>
      </div>
    );
  }
  return (
    <button type="button" className="card-soft card-soft-button card-soft-accent" onClick={() => onOpenWatch(r.watchId!)}>
      <div className="card-soft-h">watch created</div>
      <div className="card-soft-body">
        <strong>{r.title}</strong> · tracking {r.fieldCount} field{r.fieldCount === 1 ? "" : "s"} · open the dashboard →
      </div>
    </button>
  );
}

function WatchUpdatedCard({ result }: { result: unknown }) {
  const r = result as { ok?: boolean; status?: string; intervalMinutes?: number; reason?: string };
  if (!r.ok) return <div className="tool-row tool-row-error"><span className="tool-row-dot tool-row-dot-error" /><span className="tool-row-label">Update failed</span><span className="tool-row-detail mono">{r.reason}</span></div>;
  return (
    <div className="event">
      <I.Check width={11} height={11} />
      Watch updated — status {r.status}, cadence {cadenceLabel(r.intervalMinutes ?? 360)}
    </div>
  );
}

function WatchDeletedCard({ result }: { result: unknown }) {
  const r = result as { ok?: boolean; reason?: string };
  if (!r.ok) return <div className="tool-row tool-row-error"><span className="tool-row-dot tool-row-dot-error" /><span className="tool-row-label">Delete failed</span><span className="tool-row-detail mono">{r.reason}</span></div>;
  return <div className="event"><I.Check width={11} height={11} /> Watch deleted</div>;
}

function PageFetchedCard({ result }: { result: unknown }) {
  const r = result as { ok?: boolean; url?: string; title?: string | null; length?: number; reason?: string; detail?: string };
  if (!r.ok) return <div className="tool-row tool-row-error"><span className="tool-row-dot tool-row-dot-error" /><span className="tool-row-label">Fetch failed</span><span className="tool-row-detail mono">{r.detail ?? r.reason}</span></div>;
  return (
    <div className="tool-row">
      <span className="tool-row-dot" />
      <span className="tool-row-label">Fetched {r.title ?? safeHost(r.url ?? "") ?? r.url}</span>
      <span className="tool-row-detail mono">{r.length?.toLocaleString()} chars</span>
    </div>
  );
}
