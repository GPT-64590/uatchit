import { useState } from "react";
import { I } from "./Icons";
import { APP_URL } from "../lib/config";

interface Props {
  onSent: (email: string) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignInForm({ onSent }: Props) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      setErr("Enter a valid email.");
      return;
    }
    setSending(true);
    try {
      // 1. CSRF token (also sets the CSRF cookie so the POST can validate it)
      const csrfRes = await fetch(`${APP_URL}/api/auth/csrf`, { credentials: "include" });
      if (!csrfRes.ok) throw new Error(`csrf ${csrfRes.status}`);
      const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

      // 2. Trigger magic-link email. Pass json=true so Auth.js returns JSON
      // instead of a 302 redirect (which fetch + cross-origin handles poorly).
      const body = new URLSearchParams({
        email: trimmed,
        csrfToken,
        // Land link-clicks on a slim "return to the side panel" page rather
        // than yanking the user into the full dashboard.
        callbackUrl: `${APP_URL}/signed-in`,
        json: "true",
      });
      const r = await fetch(`${APP_URL}/api/auth/signin/resend`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
        },
        body,
      });
      if (r.status >= 400) {
        const text = await r.text().catch(() => "");
        throw new Error(`signin ${r.status} ${text.slice(0, 140)}`);
      }
      onSent(trimmed);
    } catch (e: unknown) {
      setErr(String((e as Error)?.message ?? e));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="signedout">
      <div className="signedout-mark"><I.Logo width={22} height={22} /></div>
      <h1 className="signedout-title">Sign in to uatchit</h1>
      <p className="signedout-sub">
        Drop your email — we'll send a one-tap magic link. No password.
      </p>
      <form className="signin-form" onSubmit={submit}>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={sending}
          className="signin-input"
          required
        />
        <button
          type="submit"
          className="signin-submit"
          disabled={sending || !email.trim()}
        >
          {sending ? "Sending…" : (<>Send link <I.ArrowRight width={12} height={12} /></>)}
        </button>
      </form>
      {err && <div className="signin-err mono">{err}</div>}
      <p className="signin-help">
        Single-use, expires in 24 hours. Same email as the dashboard.
      </p>
    </div>
  );
}
