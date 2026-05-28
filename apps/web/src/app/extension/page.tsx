import Link from "next/link";
import { LiveNav } from "@/components/marketing/LiveNav";
import { Footer } from "@/components/marketing/Footer";
import { I } from "@/components/marketing/_p/Icons";

export const metadata = {
  title: "Add uatchit to Chrome",
  description:
    "Install the uatchit Chrome extension — right-click any page to watch it. Beta install in under a minute.",
};

const installSteps: { title: string; body: React.ReactNode }[] = [
  {
    title: "Download the build",
    body: <>Grab the beta build with the button above, then unzip it.</>,
  },
  {
    title: "Open Chrome's extensions page",
    body: (
      <>
        Go to <code className="px-1.5 py-0.5 rounded bg-surface-2 font-mono text-[12.5px] text-text">chrome://extensions</code>.
      </>
    ),
  },
  {
    title: "Turn on Developer mode",
    body: <>Toggle <strong className="text-text font-medium">Developer mode</strong> on — it&apos;s in the top-right corner.</>,
  },
  {
    title: "Load it",
    body: <>Click <strong className="text-text font-medium">Load unpacked</strong> and select the folder you just unzipped.</>,
  },
  {
    title: "Pin it",
    body: <>Click the puzzle-piece icon in the toolbar and pin uatchit so it&apos;s one click away.</>,
  },
];

const useSteps: { icon: React.ReactNode; title: string; body: string }[] = [
  {
    icon: <I.MousePointer width={16} height={16} />,
    title: "Right-click any page",
    body: "Choose “Watch with uatchit” — or click the uatchit icon to open the side panel.",
  },
  {
    icon: <I.Mail width={16} height={16} />,
    title: "Sign in",
    body: "Enter your email; we send a 6-digit code. Paste it into the panel — no password.",
  },
  {
    icon: <I.Sparkles width={16} height={16} />,
    title: "Confirm what to track",
    body: "The AI reads the page and proposes a structured schema. Refine it in plain English.",
  },
  {
    icon: <I.Eye width={16} height={16} />,
    title: "Then it just watches",
    body: "uatchit re-checks on a schedule and emails you — and your agents — when something changes.",
  },
];

export default function ExtensionPage() {
  return (
    <>
      <LiveNav />
      <main className="pt-32 pb-24 px-6 max-w-3xl mx-auto">
        <p className="text-[11.5px] font-mono uppercase tracking-[0.04em] text-text-dim mb-3">
          / the extension
        </p>
        <h1 className="text-[clamp(38px,5.4vw,68px)] font-medium tracking-[-0.03em] leading-[1.03] mb-4">
          Add uatchit to Chrome.
        </h1>
        <p className="text-text-muted text-base leading-relaxed mb-8 max-w-xl">
          The extension is the fastest way in: right-click any page and the side panel&apos;s
          AI figures out what&apos;s worth tracking. Here&apos;s how to get it running in about a minute.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <a href="/uatchit-extension.zip" download className="btn btn-primary">
            <I.Chrome width={16} height={16} /> Download the beta build
          </a>
          <a
            href="https://github.com/GPT-64590/uatchit"
            className="btn btn-ghost"
            target="_blank"
            rel="noreferrer"
          >
            <I.Github width={15} height={15} /> View the source
          </a>
        </div>
        <p className="text-text-dim text-[13px] mt-4 flex items-center gap-2">
          <I.Info width={13} height={13} />
          Coming to the Chrome Web Store soon. Until then, the one-minute beta install below works today.
        </p>

        {/* Install */}
        <section className="mt-16">
          <p className="text-[11.5px] font-mono uppercase tracking-[0.04em] text-text-dim mb-6">
            / install the beta build
          </p>
          <ol className="space-y-5">
            {installSteps.map((s, i) => (
              <li key={i} className="grid grid-cols-[36px_1fr] gap-4 items-start">
                <span className="flex items-center justify-center w-9 h-9 rounded-full border border-border bg-surface font-mono text-[13px] text-text-muted">
                  {i + 1}
                </span>
                <div className="pt-1">
                  <h2 className="text-[15px] font-medium tracking-[-0.01em] mb-1">{s.title}</h2>
                  <p className="text-text-muted text-[14.5px] leading-relaxed">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Usage */}
        <section className="mt-16">
          <p className="text-[11.5px] font-mono uppercase tracking-[0.04em] text-text-dim mb-6">
            / once it&apos;s installed
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {useSteps.map((s, i) => (
              <div
                key={i}
                className="rounded-2xl border border-border bg-surface backdrop-blur-card p-5"
              >
                <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-accent-soft text-accent mb-3">
                  {s.icon}
                </span>
                <h2 className="text-[15px] font-medium tracking-[-0.01em] mb-1.5">{s.title}</h2>
                <p className="text-text-muted text-[14px] leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* No-install fallback */}
        <div className="mt-16 rounded-2xl border border-border bg-surface backdrop-blur-card p-6">
          <h3 className="text-xs uppercase tracking-[0.04em] font-mono text-text-dim mb-3">
            No install needed to try it
          </h3>
          <p className="text-text-muted text-sm leading-relaxed mb-4">
            You can add watches straight from the dashboard by pasting a URL — the extension just
            adds right-click capture and the in-page side panel.
          </p>
          <Link href="https://app.uatchit.com" className="text-accent text-sm hover:underline">
            Open the dashboard →
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
