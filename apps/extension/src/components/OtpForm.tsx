import { useState } from "react";
import { I } from "./Icons";
import { APP_URL } from "../lib/config";

interface Props {
  email: string;
  onVerified: (email: string) => void;
  onBack: () => void;
}

export function OtpForm({ email, onVerified, onBack }: Props) {
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const c = code.replace(/\D/g, "");
    if (c.length !== 6) {
      setErr("Enter the 6-digit code.");
      return;
    }
    setVerifying(true);
    try {
      const r = await fetch(`${APP_URL}/api/auth/verify-otp`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: c }),
      });
      const data = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (r.ok && data?.ok) {
        onVerified(email);
        return;
      }
      if (r.status === 429) setErr("Too many tries — wait a few minutes.");
      else if (data?.error === "expired") setErr("That code expired. Send a new one.");
      else setErr("Incorrect or expired code.");
    } catch (e: unknown) {
      setErr(String((e as Error)?.message ?? e));
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="signedout">
      <div className="signedout-mark"><I.Logo width={22} height={22} /></div>
      <h1 className="signedout-title">Enter your code</h1>
      <p className="signedout-sub">
        We sent a 6-digit code to <span className="accent-em">{email}</span>.
        Or click the link in that email — this panel updates either way.
      </p>
      <form className="signin-form" onSubmit={submit}>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          disabled={verifying}
          className="signin-input mono"
          style={{ textAlign: "center", letterSpacing: "0.4em", fontVariantNumeric: "tabular-nums" }}
          autoFocus
          required
        />
        <button type="submit" className="signin-submit" disabled={verifying || code.length !== 6}>
          {verifying ? "Verifying…" : (<>Verify <I.ArrowRight width={12} height={12} /></>)}
        </button>
      </form>
      {err && <div className="signin-err mono">{err}</div>}
      <div className="signin-row">
        <button type="button" className="chip" onClick={onBack}>Use a different email</button>
      </div>
      <p className="signin-help">Code expires in 15 minutes · check spam if it's missing.</p>
    </div>
  );
}
