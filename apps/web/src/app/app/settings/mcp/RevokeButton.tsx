"use client";
import { useTransition } from "react";
import { I } from "@/components/marketing/_p/Icons";
import { revokeToken } from "./actions";

export function RevokeButton({ tokenId }: { tokenId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className="btn-danger"
      onClick={() => {
        if (!confirm("Revoke this token? Any client using it will stop working.")) return;
        startTransition(() => revokeToken(tokenId));
      }}
      disabled={pending}
      style={{ padding: "6px 11px", fontSize: 12 }}
    >
      <I.Trash width={11} height={11} /> {pending ? "…" : "revoke"}
    </button>
  );
}
