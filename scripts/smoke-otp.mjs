// End-to-end smoke for the OTP backend (no email send): insert a code row the
// way auth.ts does, POST /api/auth/verify-otp like the extension does, and
// assert the session is minted, cookie set, and tokens consumed.
// Requires the dev server running on :3000. Run: node scripts/smoke-otp.mjs
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import pg from "pg";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
function loadEnv(file) {
  const out = {};
  try {
    for (const line of readFileSync(join(ROOT, file), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      out[m[1]] = v;
    }
  } catch {}
  return out;
}
const env = { ...loadEnv(".env"), ...loadEnv(".env.local") };
const DATABASE_URL = env.DATABASE_URL || process.env.DATABASE_URL;
const AUTH_SECRET = env.AUTH_SECRET || process.env.AUTH_SECRET;
const BASE = "http://localhost:3000";
const ORIGIN = "chrome-extension://smoketestabcdef";
if (!DATABASE_URL || !AUTH_SECRET) { console.error("missing DATABASE_URL/AUTH_SECRET in .env"); process.exit(1); }

const hashCode = (code) => createHash("sha256").update(`${code}${AUTH_SECRET}`).digest("hex");
const client = new pg.Client({ connectionString: DATABASE_URL });
const email = `otp-smoke-${Date.now()}@example.com`;
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { cond ? pass++ : fail++; console.log(`${cond ? "✓" : "✗"} ${name} ${extra}`); };

const insertCode = (code, ttlMs) => client.query(
  `INSERT INTO "verificationToken" (identifier, token, expires) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
  [email, hashCode(code), new Date(Date.now() + ttlMs)],
);
async function post(code) {
  const r = await fetch(`${BASE}/api/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({ email, code }),
  });
  return { status: r.status, body: await r.json().catch(() => ({})), setCookie: r.headers.get("set-cookie") || "" };
}

await client.connect();
try {
  let r = await post("000000");
  ok("wrong code → 401", r.status === 401, `(${r.status})`);

  await insertCode("123456", 15 * 60 * 1000);
  r = await post("123456");
  ok("valid code → 200 ok", r.status === 200 && r.body.ok === true, `(${r.status} ${JSON.stringify(r.body)})`);
  ok("session cookie set", /authjs\.session-token/.test(r.setCookie), `(${r.setCookie.slice(0, 70)})`);
  ok("cookie is SameSite=None;Secure", /samesite=none/i.test(r.setCookie) && /secure/i.test(r.setCookie));

  const u = await client.query(`SELECT id, "emailVerified" FROM "user" WHERE email=$1`, [email]);
  ok("user row created + verified", u.rows.length === 1 && !!u.rows[0].emailVerified);
  const userId = u.rows[0]?.id;
  const s = await client.query(`SELECT 1 FROM session WHERE "userId"=$1`, [userId]);
  ok("session row created", s.rows.length >= 1);
  const t0 = await client.query(`SELECT 1 FROM "verificationToken" WHERE identifier=$1`, [email]);
  ok("tokens cleared after sign-in", t0.rows.length === 0);

  await insertCode("654321", -1000);
  r = await post("654321");
  ok("expired code → 401", r.status === 401, `(${r.status} ${JSON.stringify(r.body)})`);

  await insertCode("111111", 15 * 60 * 1000);
  await post("111111");
  r = await post("111111");
  ok("reused code → 401", r.status === 401, `(${r.status})`);

  // cleanup
  await client.query(`DELETE FROM session WHERE "userId"=$1`, [userId]);
  await client.query(`DELETE FROM "verificationToken" WHERE identifier=$1`, [email]);
  await client.query(`DELETE FROM "user" WHERE email=$1`, [email]);
  console.log("cleaned up test rows");
} catch (e) {
  console.error("smoke error", e); fail++;
} finally {
  await client.end();
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
