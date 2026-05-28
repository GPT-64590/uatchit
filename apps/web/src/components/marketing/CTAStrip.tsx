import { I } from "./_p/Icons";
import { MotionIn } from "./_p/MotionIn";

export function CTAStrip() {
  return (
    <section className="cta">
      <div className="container">
        <MotionIn className="cta-card">
          <div className="cta-glow" aria-hidden />
          <div className="cta-content">
            <h3 className="cta-title">
              Watch your first page in <em>15 seconds.</em>
            </h3>
            <p className="cta-sub">
              Install the extension, right-click anywhere, and you&apos;re done.
            </p>
          </div>
          <div className="cta-actions">
            <a className="btn btn-primary" href="#">
              <I.Chrome width={16} height={16} /> Add to Chrome
            </a>
            <a className="btn btn-ghost" href="#">
              Read the docs <I.ArrowRight width={14} height={14} />
            </a>
          </div>
        </MotionIn>
      </div>
    </section>
  );
}
