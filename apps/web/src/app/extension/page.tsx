import Link from "next/link";
import { LiveNav } from "@/components/marketing/LiveNav";
import { Footer } from "@/components/marketing/Footer";
import { I } from "@/components/marketing/_p/Icons";

export const metadata = {
  title: "Add uatchit to Chrome",
  description:
    "Install the uatchit Chrome extension — right-click any page to watch it. Beta install in under a minute.",
};

const GITHUB = "https://github.com/GPT-64590/uatchit";

const installSteps: { title: string; body: React.ReactNode }[] = [
  { title: "Download the build", body: <>Grab the beta build with the button above, then unzip it.</> },
  {
    title: "Open Chrome's extensions page",
    body: <>Go to <code className="ext-code">chrome://extensions</code>.</>,
  },
  {
    title: "Turn on Developer mode",
    body: <>Toggle <strong style={{ color: "var(--text)", fontWeight: 500 }}>Developer mode</strong> on — top-right corner.</>,
  },
  {
    title: "Load it",
    body: <>Click <strong style={{ color: "var(--text)", fontWeight: 500 }}>Load unpacked</strong> and select the folder you just unzipped.</>,
  },
  { title: "Pin it", body: <>Click the puzzle-piece icon in the toolbar and pin uatchit so it&apos;s one click away.</> },
];

const useSteps: { icon: React.ReactNode; title: string; body: string }[] = [
  {
    icon: <I.MousePointer width={18} height={18} />,
    title: "Right-click any page",
    body: "Choose “Watch with uatchit” — or click the uatchit icon to open the side panel.",
  },
  {
    icon: <I.Mail width={18} height={18} />,
    title: "Sign in",
    body: "Enter your email; we send a 6-digit code. Paste it into the panel — no password.",
  },
  {
    icon: <I.Sparkles width={18} height={18} />,
    title: "Confirm what to track",
    body: "The AI reads the page and proposes a structured schema. Refine it in plain English.",
  },
  {
    icon: <I.Eye width={18} height={18} />,
    title: "Then it just watches",
    body: "uatchit re-checks on a schedule and emails you — and your agents — when something changes.",
  },
];

export default function ExtensionPage() {
  return (
    <>
      <LiveNav />
      <main style={{ paddingTop: 132, paddingBottom: 96 }}>
        <div className="container" style={{ maxWidth: 860 }}>
          {/* Hero */}
          <div className="section-eyebrow">/ the extension</div>
          <h1 className="section-title" style={{ fontSize: "var(--fs-h1)", maxWidth: "16ch" }}>
            Add uatchit to Chrome.
          </h1>
          <p className="section-sub" style={{ marginTop: 16 }}>
            The extension is the fastest way in: right-click any page and the side panel&apos;s AI
            figures out what&apos;s worth tracking. Here&apos;s how to get it running in about a minute.
          </p>

          <div className="ext-hero-actions">
            <a href="/uatchit-extension.zip" download className="btn btn-primary">
              <I.Chrome width={16} height={16} /> Download the beta build
            </a>
            <a href={GITHUB} target="_blank" rel="noreferrer" className="btn btn-ghost">
              <I.Github width={15} height={15} /> View the source
            </a>
          </div>
          <p className="ext-note">
            <I.Info width={13} height={13} />
            Coming to the Chrome Web Store soon — the one-minute beta install below works today.
          </p>

          {/* Install */}
          <div className="ext-block">
            <div className="section-eyebrow">/ install the beta build</div>
            <div className="card ext-install">
              {installSteps.map((s, i) => (
                <div key={i} className="ext-step">
                  <span className="ext-num mono">{i + 1}</span>
                  <div>
                    <h2 className="ext-step-t">{s.title}</h2>
                    <p className="ext-step-b">{s.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Usage */}
          <div className="ext-block">
            <div className="section-eyebrow">/ once it&apos;s installed</div>
            <div className="ext-grid">
              {useSteps.map((s, i) => (
                <div key={i} className="card ext-tile">
                  <span className="ext-icon">{s.icon}</span>
                  <h2 className="ext-tile-t">{s.title}</h2>
                  <p className="ext-tile-b">{s.body}</p>
                </div>
              ))}
            </div>
          </div>

          {/* No-install fallback */}
          <div className="cta-card" style={{ marginTop: 64 }}>
            <div className="cta-glow" aria-hidden />
            <div className="cta-content">
              <h3 className="cta-title">
                No install needed <em>to try it.</em>
              </h3>
              <p className="cta-sub">
                Add watches straight from the dashboard by pasting a URL — the extension just adds
                right-click capture and the in-page side panel.
              </p>
            </div>
            <div className="cta-actions">
              <Link href="https://app.uatchit.com/app" className="btn btn-primary">
                Open the dashboard <I.ArrowRight width={14} height={14} />
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
