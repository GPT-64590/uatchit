"use client";
import { useState, useTransition } from "react";
import { I } from "@/components/marketing/_p/Icons";
import { createToken } from "./actions";

export function CreateTokenForm() {
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const { plaintext } = await createToken(name);
      setCreated(plaintext);
      setName("");
    });
  }

  function copy() {
    if (!created) return;
    void navigator.clipboard.writeText(created).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    });
  }

  if (created) {
    return (
      <div className="tk-banner">
        <div className="tk-banner-h">
          <I.Check width={14} height={14} /> Token created — copy it now. You won&apos;t see it again.
        </div>
        <div className="tk-banner-code">{created}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn-primary" onClick={copy}>
            {copied ? <><I.Check width={12} height={12} /> Copied</> : <><I.Copy width={12} height={12} /> Copy token</>}
          </button>
          <button type="button" className="btn-ghost" onClick={() => setCreated(null)}>
            OK, I saved it
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onCreate} className="mcp-endpoint-card" style={{ marginBottom: 0 }}>
      <div className="mcp-endpoint-h">create a new token</div>
      <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Claude Desktop · laptop"
          className="set-input"
          style={{ flex: 1 }}
        />
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Generating…" : <><I.Plus width={13} height={13} /> Create</>}
        </button>
      </div>
      <p className="mcp-endpoint-note" style={{ marginTop: 10 }}>
        Tokens last forever unless revoked. Use one per device for least-privilege rotation.
      </p>
    </form>
  );
}
