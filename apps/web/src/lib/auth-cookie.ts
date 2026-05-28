// Single source of truth for the session cookie so the OTP verify route mints
// a cookie identical to the one Auth.js issues. SameSite=None;Secure in BOTH
// envs — the Chrome extension reads the session cross-origin, and Chrome
// permits Secure cookies on http://localhost, so dev works too.
const isProd = process.env.NODE_ENV === "production";

export const SESSION_COOKIE_NAME = isProd
  ? "__Secure-authjs.session-token"
  : "authjs.session-token";

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "none" as const,
  secure: true,
  path: "/",
};

export const CSRF_COOKIE_NAME = isProd
  ? "__Host-authjs.csrf-token"
  : "authjs.csrf-token";

export const CSRF_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "none" as const,
  secure: true,
  path: "/",
};

export const SESSION_MAX_AGE_S = 30 * 24 * 60 * 60; // 30 days, matches Auth.js default
