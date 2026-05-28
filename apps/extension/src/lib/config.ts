/**
 * Single source of truth for the API base URL the extension talks to.
 *
 * Plasmo exposes `process.env.PLASMO_PUBLIC_*` at build time. Set
 * PLASMO_PUBLIC_APP_URL=https://app.uatchit.com before `plasmo build` for prod.
 */

const FALLBACK = "http://localhost:3000";

function fromEnv(): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e = (globalThis as any)?.process?.env ?? {};
  const raw = e.PLASMO_PUBLIC_APP_URL as string | undefined;
  if (!raw) return FALLBACK;
  return raw.replace(/\/+$/, "");
}

export const APP_URL = fromEnv();

export function appUrl(path: string): string {
  if (!path.startsWith("/")) path = "/" + path;
  return `${APP_URL}${path}`;
}
