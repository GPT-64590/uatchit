"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { I } from "@/components/marketing/_p/Icons";
import { markChangeSeen, markAllSeen } from "./actions";

export function MarkSeenButton({ changeId, alreadySeen }: { changeId: string; alreadySeen: boolean }) {
  const [seen, setSeen] = useState(alreadySeen);
  const [pending, start] = useTransition();
  if (seen) {
    return (
      <span className="ch-foot-btn" style={{ color: "var(--add)" }}>
        <I.Check width={11} height={11} /> Seen
      </span>
    );
  }
  return (
    <button
      type="button"
      className="ch-foot-btn"
      disabled={pending}
      onClick={() => {
        setSeen(true);
        start(async () => {
          await markChangeSeen(changeId);
        });
      }}
    >
      <I.Check width={11} height={11} /> Mark seen
    </button>
  );
}

export function CopyDiffButton({ diffText }: { diffText: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="ch-foot-btn"
      onClick={() => {
        void navigator.clipboard.writeText(diffText).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1400);
        });
      }}
    >
      <I.Copy width={11} height={11} /> {copied ? "Copied" : "Copy diff"}
    </button>
  );
}

export function MarkAllSeenButton({ watchId, unseenCount }: { watchId: string; unseenCount: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (unseenCount === 0) return null;
  return (
    <button
      type="button"
      className="btn-ghost"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await markAllSeen(watchId);
          router.refresh();
        })
      }
    >
      <I.Check width={13} height={13} /> Mark all {unseenCount} seen
    </button>
  );
}

export function HeaderActions({
  watchId,
  status,
}: {
  watchId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function toggle() {
    start(async () => {
      const { pauseWatch, resumeWatch } = await import("./actions");
      if (status === "paused") await resumeWatch(watchId);
      else await pauseWatch(watchId);
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" className="btn-ghost" onClick={toggle} disabled={pending}>
        {status === "paused" ? <><I.Play width={13} height={13} /> Resume</> : <><I.Pause width={13} height={13} /> Pause</>}
      </button>
      <a className="btn-ghost" href={`?tab=settings`}>
        <I.Settings width={13} height={13} /> Settings
      </a>
    </>
  );
}
