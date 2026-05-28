"use client";
import { useState, type ReactNode } from "react";
import { I } from "./_p/Icons";
import { MotionIn } from "./_p/MotionIn";

const Q = [
  {
    q: "Why is it free now?",
    a: (
      <>Because nobody has used uatchit yet, and we&apos;d rather learn than charge.
      When we know it works for you, we&apos;ll charge for it.</>
    ),
  },
  {
    q: "Will I lose features when Pro launches?",
    a: (
      <>No. Beta users get a founder tier — same features, same price, indefinitely.
      Details land before launch.</>
    ),
  },
  {
    q: "What happens to my watches at launch?",
    a: (
      <>Nothing. Your watches, schemas, MCP endpoints, and history all stay
      exactly as they were.</>
    ),
  },
  {
    q: "Is it open source?",
    a: (
      <>Yes — it&apos;s public. <a className="faq-link" href="https://github.com/GPT-64590/uatchit" target="_blank" rel="noreferrer">View the source →</a></>
    ),
  },
];

export function FAQ() {
  return (
    <section className="section section-tight">
      <div className="container">
        <MotionIn className="faqs">
          {Q.map((item, i) => (
            <Item key={i} q={item.q}>{item.a}</Item>
          ))}
        </MotionIn>
      </div>
    </section>
  );
}

function Item({ q, children }: { q: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <button type="button" className={`faq ${open ? "faq-open" : ""}`} onClick={() => setOpen((v) => !v)}>
      <div className="faq-q">
        <I.Plus width={14} height={14} />
        <span>{q}</span>
      </div>
      <div className="faq-a">{children}</div>
    </button>
  );
}
