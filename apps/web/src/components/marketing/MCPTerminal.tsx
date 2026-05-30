"use client";
import { useState, type ReactNode } from "react";
import { I } from "./_p/Icons";
import { MotionIn } from "./_p/MotionIn";

type Tab = "curl" | "claude" | "cursor";

const samples: Record<Tab, string[]> = {
  curl: [
    "$ curl -H \"Authorization: Bearer $UATCHIT_KEY\" \\",
    "       https://api.uatchit.com/mcp/watches/wt_8sg2/feed",
    "",
    "{",
    "  \"watch\": \"claude.com/pricing\",",
    "  \"last_changed_at\": \"2026-05-24T14:02:11Z\",",
    "  \"narration\": \"Opus 4.8 added to the Pro plan; usage limit doubled.\",",
    "  \"diff\": { \"pro.usage_limit\": [45, 90] }",
    "}",
  ],
  claude: [
    "// claude_desktop_config.json",
    "{",
    "  \"mcpServers\": {",
    "    \"uatchit\": {",
    "      \"command\": \"npx\",",
    "      \"args\": [\"-y\", \"@uatchit/mcp\"],",
    "      \"env\": { \"UATCHIT_KEY\": \"sk_live_…\" }",
    "    }",
    "  }",
    "}",
  ],
  cursor: [
    "// .cursor/mcp.json",
    "{",
    "  \"servers\": {",
    "    \"uatchit\": {",
    "      \"url\": \"https://api.uatchit.com/mcp\",",
    "      \"headers\": { \"Authorization\": \"Bearer $UATCHIT_KEY\" }",
    "    }",
    "  }",
    "}",
  ],
};

function colorizeLine(line: string, rowKey: number): ReactNode {
  if (line.startsWith("$")) {
    return (
      <>
        <span style={{ color: "var(--text-faint)" }}>$</span>
        <span>{line.slice(1)}</span>
      </>
    );
  }
  if (line.startsWith("//")) {
    return <span style={{ color: "var(--text-dim)", fontStyle: "italic" }}>{line}</span>;
  }
  const pattern = /("[^"]+")(\s*):|:\s*("[^"]+")|:\s*(\d+(?:\.\d+)?)/g;
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const match of line.matchAll(pattern)) {
    const idx = match.index ?? 0;
    if (idx > last) out.push(<span key={`t${rowKey}-${i++}`}>{line.slice(last, idx)}</span>);
    if (match[1]) {
      out.push(<span key={`t${rowKey}-${i++}`} style={{ color: "oklch(72% 0.12 245)" }}>{match[1]}</span>);
      out.push(<span key={`t${rowKey}-${i++}`}>{match[2] ?? ""}:</span>);
    } else if (match[3]) {
      out.push(<span key={`t${rowKey}-${i++}`}>: </span>);
      out.push(<span key={`t${rowKey}-${i++}`} style={{ color: "oklch(78% 0.10 80)" }}>{match[3]}</span>);
    } else if (match[4]) {
      out.push(<span key={`t${rowKey}-${i++}`}>: </span>);
      out.push(<span key={`t${rowKey}-${i++}`} style={{ color: "oklch(78% 0.16 152)" }}>{match[4]}</span>);
    }
    last = idx + match[0].length;
  }
  if (last < line.length) out.push(<span key={`t${rowKey}-${i++}`}>{line.slice(last)}</span>);
  return out.length ? <>{out}</> : <span>{line}</span>;
}

export function MCPTerminal() {
  const [tab, setTab] = useState<Tab>("curl");

  return (
    <section className="section section-tight" id="mcp">
      <div className="container">
        <div className="mcp-grid">
          <MotionIn className="mcp-side">
            <div className="section-eyebrow">/ 04 — for agents</div>
            <h2 className="section-title">
              Every watch is also an <em>MCP feed.</em>
            </h2>
            <p className="section-sub">
              Hand any agent a uatchit endpoint and it reads the page as
              structured data — fresh, diff-aware, and rate-limited politely
              for you.
            </p>
            <div className="mcp-bullets">
              <Bullet label="One key, one URL per watch — no scraping." />
              <Bullet label="Same payload as the email, machine-shaped." />
              <Bullet label="Works with Claude Desktop, Cursor, and any MCP client." />
            </div>
          </MotionIn>

          <MotionIn className="mcp-term card" delay={100}>
            <div className="term-head">
              <div className="term-tabs">
                {([["curl", "curl"], ["claude", "Claude Desktop"], ["cursor", "Cursor"]] as const).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    className={`term-tab ${tab === k ? "term-tab-active" : ""}`}
                    onClick={() => setTab(k)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="term-copy"
                aria-label="Copy"
                onClick={() => navigator.clipboard?.writeText(samples[tab].join("\n"))}
              >
                <I.Copy width={13} height={13} /> Copy
              </button>
            </div>
            <pre className="term-body mono">
              {samples[tab].map((line, i) => (
                <div key={i} className="term-line">
                  <span className="term-ln mono">{String(i + 1).padStart(2, " ")}</span>
                  <span>{colorizeLine(line, i)}</span>
                </div>
              ))}
            </pre>
          </MotionIn>
        </div>
      </div>
    </section>
  );
}

function Bullet({ label }: { label: string }) {
  return (
    <div className="mcp-bullet">
      <div className="mcp-bullet-dot">
        <I.Check width={11} height={11} />
      </div>
      <div>{label}</div>
    </div>
  );
}
