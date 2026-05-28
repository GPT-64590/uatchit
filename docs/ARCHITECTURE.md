# Architecture

uatchit is a **single-deployable monolith**. One Next.js 15 app (`apps/web`) hosts the marketing site, the dashboard, the AI chat agent, the cron orchestrator, and the MCP server. A thin Chrome side-panel extension (`apps/extension`) is the capture surface. Postgres 17 is the only stateful dependency; everything else is a stateless outbound API call (Bright Data, the AI/ML API gateway, Resend).

This is a deliberate choice — a monolith is the simplest thing that ships, and every layer here is boring on purpose so it can be debugged at 3 a.m.

## Components

### `apps/web` — the app

| Concern | Where | Notes |
|---|---|---|
| Marketing site | `src/app/(marketing routes)` | `/`, `/pricing`, `/how-it-works`, `/privacy`, `/terms` |
| Dashboard | `src/app/app/**` | watches, activity feed, watch detail (Data / Schema / Settings / MCP tabs) |
| Chat agent | `src/app/api/ai/chat/route.ts` + `src/lib/chat-agent.ts` | NDJSON streaming, OpenAI tool-calling loop |
| Cron orchestrator | `src/app/api/cron/tick/route.ts` | header-gated, processes due watches |
| MCP server | `src/app/api/mcp/route.ts` | bearer-auth, 5 read-only tools |
| Auth | `src/auth.ts`, `src/middleware.ts` | Auth.js v5, magic-link + OTP |
| Data layer | `src/db/**` | Drizzle ORM over a pooled `pg` client |

### `apps/extension` — the capture surface

A Plasmo (Manifest V3) extension, **side-panel only** — no content scripts, no in-page DOM injection. The background service worker registers a single "Watch with uatchit" context-menu item and polls an unseen-count badge every 5 minutes via `chrome.alarms`. The side panel (`src/sidepanel.tsx`) is a React app that talks to the web app over HTTP with `credentials: "include"` (cookie session), streaming the agent response as NDJSON. Build-time base URL comes from `PLASMO_PUBLIC_APP_URL`.

## Data model

Drizzle schema in `apps/web/src/db/schema.ts`. Migrations in `apps/web/drizzle/`.

```
user ─┬─ account            (Auth.js)
      ├─ session            (Auth.js — database session strategy)
      ├─ collection ──┐
      ├─ watch ───────┴── collection (optional grouping)
      │     ├─ snapshot     (one row per successful fetch — extracted field values)
      │     └─ change       (one row per detected diff — with LLM narration)
      └─ mcp_token          (ut_-prefixed, stored as SHA-256 hash)

verificationToken           (Auth.js — also holds short-lived OTP codes)
markdown_cache              (de-dupes Bright Data fetches across watches)
waitlist_signup             (marketing)
```

## The watch lifecycle

The heart of the system is `apps/web/src/server/tick-one-watch.ts`. For each due watch:

```
fetch markdown        (Bright Data Web Unlocker — src/lib/brightdata.ts)
   │                    retry + browser-zone fallback; result cached in markdown_cache
   ▼
extract field values  (src/lib/extract.ts — LLM against the stored schema)
   │
   ▼
diff vs last snapshot  (src/lib/diff.ts — structural field comparison)
   │
   ├─ no change ──▶ record the check, stop
   │
   ▼ changed
narrate the diff       (src/lib/narrate.ts — LLM turns the diff into a sentence)
   │
   ▼
persist snapshot + change row, then email the user (src/lib/send-email.ts → Resend)
```

The cron route (`/api/cron/tick`) is gated by an `x-cron-secret` header, selects watches whose next-check time has passed, and runs them with **bounded concurrency** (5 in flight, ≤20 per tick) so one slow page can't stall the batch. The result of each tick is a discriminated `TickResult` union — no silent failures; every outcome (unchanged / changed / fetch-error / extract-error) is an explicit branch.

Locally, `scripts/cron-tick-local.sh` POSTs to the tick endpoint; `npm run cron:dev` loops it every 60 s. In production a small Node worker does the same on an interval.

## The AI pipeline

All LLM calls go through the `openai` SDK pointed at the **AI/ML API gateway** (an OpenAI-compatible endpoint), configured in `src/lib/llm.ts`:

- **`LLM_MODEL`** (`google/gemini-3-1-flash-lite`) — single-call paths: schema inference, field extraction, change narration. Cheap and fast (~$0.005/call).
- **`LLM_CHAT_MODEL`** (`google/gemini-3-1-pro-preview`) — the multi-turn chat agent. Pro is used here because Flash-Lite returns `thought_signature` tokens it then rejects on follow-up tool turns through the gateway.

**Schema inference** (`src/lib/infer-schema.ts`) uses a single universal prompt: *"what on this page would change, and how should we represent it?"* It returns a free-form JSON schema with no per-site templates. This replaced an earlier multi-tier pipeline (JSON-LD parsing → cheerio archetypes → LLM fallback) that was deleted wholesale — the universal prompt is ~2× faster, ~3–8× cheaper, and far less code to maintain.

**The chat agent** (`src/lib/chat-agent.ts` + `chat-tools.ts`) runs an OpenAI-style tool-calling loop and streams its turns as NDJSON so the extension can render thinking/tool/answer phases live. Its tools cover fetching a page, inferring/previewing a schema, creating and refining watches, and reading watch state.

## The MCP server

`src/app/api/mcp/route.ts` uses `mcp-handler` + `@modelcontextprotocol/sdk` to serve Streamable-HTTP MCP. Requests authenticate with a personal `ut_`-prefixed token (`src/lib/mcp-auth.ts`), which is SHA-256-hashed and looked up in `mcp_token`; the resolved `userId` is carried through the request via `AsyncLocalStorage` so every tool is automatically scoped to the caller. Five read-only tools (`src/lib/mcp-tools.ts`): `list_watches`, `get_watch`, `get_latest_snapshot`, `get_changes`, `get_schema`.

This is the agent-native half of the product: the same data that emails a human is, byte-for-byte, available to an agent.

## Auth

Auth.js v5 (`src/auth.ts`) with the Drizzle adapter and a **database** session strategy. The primary flow is a passwordless Resend magic link. Because a browser extension can't ride the web app's first-party cookie during the magic-link redirect, the app also mints a **6-digit OTP** (`src/lib/otp.ts`, SHA-256 of `code + AUTH_SECRET`, 15-minute TTL) into `verificationToken`, which the side panel exchanges at `/api/auth/verify-otp` for a session. Cross-origin cookies are configured `SameSite=None; Secure` so the extension origin can authenticate. Route gating is explicit in `src/middleware.ts`.

## Why these choices

- **Monolith over microservices** — one process, one deploy, one place to look when something breaks.
- **Postgres over anything exotic** — relational data with clear foreign keys; no cache layer until latency is measured.
- **One LLM prompt over a template catalog** — generality beat per-site brittleness, and deleting the catalog removed more bugs than it added.
- **Bright Data for fetching** — pages that block naïve fetches (bot walls, JS rendering) resolve through the Web Unlocker without per-site work.
