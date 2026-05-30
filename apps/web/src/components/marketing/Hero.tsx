"use client";
import { useEffect, useState, type SVGProps } from "react";
import Link from "next/link";
import { I } from "./_p/Icons";
import { MotionIn } from "./_p/MotionIn";
import { BrowserFrame } from "./_p/BrowserFrame";

export function Hero() {
  return (
    <section className="hero">
      <div className="hero-bg" aria-hidden>
        <div className="hero-glow" />
        <div className="hero-grid" />
      </div>

      <div className="container hero-inner">
        <MotionIn className="eyebrow">
          <span className="dot" />
          <span>Open beta — every feature, free</span>
          <span className="mono" style={{ color: "var(--text-faint)" }}>·</span>
          <span className="mono" style={{ color: "var(--text-dim)" }}>v0.4.2</span>
        </MotionIn>

        <MotionIn as="h1" className="hero-title" delay={80}>
          right-click any web page.
          <br />
          <span className="hero-title-em">watch it forever.</span>
        </MotionIn>

        <MotionIn as="p" className="hero-sub" delay={160}>
          uatchit is a Chrome extension that turns any page into a structured,
          monitored data source. AI infers what matters, watches for changes,
          and narrates them in plain English — to your inbox, or to your agents.
        </MotionIn>

        <MotionIn className="hero-cta" delay={220}>
          <Link href="/extension" className="btn btn-primary">
            <I.Chrome width={16} height={16} /> Add to Chrome — it&apos;s free
          </Link>
        </MotionIn>

        <MotionIn className="hero-meta mono" delay={300}>
          <span>chrome <span style={{ color: "var(--text-faint)" }}>·</span> arc <span style={{ color: "var(--text-faint)" }}>·</span> brave</span>
          <span className="hero-meta-sep" />
          <span>no card required during beta</span>
        </MotionIn>

        <MotionIn className="hero-stage" delay={360}>
          <HeroStage />
        </MotionIn>
      </div>
    </section>
  );
}

function HeroStage() {
  const [step, setStep] = useState(0);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    const seq = [
      { s: 1, t: 1600 },
      { s: 2, t: 2200 },
      { s: 3, t: 3200 },
      { s: 4, t: 3800 },
      { s: 0, t: 1400 },
    ];
    let i = 0, cancelled = false;
    const tick = () => {
      if (cancelled) return;
      setStep(seq[i].s);
      const wait = seq[i].t;
      i = (i + 1) % seq.length;
      window.setTimeout(tick, wait);
    };
    const id = window.setTimeout(tick, 900);
    return () => { cancelled = true; window.clearTimeout(id); };
  }, []);

  useEffect(() => {
    if (step < 2) { setTyped(""); return; }
    const full = step === 2
      ? "Inferring schema…"
      : "I found a pricing page with 3 plans (Free, Pro, Max). I'll track each plan's price, the models included, and usage limits — and tell you the moment anything changes.";
    let i = 0;
    setTyped("");
    const id = setInterval(() => {
      i++;
      setTyped(full.slice(0, i));
      if (i >= full.length) clearInterval(id);
    }, 18);
    return () => clearInterval(id);
  }, [step]);

  return (
    <div className="stage">
      <BrowserFrame url="claude.com/pricing">
        <div className="stage-page">
          <PricingPageMock cursorVisible={step >= 1} />
          {step >= 1 && step < 4 && <ContextMenu />}
          {step === 4 && <ConfirmToast />}
        </div>
      </BrowserFrame>
      <SidePanel step={step} typed={typed} />
    </div>
  );
}

