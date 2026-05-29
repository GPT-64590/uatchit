import "server-only";
import { setTimeout as sleep } from "node:timers/promises";
import { env } from "@/lib/env";

const BD_API = "https://api.brightdata.com/request";

export type FetchFormat = "html" | "markdown" | "screenshot";

export interface BDFetchOk {
  ok: true;
  status: number;
  url: string;
  body: string;
  format: FetchFormat;
  durationMs: number;
  zone: string;
}
export interface BDFetchErr {
  ok: false;
  reason: "bd_blocked" | "site_down" | "timeout" | "auth" | "bad_request" | "not_found" | "unknown";
  status?: number;
  detail: string;
  durationMs: number;
}
export type BDResult = BDFetchOk | BDFetchErr;

interface FetchOpts {
  url: string;
  format?: FetchFormat;
  country?: string;
  waitFor?: string;
  timeoutMs?: number;
  zone?: string;
}

const RETRYABLE = new Set(["bd_blocked", "timeout", "unknown"]);

export async function bdFetch(opts: FetchOpts): Promise<BDResult> {
  const {
    url,
    format = "markdown",
    country,
    waitFor,
    timeoutMs = 60_000,
    zone = env.BRIGHTDATA_ZONE_UNLOCKER,
  } = opts;

  const headers: Record<string, string> = {};
  if (waitFor) headers["x-unblock-expect"] = waitFor;

  const payload: Record<string, unknown> = {
    zone,
    url,
    format: "raw",
    ...(format !== "html" && { data_format: format }),
    ...(country && { country }),
    ...(Object.keys(headers).length && { headers }),
  };

  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(BD_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.BRIGHTDATA_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    const durationMs = Date.now() - started;

    if (res.status === 401 || res.status === 403) {
      return { ok: false, reason: "auth", status: res.status, detail: await res.text(), durationMs };
    }
    if (res.status === 400) {
      return { ok: false, reason: "bad_request", status: res.status, detail: await res.text(), durationMs };
    }
    if (!res.ok) {
      return { ok: false, reason: "bd_blocked", status: res.status, detail: await res.text(), durationMs };
    }

    const body = await res.text();
    const upstreamStatus = Number(res.headers.get("x-brd-http-status")) || 200;
    const errCode = res.headers.get("x-brd-err-code");

    if (errCode) {
      const reason = errCode.startsWith("policy_") || errCode.includes("block")
        ? "bd_blocked"
        : "unknown";
      return { ok: false, reason: reason as BDFetchErr["reason"], status: upstreamStatus, detail: errCode, durationMs };
    }
    if (upstreamStatus >= 500) {
      return { ok: false, reason: "site_down", status: upstreamStatus, detail: body.slice(0, 500), durationMs };
    }
    if (upstreamStatus === 429 || upstreamStatus === 403) {
      return { ok: false, reason: "bd_blocked", status: upstreamStatus, detail: body.slice(0, 500), durationMs };
    }
    // A hard 404/410/451 means the page is gone — not a content fetch. Surfacing
    // it stops watches being created on dead URLs and stops the tick diffing a
    // 404 page against real prior content. BD often omits x-brd-http-status
    // (defaults to 200), so the tick ALSO content-checks (see looksLikeErrorPage).
    if (upstreamStatus === 404 || upstreamStatus === 410 || upstreamStatus === 451) {
      return { ok: false, reason: "not_found", status: upstreamStatus, detail: body.slice(0, 500), durationMs };
    }

    return { ok: true, status: upstreamStatus, url, body, format, durationMs, zone };
  } catch (e: unknown) {
    const durationMs = Date.now() - started;
    const err = e as { name?: string; message?: string };
    if (err.name === "AbortError") return { ok: false, reason: "timeout", detail: "client timeout", durationMs };
    return { ok: false, reason: "unknown", detail: String(err?.message ?? e), durationMs };
  } finally {
    clearTimeout(timer);
  }
}

export async function bdFetchWithRetry(
  opts: FetchOpts & { fallbackToBrowser?: boolean }
): Promise<BDResult> {
  const delays = [0, 3_000, 12_000];
  let last: BDResult | undefined;
  for (const d of delays) {
    if (d) await sleep(d);
    last = await bdFetch(opts);
    if (last.ok) return last;
    if (!RETRYABLE.has(last.reason)) return last;
  }
  if (opts.fallbackToBrowser && last && !last.ok) {
    return bdFetch({ ...opts, zone: env.BRIGHTDATA_ZONE_BROWSER });
  }
  return last!;
}
