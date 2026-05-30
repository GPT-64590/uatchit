import type { ReactNode } from "react";
import { I } from "./_p/Icons";
import { MotionIn } from "./_p/MotionIn";

export function HowItWorks() {
  return (
    <section className="section" id="how">
      <div className="container">
        <MotionIn>
          <div className="section-eyebrow">/ 01 — how it works</div>
          <h2 className="section-title">
            Three steps. <em>Then it just watches.</em>
          </h2>
          <p className="section-sub">
            No selectors. No XPath. No &quot;wait, what changed?&quot; emails at 2 a.m.
            uatchit figures out what&apos;s worth tracking, then narrates the rest.
          </p>
        </MotionIn>

        <div className="steps">
          <Step
            n="01"
            title="Right-click any page"
            body="In your browser, right-click and pick Watch with uatchit. Optional: select an element or text first to scope the watch."
            delay={60}
          >
            <StepVisA />
          </Step>
          <Step
            n="02"
            title="AI infers a schema"
            body="Gemini reads the page, proposes a structured schema, and asks you what's worth tracking. Refine in plain English."
            delay={140}
          >
            <StepVisB />
          </Step>
          <Step
            n="03"
            title="Get diffs that read like a sentence"
            body="Bright Data re-fetches on a cadence. uatchit narrates changes in plain English, then pushes them to email and your MCP feed."
            delay={220}
          >
            <StepVisC />
          </Step>
        </div>
      </div>
    </section>
  );
}

function Step({ n, title, body, children, delay = 0 }: { n: string; title: string; body: string; children: ReactNode; delay?: number }) {
  return (
    <MotionIn className="step card" delay={delay}>
      <div className="step-visual">{children}</div>
      <div className="step-text">
        <div className="step-n mono">{n}</div>
        <h3 className="step-title">{title}</h3>
        <p className="step-body">{body}</p>
      </div>
    </MotionIn>
  );
}

function StepVisA() {
  return (
    <div className="vis vis-a">
      <div className="vis-page">
        <div className="vis-page-line w70" />
        <div className="vis-page-line w50" />
        <div className="vis-page-block" />
        <div className="vis-page-line w60" />
        <div className="vis-page-line w40" />
      </div>
      <div className="vis-ctx">
        <div className="vis-ctx-row vis-ctx-hl">
          <span className="ctx-dot" /> Watch with uatchit
        </div>
        <div className="vis-ctx-row vis-ctx-muted">Watch this element…</div>
        <div className="vis-ctx-row vis-ctx-muted">Inspect</div>
      </div>
      <div className="vis-cursor"><I.MousePointer width={16} height={16} /></div>
    </div>
  );
}

function StepVisB() {
  return (
    <div className="vis vis-b mono">
      <div className="vis-b-head">
        <span style={{ color: "var(--text-dim)" }}>schema</span>
        <span style={{ color: "var(--accent)" }}>·</span>
        <span>claude_pricing</span>
      </div>
      <div className="vis-b-row">
        <span className="mono-key">plan</span>
        <span className="vis-b-arrow">→</span>
        <span className="mono-val">&quot;Pro&quot;</span>
        <span />
      </div>
      <div className="vis-b-row">
        <span className="mono-key">price</span>
        <span className="vis-b-arrow">→</span>
        <span className="mono-val">$17.00</span>
        <span className="mono-tag">USD/mo</span>
      </div>
      <div className="vis-b-row">
        <span className="mono-key">models</span>
        <span className="vis-b-arrow">→</span>
        <span className="mono-val">string[5]</span>
        <span />
      </div>
      <div className="vis-b-row">
        <span className="mono-key">recheck</span>
        <span className="vis-b-arrow">→</span>
        <span className="mono-val">1 hour</span>
        <span />
      </div>
      <div className="vis-b-pulse">
        <span className="dots"><i /><i /><i /></span>
        <span style={{ color: "var(--text-dim)" }}>inferring 3 more fields…</span>
      </div>
    </div>
  );
}

function StepVisC() {
  return (
    <div className="vis vis-c">
      <div className="vis-c-row">
        <span className="vis-c-time mono">14:02</span>
        <div className="vis-c-card">
          <div className="vis-c-title">Claude Pro: + Opus 4.8</div>
          <div className="vis-c-sub">Usage limit doubled. Two features added.</div>
        </div>
      </div>
      <div className="vis-c-row">
        <span className="vis-c-time mono">08:14</span>
        <div className="vis-c-card vis-c-card-quiet">
          <div className="vis-c-title">no change</div>
        </div>
      </div>
      <div className="vis-c-row">
        <span className="vis-c-time mono">y&apos;day</span>
        <div className="vis-c-card">
          <div className="vis-c-title">New model: Haiku 4.5</div>
          <div className="vis-c-sub">Now available on Free and Pro.</div>
        </div>
      </div>
    </div>
  );
}