// Claude's sunburst mark — radial tapered rays, clay accent. Approximation
// of Anthropic's brand glyph, drawn inline so the mock needs no asset.
function ClaudeMark(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#d97757" strokeWidth="1.5" strokeLinecap="round" aria-hidden {...p}>
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i * Math.PI) / 6;
        const r1 = i % 2 === 0 ? 2.4 : 3.6;
        const r2 = i % 2 === 0 ? 9.6 : 7.4;
        return (
          <line
            key={i}
            x1={12 + Math.cos(a) * r1}
            y1={12 + Math.sin(a) * r1}
            x2={12 + Math.cos(a) * r2}
            y2={12 + Math.sin(a) * r2}
          />
        );
      })}
    </svg>
  );
}

// Minimal seedling used on each plan card, echoing the real page's tier glyphs.
function Sprout(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>
      <path d="M12 21v-9" />
      <circle cx="12" cy="9.5" r="2.2" />
      <path d="M12 14.5c-2.2 0-3.9-1.6-4.2-3.8M12 14.5c2.2 0 3.9-1.6 4.2-3.8" />
      <circle cx="7.4" cy="10.4" r="1.3" />
      <circle cx="16.6" cy="10.4" r="1.3" />
    </svg>
  );
}

function PricingPageMock({ cursorVisible }: { cursorVisible: boolean }) {
  return (
    <div className="mockpage">
      <div className="mockpage-header">
        <div className="mockpage-logo"><ClaudeMark width={19} height={19} /> Claude</div>
        <div className="mockpage-nav">
          <span>Meet Claude</span><span>Platform</span><span>Solutions</span>
          <span>Pricing</span><span>Resources</span><span>Login</span>
        </div>
        <div className="mockpage-actions">
          <span className="mp-btn-outline">Contact sales</span>
          <span className="mp-btn-solid">Try Claude</span>
        </div>
      </div>
      <div className="mockpage-hero">
        <div className="mockpage-h1">Pricing</div>
        <div className="mockpage-toggle">
          <span className="mp-seg mp-seg-on">Individual</span>
          <span className="mp-seg">Team &amp; Enterprise</span>
          <span className="mp-seg">API</span>
        </div>
      </div>
      <div className="mockpage-tiers">
        <PlanCard
          name="Free"
          subtitle="Try Claude"
          price="$0"
          caption="Free for everyone"
          features={["Chat on web, iOS & Android", "Write, edit & analyze files", "Ask about images & docs"]}
        />
        <PlanCard
          name="Pro"
          subtitle="For everyday productivity"
          price="$17"
          caption="Per month with annual discount ($200 up front). $20 if billed monthly."
          features={["More usage than Free", "Access to Projects", "Connect your tools", "Extended thinking"]}
        />
        <PlanCard
          name="Max"
          subtitle="Get the most out of Claude"
          price="From $100"
          caption="Per month"
          features={["More usage than Pro", "Higher output limits", "Priority at peak times", "Early access to new features"]}
        />
      </div>
      {cursorVisible && (
        <div className="cursor" aria-hidden>
          <I.MousePointer width={18} height={18} />
        </div>
      )}
    </div>
  );
}

function PlanCard({ name, subtitle, price, caption, features }: { name: string; subtitle: string; price: string; caption: string; features: string[] }) {
  return (
    <div className="plan">
      <div className="plan-icon"><Sprout width={26} height={26} /></div>
      <div className="plan-name">{name}</div>
      <div className="plan-sub">{subtitle}</div>
      <div className="plan-price">{price}</div>
      <div className="plan-caption">{caption}</div>
      <div className="plan-btn">Try Claude</div>
      <ul className="plan-feats">
        {features.map((f, i) => (
          <li key={i}><I.Check width={12} height={12} /> {f}</li>
        ))}
      </ul>
    </div>
  );
}

function ContextMenu() {
  return (
    <div className="ctx" role="menu">
      <div className="ctx-row">Back</div>
      <div className="ctx-row">Forward</div>
      <div className="ctx-row">Reload</div>
      <div className="ctx-sep" />
      <div className="ctx-row ctx-highlight">
        <span className="ctx-dot" /> Watch this page with uatchit
        <span className="ctx-kbd mono">⌘⇧W</span>
      </div>
      <div className="ctx-row">Watch this element…</div>
      <div className="ctx-row">Save as…</div>
      <div className="ctx-row">View page source</div>
    </div>
  );
}

