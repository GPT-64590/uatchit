"use client";
import { useState } from "react";
import { I } from "@/components/marketing/_p/Icons";

interface Props {
  watchId: string;
  watchTitle: string;
  mcpUrl: string;
}

type Client = "curl" | "claude" | "cursor";

export function McpTab({ watchId, watchTitle, mcpUrl }: Props) {
  const [tab, setTab] = useState<Client>("claude");
  const [copied, setCopied] = useState<string | null>(null);

  function copy(text: string, key: string) {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1400);
    });
  }

  const curlSample = `curl -X POST "${mcpUrl}" \\
  -H "Authorization: Bearer ut_<your-token>" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_watch","arguments":{"watch_id":"${watchId}"}}}'`;

  const claudeSample = `{
  "mcpServers": {
    "uatchit": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "${mcpUrl}",
        "--header",
        "Authorization: Bearer ut_<your-token>"
      ]
    }
  }
}`;

  const cursorSample = `{
  "mcpServers": {
    "uatchit": {
      "url": "${mcpUrl}",
      "headers": { "Authorization": "Bearer ut_<your-token>" }
    }
  }
}`;

  const samples: Record<Client, string> = {
    curl: curlSample,
    claude: claudeSample,
    cursor: cursorSample,
  };

  return (
    <div>
      <div className="mcp-endpoint-card">
        <div className="mcp-endpoint-h">endpoint</div>
        <div className="mcp-endpoint-url">
          {mcpUrl}
          <button
            className="mcp-copy"
            onClick={() => copy(mcpUrl, "url")}
            type="button"
          >
            {copied === "url" ? <><I.Check width={10} height={10} /> copied</> : <><I.Copy width={10} height={10} /> copy</>}
          </button>
        </div>
        <div className="mcp-endpoint-note">
          Pass your MCP token as <code>Authorization: Bearer ut_…</code> on every request.
          Manage tokens at <a href="/app/settings/mcp" style={{ color: "var(--accent)" }}>MCP keys</a>.
          The available tools are <code>list_watches</code>, <code>get_watch</code>, <code>get_latest_snapshot</code>, <code>get_changes</code>, <code>get_schema</code>.
        </div>
      </div>

      <div className="mcp-config-card">
        <div className="mcp-endpoint-h" style={{ marginBottom: 12 }}>
          {watchTitle} — example query
        </div>
        <div className="tabs" style={{ marginBottom: 14, borderBottom: "1px solid var(--border)" }}>
          {(["claude", "cursor", "curl"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`tab ${tab === t ? "active" : ""}`}
              style={{ padding: "10px 14px", border: "none", background: "none", cursor: "pointer" }}
            >
              {t}
            </button>
          ))}
        </div>
        <div style={{ position: "relative" }}>
          <button
            className="mcp-copy"
            onClick={() => copy(samples[tab], `sample-${tab}`)}
            type="button"
            style={{ position: "absolute", top: 8, right: 8, zIndex: 1 }}
          >
            {copied === `sample-${tab}` ? <><I.Check width={10} height={10} /> copied</> : <><I.Copy width={10} height={10} /> copy</>}
          </button>
          <pre className="mcp-config-pre" style={{ margin: 0 }}>{samples[tab]}</pre>
        </div>
      </div>
    </div>
  );
}
