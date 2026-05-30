import Link from "next/link";
import { I } from "./_p/Icons";

export function Footer() {
  return (
    <footer className="foot">
      <div className="container foot-inner">
        <div className="foot-brand">
          <div className="foot-brand-row">
            <I.Logo width={22} height={22} />
            <span>uatchit</span>
          </div>
          <div className="foot-tag">Right-click any web page. Watch it forever.</div>
          <div className="foot-status mono">
            <span className="foot-status-dot" /> all systems normal
          </div>
        </div>

        <FootCol
          title="Product"
          links={[
            ["How it works", "/#how"],
            ["Use cases", "/#cases"],
            ["For agents", "/#mcp"],
            ["Pricing", "/pricing"],
            ["Get the extension", "/extension"],
          ]}
        />
        <FootCol
          title="Developers"
          links={[
            ["How it works", "/how-it-works"],
            ["MCP reference", "/#mcp"],
            ["Get the extension", "/extension"],
            ["GitHub", "https://github.com/GPT-64590/uatchit"],
          ]}
        />
        <FootCol
          title="Company"
          links={[
            ["Privacy", "/privacy"],
            ["Terms", "/terms"],
            ["Contact", "mailto:hello@uatchit.com"],
          ]}
        />
      </div>

      <div className="foot-fine container">
        <span className="mono">uatchit, inc. · est. 2026</span>
      </div>

      <div className="foot-wordmark" aria-hidden>uatchit</div>
    </footer>
  );
}

function FootCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div className="foot-col">
      <div className="foot-col-title mono">{title}</div>
      <ul>
        {links.map(([label, href], i) => (
          <li key={i}>
            {href.startsWith("/") ? <Link href={href}>{label}</Link> : <a href={href}>{label}</a>}
          </li>
        ))}
      </ul>
    </div>
  );
}
