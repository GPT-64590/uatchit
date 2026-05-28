"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { I } from "./_p/Icons";

type Color = "warn" | "ok" | "muted" | "rm";

const TICKER: { url: string; tag: string; color: Color }[] = [
  { url: "stripe.com/pricing",         tag: "price changed", color: "warn" },
  { url: "openai.com/blog",            tag: "new post",      color: "ok" },
  { url: "linear.app/changelog",       tag: "+4 features",   color: "ok" },
  { url: "sec.gov/.../8-K",            tag: "filing posted", color: "warn" },
  { url: "vercel.com/pricing",         tag: "no change",     color: "muted" },
  { url: "nvd.nist.gov/CVE-2026-2104", tag: "score: HIGH",   color: "rm" },
  { url: "anthropic.com/news",         tag: "new release",   color: "ok" },
];

export function LiveNav() {
  const [scrolled, setScrolled] = useState(false);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % TICKER.length), 2600);
    return () => clearInterval(id);
  }, []);

  const item = TICKER[idx];
  return (
    <header className={`nv nv-live ${scrolled ? "nv-scrolled" : ""}`}>
      <div className="nv-inner">
        <Link href="/" className="nv-brand">
          <I.Logo width={20} height={20} />
          <span>uatchit</span>
          <span className="nv-brand-tag mono">beta</span>
        </Link>

        <div className="nv-ticker" aria-live="polite">
          <span className="nv-ticker-label">
            <span className="nv-ticker-dot" />
            <span className="mono">live</span>
          </span>
          <div className="nv-ticker-window">
            <div key={idx} className="nv-ticker-row">
              <span className="mono nv-ticker-url">{item.url}</span>
              <span className="nv-ticker-sep">·</span>
              <span className={`nv-ticker-tag nv-ticker-tag-${item.color}`}>{item.tag}</span>
            </div>
          </div>
          <span className="nv-ticker-count mono">+12,403 watching</span>
        </div>

        <nav className="nv-links">
          <Link href="/#how">How</Link>
          <Link href="/#cases">Cases</Link>
          <Link href="/#mcp">Agents</Link>
          <Link href="/pricing">Pricing</Link>
        </nav>

        <div className="nv-cta">
          <a href="https://github.com/GPT-64590/uatchit" className="btn btn-quiet" aria-label="GitHub">
            <I.Github width={16} height={16} />
          </a>
          <Link href="/login" className="btn btn-quiet">Sign in</Link>
          <Link href="/extension" className="btn btn-primary">
            <I.Chrome width={15} height={15} /> Add to Chrome
          </Link>
        </div>
      </div>
    </header>
  );
}
