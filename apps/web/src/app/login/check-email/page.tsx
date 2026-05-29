import Link from "next/link";
import { I } from "@/components/marketing/_p/Icons";

export default function CheckEmailPage() {
  return (
    <main className="auth">
      <div className="auth-bg" aria-hidden>
        <div className="auth-glow" />
        <div className="auth-grid" />
      </div>

      <Link href="/" className="auth-brand">
        <I.Logo width={20} height={20} />
        <span>uatchit</span>
        <span className="auth-brand-tag mono">beta</span>
      </Link>

      <section className="auth-check">
        <div className="auth-check-mark" aria-hidden>
          <I.Bell width={22} height={22} />
          <span className="auth-check-pulse" />
        </div>

        <h1 className="auth-title">
          <span className="auth-title-l1">Check</span>{" "}
          <span className="auth-title-em">your inbox.</span>
        </h1>

        <p className="auth-sub" style={{ maxWidth: "44ch" }}>
          We just sent a sign-in link. It expires in 24 hours and can only be used once.
          The link opens uatchit and signs you in automatically.
        </p>

        <div className="auth-check-tips">
          <div className="auth-check-tip">
            <span className="auth-check-tip-n mono">01</span>
            <span>The email is from <span className="mono">noreply@uatchit.com</span>.</span>
          </div>
          <div className="auth-check-tip">
            <span className="auth-check-tip-n mono">02</span>
            <span>If it doesn&apos;t arrive in 60 seconds, check spam.</span>
          </div>
          <div className="auth-check-tip">
            <span className="auth-check-tip-n mono">03</span>
            <span>Wrong email? <Link href="/login" className="auth-foot-link">Try again</Link>.</span>
          </div>
        </div>

        <p className="auth-foot" style={{ marginTop: 32 }}>
          Already signed in?{" "}
          <Link href="/app" className="auth-foot-link">Go to your dashboard →</Link>
        </p>
      </section>
    </main>
  );
}
