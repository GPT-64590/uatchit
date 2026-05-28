"use client";
import { useState, type ReactNode } from "react";
import { I } from "./_p/Icons";
import { MotionIn } from "./_p/MotionIn";

export function PricingSection() {
  return (
    <section className="section" id="pricing">
      <div className="container">
        <MotionIn className="pricing-head">
          <div className="section-eyebrow">/ 05 — pricing</div>
          <h2 className="section-title" style={{ textWrap: "balance" }}>
            Free during beta. <em>$15/mo when we launch.</em>
          </h2>
          <p className="section-sub" style={{ margin: "0 auto" }}>
            We&apos;re proving the product. You get everything for nothing while we do.
          </p>
        </MotionIn>

        <div className="tiers">
          <MotionIn className="tier tier-active card" delay={60}>
            <div className="tier-head">
              <div className="tier-name">Beta</div>
              <div className="tier-tag">You&apos;re here</div>
            </div>
            <div className="tier-price">
              <span className="tier-price-amount">Free</span>
              <span className="tier-price-per">during open beta</span>
            </div>
            <ul className="tier-feats">
              <Feat>50 watches</Feat>
              <Feat>3,000 fetches / month</Feat>
              <Feat>Re-check from every 30 minutes</Feat>
              <Feat>90-day change history</Feat>
              <Feat>AI sidebar — unlimited messages</Feat>
              <Feat>MCP feed for every watch</Feat>
              <Feat>Email notifications</Feat>
            </ul>
            <a className="btn btn-primary tier-cta" href="#">
              <I.Chrome width={15} height={15} /> Start watching
              <I.ArrowRight width={14} height={14} />
            </a>
          </MotionIn>

          <MotionIn className="tier tier-future card" delay={140}>
            <div className="tier-head">
              <div className="tier-name">Pro</div>
              <div className="tier-tag tier-tag-quiet">Coming after beta</div>
            </div>
            <div className="tier-price">
              <span className="tier-price-amount">
                $15<span className="tier-price-unit">/mo</span>
              </span>
              <span className="tier-price-per">$120 / year — save 33%</span>
            </div>
            <ul className="tier-feats">
              <Feat>Everything in Beta</Feat>
              <Feat>Priority support</Feat>
              <Feat>First access to new features</Feat>
              <Feat dim>Higher fetch limits</Feat>
              <Feat dim>Team workspaces (Q4)</Feat>
            </ul>
            <NotifyForm />
            <div className="tier-note">No card. No spam. One email at launch.</div>
          </MotionIn>
        </div>
      </div>
    </section>
  );
}

function Feat({ children, dim }: { children: ReactNode; dim?: boolean }) {
  return (
    <li className={`tier-feat ${dim ? "tier-feat-dim" : ""}`}>
      <I.Check width={13} height={13} />
      <span>{children}</span>
    </li>
  );
}

function NotifyForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    try {
      await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {}
    setSubmitted(true);
  }
  if (submitted) {
    return <div className="tier-note" style={{ marginTop: 0, color: "var(--add)" }}>You&apos;re on the list.</div>;
  }
  return (
    <form className="tier-notify" onSubmit={onSubmit}>
      <input
        className="tier-input mono"
        type="email"
        required
        placeholder="you@company.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button type="submit" className="btn btn-ghost tier-input-btn">Notify me</button>
    </form>
  );
}
