import { I } from "./_p/Icons";
import { MotionIn } from "./_p/MotionIn";
import { DiffFieldsReveal, type DiffFieldData } from "./_p/DiffFieldsReveal";

const DIFF_FIELDS: DiffFieldData[] = [
  { kind: "add", keyName: "pro.models[+]", adds: ['"Opus 4.8"'] },
  { kind: "change", keyName: "pro.usage_limit", from: "45 / 5h", to: "90 / 5h" },
  { kind: "add", keyName: "pro.features[+]", adds: ['"1M token context"', '"Claude in Chrome"'] },
];

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
                  <div className="diff-name">Claude · Pricing</div>
                  <div className="diff-url mono">claude.com/pricing · 2 min ago</div>
                </div>
                <div className="diff-status">
                  <span className="diff-status-dot" /> change detected
                </div>
              </div>

              <div className="diff-narration">
                <span className="diff-narr-mark"><I.Sparkles width={13} height={13} /></span>
                <span>
                  <strong>Claude added Opus 4.8 to the Pro plan</strong> and roughly doubled its
                  usage limit. Two features were added: <em>1M token context</em> and{" "}
                  <em>Claude in Chrome</em>. Pricing held at $17/mo ($20 monthly). No change to Free or Max.
                </span>
              </div>

              <DiffFieldsReveal fields={DIFF_FIELDS} />

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
