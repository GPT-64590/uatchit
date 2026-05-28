import type { ReactNode } from "react";
import { I } from "./_p/Icons";
import { MotionIn } from "./_p/MotionIn";

export function UseCases() {
  return (
    <section className="section section-tight" id="cases">
      <div className="container">
        <MotionIn>
          <div className="section-eyebrow">/ 02 — who&apos;s watching</div>
          <h2 className="section-title">
            Built for people who <em>need to know first.</em>
          </h2>
        </MotionIn>

        <div className="cases">
          <Case
            icon={<I.Trend width={18} height={18} />}
            title="Go-to-market"
            badge="GTM"
            delay={60}
            body="Track competitor pricing, feature launches, and positioning. Get a Slack-able summary the moment a tier shifts."
            payload={[
              ["watch", "\"linear.app/pricing\""],
              ["delta", "\"Plus tier $8 → $10\""],
              ["since", "\"3 days ago\""],
            ]}
          />
          <Case
            icon={<I.Scale width={18} height={18} />}
            title="Finance & legal"
            badge="FIN"
            delay={130}
            body="Watch SEC filings, regulatory pages, and 10-Q updates. Diffs land in your inbox before the analyst note does."
            payload={[
              ["watch", "\"sec.gov/cgi-bin/browse-edgar\""],
              ["delta", "\"New 8-K filing — Q3 guidance\""],
              ["risk", "\"material\""],
            ]}
            featured
          />
          <Case
            icon={<I.Lock width={18} height={18} />}
            title="Security & ops"
            badge="SEC"
            delay={200}
            body="Watch status pages, CVE feeds, and policy docs. Hand the MCP endpoint to your on-call agent and let it page you."
            payload={[
              ["watch", "\"nvd.nist.gov/vuln\""],
              ["delta", "\"CVE-2026-2104 → HIGH\""],
              ["score", "8.6"],
            ]}
          />
        </div>
      </div>
    </section>
  );
}

function Case({ icon, title, badge, body, payload, delay, featured }: { icon: ReactNode; title: string; badge: string; body: string; payload: [string, string][]; delay?: number; featured?: boolean }) {
  return (
    <MotionIn className={`case card ${featured ? "case-featured" : ""}`} delay={delay}>
      <div className="case-head">
        <span className="case-icon">{icon}</span>
        <span className="case-badge mono">{badge}</span>
      </div>
      <h3 className="case-title">{title}</h3>
      <p className="case-body">{body}</p>
      <div className="case-payload">
        <div className="case-payload-head mono">
          <span style={{ color: "var(--text-faint)" }}>$</span> uatchit feed
        </div>
        {payload.map(([k, v], i) => (
          <div key={i} className="case-payload-row mono">
            <span className="mono-key">{k}</span>
            <span style={{ color: "var(--text-faint)" }}>:</span>
            <span className="mono-val">{v}</span>
          </div>
        ))}
      </div>
    </MotionIn>
  );
}
