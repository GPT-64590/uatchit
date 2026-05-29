import Link from "next/link";
import { signIn } from "@/auth";
import { I } from "@/components/marketing/_p/Icons";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  async function login(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    if (!email) return;
    await signIn("resend", { email, redirectTo: next ?? "/app" });
  }

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

      <div className="auth-grid-layout">
        {/* Left — the form */}
        <section className="auth-card">
          <div className="eyebrow auth-eyebrow">
            <span className="dot" />
            <span>Magic link · no password</span>
          </div>

          <h1 className="auth-title">
            <span className="auth-title-l1">Sign in to</span>{" "}
            <span className="auth-title-em">uatchit.</span>
          </h1>

          <p className="auth-sub">
            Enter your email. We&apos;ll send you a one-time link.
            No password, no setup — single-use and expires in 24 hours.
          </p>

          <form action={login} className="auth-form">
            <label className="auth-label mono" htmlFor="email">Email</label>
            <div className="auth-input-wrap">
              <input
                id="email"
                name="email"
                type="email"
                required
                autoFocus
                placeholder="you@company.com"
                className="auth-input mono"
              />
              <button type="submit" className="auth-submit">
                Send link <I.ArrowRight width={14} height={14} />
              </button>
            </div>

            {error && (
              <div className="auth-error mono">
                <I.X width={11} height={11} />
                <span>{decodeURIComponent(error)}</span>
              </div>
            )}

            <div className="auth-meta mono">
              <span><I.Clock width={11} height={11} /> expires in 24h</span>
              <span className="auth-meta-sep" />
              <span><I.Lock width={11} height={11} /> single-use</span>
            </div>
          </form>

          <p className="auth-foot">
            New to uatchit?{" "}
            <Link href="/" className="auth-foot-link">See what it does →</Link>
          </p>
        </section>

        {/* Right — ambient context strip */}
        <aside className="auth-side">
          <div className="auth-side-card card">
            <div className="auth-side-head">
              <span className="auth-side-dot" />
              <span className="mono">live · pages being watched right now</span>
            </div>

            <ul className="auth-side-list">
              {SAMPLE.map((s, i) => (
                <li key={i} className="auth-side-row" style={{ animationDelay: `${300 + i * 80}ms` }}>
                  <span className="auth-side-fav" style={{ background: s.fav }} />
                  <div className="auth-side-meta">
                    <span className="mono auth-side-url">{s.url}</span>
                    <span className={`auth-side-tag auth-side-tag-${s.tag}`}>{s.label}</span>
                  </div>
                </li>
              ))}
            </ul>

            <div className="auth-side-count mono">
              <span>+12,403 watching globally</span>
              <span style={{ color: "var(--text-faint)" }}>·</span>
              <span>updated 4s ago</span>
            </div>
          </div>

          <div className="auth-side-quote">
            <p>
              &quot;The right-click that finally caught the price change
              before our analyst did.&quot;
            </p>
            <p className="auth-side-quote-cite mono">
              — beta user · finance team
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

const SAMPLE: { url: string; label: string; tag: "ok" | "warn" | "rm" | "muted"; fav: string }[] = [
  { url: "stripe.com/pricing",       label: "price changed",    tag: "warn",  fav: "linear-gradient(135deg, #635BFF, #00D4FF)" },
  { url: "linear.app/changelog",     label: "+4 features",      tag: "ok",    fav: "linear-gradient(135deg, #5E6AD2, #BBC3FF)" },
  { url: "openai.com/blog",          label: "new post",         tag: "ok",    fav: "linear-gradient(135deg, #10A37F, #1A7F64)" },
  { url: "nvd.nist.gov/CVE-2026-…",  label: "score: HIGH",      tag: "rm",    fav: "linear-gradient(135deg, #FF6E55, #FFB04D)" },
  { url: "sec.gov/.../8-K",          label: "filing posted",    tag: "warn",  fav: "linear-gradient(135deg, #003366, #0066CC)" },
  { url: "vercel.com/pricing",       label: "no change",        tag: "muted", fav: "linear-gradient(135deg, #fff, #888)" },
];
