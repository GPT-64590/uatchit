import Link from "next/link";
import { requireUserId } from "@/lib/auth-helpers";
import { db } from "@/db";
import { mcpTokens } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { I } from "@/components/marketing/_p/Icons";
import { CreateTokenForm } from "./CreateTokenForm";
import { RevokeButton } from "./RevokeButton";
import { CopyableBlock } from "./CopyableBlock";

export default async function MCPTokensPage() {
  const userId = await requireUserId();
  const tokens = await db
    .select()
    .from(mcpTokens)
    .where(eq(mcpTokens.userId, userId))
    .orderBy(desc(mcpTokens.createdAt));

  const mcpUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/mcp`;
  const active = tokens.filter((t) => !t.revokedAt);

  return (
    <div className="wd-container mcp-page">
      <div className="crumbs">
        <Link href="/app/settings">Settings</Link>
        <span className="crumbs-sep">›</span>
        <span className="crumbs-current">MCP keys</span>
      </div>

      <div style={{ marginBottom: 24 }}>
        <h1 className="top-title">MCP keys</h1>
        <p className="top-sub">
          Give Claude Desktop, Cursor, or any MCP-compatible agent live access to your watches.
          Tokens are shown once at creation — save them somewhere safe.
        </p>
      </div>

      <div className="mcp-endpoint-card">
        <div className="mcp-endpoint-h">endpoint</div>
        <CopyableBlock text={mcpUrl} />
        <div className="mcp-endpoint-note">
          Pass your token as <code>Authorization: Bearer ut_…</code> on every request.
          Tools available: <code>list_watches</code>, <code>get_watch</code>, <code>get_latest_snapshot</code>, <code>get_changes</code>, <code>get_schema</code>.
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <CreateTokenForm />
      </div>

      <div className="set-section">
        <div className="set-section-h">
          <I.Key width={11} height={11} style={{ display: "inline", verticalAlign: -2, marginRight: 6 }} />
          Tokens · {active.length} active
        </div>
        {tokens.length === 0 ? (
          <div className="act-empty" style={{ padding: "30px 0" }}>
            No tokens yet. Create one above to wire up Claude Desktop or Cursor.
          </div>
        ) : (
          tokens.map((t) => (
            <div key={t.id} className="mcp-tk-row">
              <div style={{ minWidth: 0 }}>
                <div className="mcp-tk-name">{t.name}</div>
                <div className="mcp-tk-prefix">
                  {t.prefix}…
                  {t.revokedAt && <span className="mcp-tk-revoked">· revoked</span>}
                </div>
                <div className="mcp-tk-last">
                  {t.lastUsedAt
                    ? `last used ${new Date(t.lastUsedAt).toLocaleString()}`
                    : t.revokedAt
                    ? `revoked ${new Date(t.revokedAt).toLocaleDateString()}`
                    : "never used"}
                </div>
              </div>
              {!t.revokedAt && <RevokeButton tokenId={t.id} />}
            </div>
          ))
        )}
      </div>

      <div className="mcp-config-card">
        <div className="mcp-endpoint-h">Claude Desktop config</div>
        <CopyablePre
          text={`{
  "mcpServers": {
    "uatchit": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "${mcpUrl}",
        "--header",
        "Authorization: Bearer ut_<your-token-here>"
      ]
    }
  }
}`}
        />
      </div>

      <div className="mcp-config-card">
        <div className="mcp-endpoint-h">Cursor config</div>
        <CopyablePre
          text={`{
  "mcpServers": {
    "uatchit": {
      "url": "${mcpUrl}",
      "headers": { "Authorization": "Bearer ut_<your-token-here>" }
    }
  }
}`}
        />
      </div>
    </div>
  );
}

function CopyablePre({ text }: { text: string }) {
  return (
    <div style={{ position: "relative" }}>
      <CopyableBlock text={text} preStyle />
    </div>
  );
}
