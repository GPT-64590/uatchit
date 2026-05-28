import { LiveNav } from "@/components/marketing/LiveNav";
import { Footer } from "@/components/marketing/Footer";

export const metadata = {
  title: "How uatchit works",
  description: "Right-click any page. AI infers a schema. uatchit watches for changes and tells you.",
};

const steps = [
  {
    n: "01",
    title: "Right-click any page",
    body: "Install the extension. Right-click → Watch with uatchit. The Chrome side panel opens.",
  },
  {
    n: "02",
    title: "AI infers what matters",
    body: "Gemini 3.1 Flash-Lite reads the page and proposes a structured schema. Confirm or refine in chat.",
  },
  {
    n: "03",
    title: "We watch forever",
    body: "Bright Data re-fetches on a schedule. Diffs trigger a plain-English summary to your inbox + MCP feed.",
  },
];

export default function HowItWorks() {
  return (
    <>
      <LiveNav />
      <main className="pt-32 pb-24 px-6 max-w-3xl mx-auto">
        <p className="text-[11.5px] font-mono uppercase tracking-[0.04em] text-text-dim mb-3">
          / how it works
        </p>
        <h1 className="text-[clamp(40px,5.6vw,72px)] font-medium tracking-[-0.03em] leading-[1.02] mb-12">
          Three steps.
        </h1>
        <div className="space-y-8">
          {steps.map((s) => (
            <div key={s.n} className="grid grid-cols-[80px_1fr] gap-6 items-start">
              <p className="text-3xl font-mono text-text-faint tracking-tight">{s.n}</p>
              <div>
                <h2 className="text-xl font-medium tracking-[-0.015em] mb-2">{s.title}</h2>
                <p className="text-text-muted text-base leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-16 rounded-2xl border border-border bg-surface backdrop-blur-card p-6">
          <h3 className="text-xs uppercase tracking-[0.04em] font-mono text-text-dim mb-3">
            For developers
          </h3>
          <p className="text-text-muted text-sm leading-relaxed mb-4">
            Every watch is exposed as an MCP endpoint. Connect Claude Desktop or Cursor and your
            agent gets a live read.
          </p>
          <a href="/pricing" className="text-accent text-sm hover:underline">
            See pricing →
          </a>
        </div>
      </main>
      <Footer />
    </>
  );
}