function ConfirmToast() {
  return (
    <div className="toast">
      <div className="toast-head">
        <I.Logo width={14} height={14} />
        <span>Watching this page</span>
        <span className="toast-dot" />
      </div>
      <div className="toast-schema mono">
        <div><span className="mono-key">plans</span>: <span className="mono-val">[3]</span></div>
        <div><span className="mono-key">prices</span>: <span className="mono-val">tracked</span></div>
        <div><span className="mono-key">recheck</span>: <span className="mono-val">every 1h</span></div>
      </div>
      <div className="toast-actions">
        <button className="toast-btn-primary">Open sidebar</button>
        <button className="toast-btn-ghost">Dismiss</button>
      </div>
    </div>
  );
}

function SidePanel({ step, typed }: { step: number; typed: string }) {
  return (
    <div className="sidepanel">
      <div className="sp-head">
        <div className="sp-head-row">
          <I.Logo width={15} height={15} />
          <span className="sp-head-title">uatchit</span>
          <span className="sp-head-status">
            <span className="sp-status-dot" /> watching
          </span>
        </div>
        <div className="sp-head-url mono">claude.com/pricing</div>
      </div>

      <div className="sp-chat">
        {step === 0 && (
          <div className="sp-empty">
            <div className="sp-empty-mark">
              <I.Eye width={20} height={20} />
            </div>
            <div className="sp-empty-title">Ready when you are.</div>
            <div className="sp-empty-sub">Right-click any page and choose <em>Watch with uatchit</em>.</div>
          </div>
        )}

        {step >= 1 && (
          <>
            <Message who="user">
              <span className="msg-attach mono"><I.Paperclip width={11} height={11} /> claude.com/pricing</span>
              Watch this page for me.
            </Message>

            {step >= 2 && (
              <Message who="ai" thinking={step === 2}>
                {step === 2 ? (
                  <span className="thinking">
                    <span className="dots"><i /><i /><i /></span>
                    <span>{typed}</span>
                  </span>
                ) : (
                  <>
                    <span>{typed}</span>
                    {step >= 3 && typed.length > 100 && (
                      <div className="schema-card">
                        <div className="schema-card-head mono">inferred schema · claude_pricing</div>
                        <div className="schema-row">
                          <span className="mono-key">plan</span>
                          <span className="mono-val">string</span>
                          <span className="mono-tag">3 found</span>
                        </div>
                        <div className="schema-row">
                          <span className="mono-key">monthly_price</span>
                          <span className="mono-val">currency</span>
                          <span className="mono-tag">USD</span>
                        </div>
                        <div className="schema-row">
                          <span className="mono-key">models[]</span>
                          <span className="mono-val">string[]</span>
                          <span className="mono-tag">tracked</span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </Message>
            )}

            {step >= 3 && typed.length > 100 && (
              <div className="sp-chips">
                <button className="chip">Track all 3 plans</button>
                <button className="chip">Just the Pro plan</button>
                <button className="chip">+ alert on new tier</button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="sp-compose">
        <I.Paperclip width={14} height={14} style={{ color: "var(--text-dim)" }} />
        <div className="sp-input">Ask anything about this page…</div>
        <div className="sp-send"><I.Send width={13} height={13} /></div>
      </div>
    </div>
  );
}

function Message({ who, thinking, children }: { who: "user" | "ai"; thinking?: boolean; children: React.ReactNode }) {
  return (
    <div className={`msg msg-${who}`}>
      {who === "ai" && (
        <div className="msg-avatar">
          <I.Logo width={11} height={11} />
        </div>
      )}
      <div className={`msg-bubble ${thinking ? "msg-bubble-soft" : ""}`}>
        {children}
      </div>
    </div>
  );
}
