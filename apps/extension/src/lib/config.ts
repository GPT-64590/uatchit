/**
 * Single source of truth for the API base URL the extension talks to.
 *
 * Plasmo exposes `process.env.PLASMO_PUBLIC_*` at build time. Set
 * PLASMO_PUBLIC_APP_URL=https://app.uatchit.com before `plasmo build` for prod.
 */

const FALLBACK = "http://localhost:3000";

// Must reference `process.env.PLASMO_PUBLIC_APP_URL` directly: Plasmo/Parcel
// statically replaces this exact expression at build time. Reading it
// indirectly (e.g. via globalThis.process.env) defeats the inlining, leaving
// the value undefined at runtime and silently falling back to localhost.
const raw = process.env.PLASMO_PUBLIC_APP_URL;

export const APP_URL = raw ? raw.replace(/\/+$/, "") : FALLBACK;

export function appUrl(path: string): string {
  if (!path.startsWith("/")) path = "/" + path;
  return `${APP_URL}${path}`;
}
