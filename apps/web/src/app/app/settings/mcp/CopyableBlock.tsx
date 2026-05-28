"use client";
import { useState } from "react";
import { I } from "@/components/marketing/_p/Icons";

export function CopyableBlock({ text, preStyle = false }: { text: string; preStyle?: boolean }) {
  const [copied, setCopied] = useState(false);

  function onCopy() {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    });
  }

  if (preStyle) {
    return (
      <div style={{ position: "relative" }}>
        <button
          type="button"
          className="mcp-copy"
          onClick={onCopy}
          style={{ position: "absolute", top: 8, right: 8, zIndex: 1 }}
        >
          {copied ? <><I.Check width={10} height={10} /> copied</> : <><I.Copy width={10} height={10} /> copy</>}
        </button>
        <pre className="mcp-config-pre" style={{ margin: 0 }}>{text}</pre>
      </div>
    );
  }

  return (
    <div className="mcp-endpoint-url">
      <button type="button" className="mcp-copy" onClick={onCopy}>
        {copied ? <><I.Check width={10} height={10} /> copied</> : <><I.Copy width={10} height={10} /> copy</>}
      </button>
      {text}
    </div>
  );
}
