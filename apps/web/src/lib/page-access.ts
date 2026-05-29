import "server-only";

// Layer-2 "can we actually watch this?" check. We fetch pages as an ANONYMOUS
// visitor (Bright Data), so login walls, error shells, and bot-blocks come back
// as content — and without this guard the LLM would build a schema around that
// junk (e.g. a schema tracking Discord's "Request Failed" message).
//
// Ground truth is the fetched markdown itself. The rule is "signal must
// dominate": only treat a login/error match as fatal on a SHORT page, so a
// long content-rich page with a "Sign in" link in its nav stays watchable.

export type AccessVerdict =
  | { ok: true }
  | { ok: false; reason: "gated" | "error" | "empty"; detail: string };

const GATED_RE =
  /\b(log ?in to continue|sign ?in to continue|please (log ?in|sign ?in)|you (must|need to) (be )?(logged|signed) ?in|sign ?in to (view|see|continue)|create an account to|members only|login required)\b/i;

const ERROR_RE =
  /\b(request failed|something went wrong|an error (has )?occurred|temporarily unavailable|service unavailable|access denied|403 forbidden|page not found|bad gateway|are you (a )?human|verify you are (a )?human|enable javascript|you need to enable javascript|unsupported browser)\b/i;

const MIN_CONTENT = 200; // below this, essentially nothing came back
const SHORT_PAGE = 1500; // only treat login/error signals as dominant under this length

export function contentLooksUnwatchable(markdown: string): AccessVerdict {
  const text = (markdown ?? "").trim();
  // On a SHORT page, a login/error pattern dominates — classify it specifically
  // (these checks run BEFORE the generic "empty" check so a short login wall is
  // reported as gated, not empty). On a LONG page these are ignored, so a real
  // article with "sign in" in its nav stays watchable.
  if (text.length < SHORT_PAGE) {
    if (GATED_RE.test(text)) {
      return {
        ok: false,
        reason: "gated",
        detail:
          "this looks like a login wall. uatchit fetches pages as an anonymous visitor, so anything behind your login isn't visible to it",
      };
    }
    if (ERROR_RE.test(text)) {
      return {
        ok: false,
        reason: "error",
        detail: "the page returned an error instead of content, so there's nothing stable to watch",
      };
    }
  }
  if (text.length < MIN_CONTENT) {
    return {
      ok: false,
      reason: "empty",
      detail:
        "the page returned almost no readable content — likely a private app that needs your login, or a blocked fetch",
    };
  }
  return { ok: true };
}

// Tick-time guard: error/not-found pages announce themselves at the TOP
// ("Page not found", "Request Failed", "Access Denied"…), so we test the error
// patterns against the leading content REGARDLESS of total length. This catches
// a content-rich 404 (e.g. GitHub's 124 KB "Page not found" page) that the
// length-gated contentLooksUnwatchable misses. We only check ERROR_RE here (not
// GATED_RE) so a real content page with a "sign in" CTA stays watchable.
const LEADING_CONTENT = 800;
export function looksLikeErrorPage(markdown: string): boolean {
  const head = (markdown ?? "").trim().slice(0, LEADING_CONTENT);
  return ERROR_RE.test(head);
}

function isPresent(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as object).length > 0;
  return true; // numbers (incl. 0), booleans (incl. false) are real values
}

// Tick-time guard: a watched page that 404s / gates / breaks extracts to all-null
// against the OLD schema, which would otherwise diff as "every field removed" and
// fire a false "everything changed" alert. Treat a wholesale drop as a page break,
// NOT a content change. Requires >=2 previously-populated fields so a legitimate
// single-field removal (e.g. an incident resolving) is still reported normally.
export function allTrackedValuesDropped(
  prev: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>,
): boolean {
  const prevPresent = Object.values(prev ?? {}).filter(isPresent).length;
  const nextPresent = Object.values(next ?? {}).filter(isPresent).length;
  return prevPresent >= 2 && nextPresent === 0;
}

// Human-friendly one-liner for a gated/error/empty reason, for the agent + UI.
export function unwatchableMessage(reason: "gated" | "error" | "empty"): string {
  switch (reason) {
    case "gated":
      return "I can't watch this page — it's behind a login. I only see what a logged-out visitor sees, so private pages (your inbox, a members-only dashboard, a private channel) aren't watchable. Try a public page instead.";
    case "error":
      return "I couldn't read this page — it returned an error instead of content. If it's a logged-in app, I can't reach what's behind your session; otherwise it may have been temporarily down.";
    case "empty":
      return "This page came back nearly empty — usually that means it's a private app that needs your login, or it blocked the fetch. I can only watch publicly visible pages.";
  }
}
