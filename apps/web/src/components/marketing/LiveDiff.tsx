import { I } from "./_p/Icons";
import { MotionIn } from "./_p/MotionIn";

export function LiveDiff() {
  return (
    <section className="section" id="demo">
      <div className="container">
        <div className="diff-grid">
          <MotionIn className="diff-side">
            <div className="section-eyebrow">/ 03 — what arrives</div>
            <h2 className="section-title">
              A change you can <em>actually read.</em>
            </h2>
            <p className="section-sub">
              No raw HTML diffs. No &quot;1,243 characters changed.&quot; Every alert is a
              short narration with the field-level breakdown one click away.
            </p>
            <ul className="diff-list">
              <li><I.Check width={14} height={14} /><span>Plain-English summary, generated per change</span></li>
              <li><I.Check width={14} height={14} /><span>Field-level diff, side-by-side</span></li>
              <li><I.Check width={14} height={14} /><span>Screenshot snapshot before / after</span></li>
              <li><I.Check width={14} height={14} /><span>Same payload at <span className="mono" style={{ color: "var(--accent)" }}>/mcp/watches/:id</span></span></li>
            </ul>
          </MotionIn>

          <MotionIn className="diff-card card" delay={120}>
            <div className="diff">
              <div className="diff-head">
                <div className="diff-fav" />
                <div className="diff-meta">
                  <div className="diff-name">Stripe Pricing</div>
                  <div className="diff-url mono">stripe.com/pricing · 2 min ago</div>
                </div>
                <div className="diff-status">
                  <span className="diff-status-dot" /> change detected
                </div>
              </div>

              <div className="diff-narration">
                <span className="diff-narr-mark"><I.Sparkles width={13} height={13} /></span>
                <span>
                  <strong>Stripe Pro went from $20 to $25/mo.</strong> The annual discount
                  was removed and two features were added: <em>&quot;Custom domains&quot;</em> and{" "}
                  <em>&quot;Webhook replays&quot;</em>. No change to the Starter or Enterprise tiers.
                </span>
              </div>

              <div className="diff-fields">
                <div className="diff-field">
                  <div className="diff-field-key mono">pro.monthly_price</div>
                  <div className="diff-field-vals">
                    <span className="dv dv-rm mono">$20.00</span>
                    <I.ArrowRight width={12} height={12} style={{ color: "var(--text-faint)" }} />
                    <span className="dv dv-add mono">$25.00</span>
                  </div>
                </div>
                <div className="diff-field">
                  <div className="diff-field-key mono">pro.annual_discount</div>
                  <div className="diff-field-vals">
                    <span className="dv dv-rm mono">&quot;2 months free&quot;</span>
                    <I.ArrowRight width={12} height={12} style={{ color: "var(--text-faint)" }} />
                    <span className="dv dv-add mono">null</span>
                  </div>
                </div>
                <div className="diff-field">
                  <div className="diff-field-key mono">pro.features[+]</div>
                  <div className="diff-field-vals diff-field-vals-stack">
                    <span className="dv dv-add mono">+ &quot;Custom domains&quot;</span>
                    <span className="dv dv-add mono">+ &quot;Webhook replays&quot;</span>
                  </div>
                </div>
              </div>

              <div className="diff-actions">
                <button className="btn btn-ghost btn-sm">Open timeline</button>
                <button className="btn btn-quiet btn-sm">Mark as seen</button>
                <button className="btn btn-quiet btn-sm" style={{ marginLeft: "auto" }}>
                  <I.Copy width={13} height={13} /> Copy MCP url
                </button>
              </div>
            </div>
          </MotionIn>
        </div>
      </div>
    </section>
  );
}
