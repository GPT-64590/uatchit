"use client";
import { useState, useTransition } from "react";
import {
  updateName,
  updateNotificationPref,
  signOutAllSessions,
  deleteAllWatches,
  deleteAccount,
} from "./actions";
import { I } from "@/components/marketing/_p/Icons";

type Prefs = {
  email: boolean;
  digest: boolean;
  onChange: boolean;
  onError: boolean;
};

interface Props {
  initialName: string;
  email: string;
  prefs: Prefs;
  watchCount: number;
  mcpKeyCount: number;
  sessionCount: number;
}

export function SettingsClient({ initialName, email, prefs, watchCount, mcpKeyCount, sessionCount }: Props) {
  const [name, setName] = useState(initialName);
  const [savedName, setSavedName] = useState(initialName);
  const [nameStatus, setNameStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [, startNameTr] = useTransition();
  const [confirm, setConfirm] = useState<null | "deleteWatches" | "deleteAccount" | "signOutAll">(null);
  const [localPrefs, setLocalPrefs] = useState(prefs);

  function onSaveName(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim() === savedName) return;
    setNameStatus("saving");
    startNameTr(async () => {
      const r = await updateName(name);
      if ("ok" in r) {
        setSavedName(name);
        setNameStatus("saved");
        setTimeout(() => setNameStatus("idle"), 1800);
      } else {
        setNameStatus("error");
      }
    });
  }

  function togglePref(key: keyof Prefs) {
    const next = !localPrefs[key];
    setLocalPrefs((p) => ({ ...p, [key]: next }));
    void updateNotificationPref(key, next);
  }

  return (
    <div className="wd-container set-page">
      <div className="crumbs">
        <span className="crumbs-current">Settings</span>
      </div>

      <div style={{ marginBottom: 26 }}>
        <h1 className="top-title">Settings</h1>
        <div className="top-sub">Account, notifications, and danger zone.</div>
      </div>

      {/* ACCOUNT */}
      <div className="set-section">
        <div className="set-section-h">
          <I.User width={11} height={11} style={{ display: "inline", verticalAlign: -2, marginRight: 6 }} />
          Account
        </div>
        <form onSubmit={onSaveName}>
          <div className="set-row">
            <div>
              <div className="set-row-k">Name</div>
              <div className="set-row-k-sub">Shown in the sidebar and on welcome notes.</div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                className="set-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ width: 220 }}
                maxLength={60}
              />
              <button
                type="submit"
                className="btn-ghost"
                disabled={nameStatus === "saving" || name.trim() === savedName}
              >
                {nameStatus === "saving" ? "Saving…" : nameStatus === "saved" ? "Saved" : "Save"}
              </button>
            </div>
          </div>
        </form>
        <div className="set-row">
          <div>
            <div className="set-row-k">Email</div>
            <div className="set-row-k-sub">Sign-in identity. Magic links go here. Email cannot be changed yet.</div>
          </div>
          <div className="set-row-v">{email}</div>
        </div>
      </div>

      {/* NOTIFICATIONS */}
      <div className="set-section">
        <div className="set-section-h">
          <I.Bell width={11} height={11} style={{ display: "inline", verticalAlign: -2, marginRight: 6 }} />
          Notifications
        </div>
        <PrefRow
          label="Email change alerts"
          sub="Get an email each time a watched page changes."
          checked={localPrefs.email}
          onToggle={() => togglePref("email")}
        />
        <PrefRow
          label="Weekly digest"
          sub="One summary per Monday morning — out of scope during beta."
          checked={localPrefs.digest}
          onToggle={() => togglePref("digest")}
          disabled
        />
        <PrefRow
          label="On schema change"
          sub="Alert when uatchit detects fields appearing or disappearing."
          checked={localPrefs.onChange}
          onToggle={() => togglePref("onChange")}
        />
        <PrefRow
          label="On fetch error"
          sub="Notify if a watch fails 3 fetches in a row (page returned a 5xx, was blocked, etc)."
          checked={localPrefs.onError}
          onToggle={() => togglePref("onError")}
        />
      </div>

      {/* SECURITY */}
      <div className="set-section">
        <div className="set-section-h">
          <I.Shield width={11} height={11} style={{ display: "inline", verticalAlign: -2, marginRight: 6 }} />
          Sessions
        </div>
        <div className="set-row">
          <div>
            <div className="set-row-k">Active sessions</div>
            <div className="set-row-k-sub">
              {sessionCount} signed-in {sessionCount === 1 ? "device" : "devices"}. Magic-link sessions last 30 days.
            </div>
          </div>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setConfirm("signOutAll")}
          >
            Sign out of all
          </button>
        </div>
      </div>

      {/* OVERVIEW */}
      <div className="set-section">
        <div className="set-section-h">
          <I.Activity width={11} height={11} style={{ display: "inline", verticalAlign: -2, marginRight: 6 }} />
          Overview
        </div>
        <div className="set-row">
          <div className="set-row-k">Watches</div>
          <div className="set-row-v">{watchCount}</div>
        </div>
        <div className="set-row">
          <div className="set-row-k">MCP keys</div>
          <div className="set-row-v">{mcpKeyCount}</div>
        </div>
        <div className="set-row">
          <div className="set-row-k">Plan</div>
          <div className="set-row-v">beta · all features</div>
        </div>
      </div>

      {/* DANGER */}
      <div className="set-section set-danger">
        <div className="set-section-h">
          <I.Trash width={11} height={11} style={{ display: "inline", verticalAlign: -2, marginRight: 6 }} />
          Danger zone
        </div>
        <div className="set-row">
          <div>
            <div className="set-row-k">Delete all watches</div>
            <div className="set-row-k-sub">Removes every watch, snapshot, and change. Account stays.</div>
          </div>
          <button type="button" className="btn-danger" onClick={() => setConfirm("deleteWatches")}>
            Delete all watches
          </button>
        </div>
        <div className="set-row">
          <div>
            <div className="set-row-k">Delete account</div>
            <div className="set-row-k-sub">Permanently removes your account and all uatchit data.</div>
          </div>
          <button type="button" className="btn-danger" onClick={() => setConfirm("deleteAccount")}>
            <I.Trash width={12} height={12} />
            Delete account
          </button>
        </div>
      </div>

      {confirm && (
        <ConfirmModal
          kind={confirm}
          watchCount={watchCount}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

function PrefRow({
  label,
  sub,
  checked,
  onToggle,
  disabled,
}: {
  label: string;
  sub: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="set-row">
      <div>
        <div className="set-row-k">{label}</div>
        <div className="set-row-k-sub">{sub}</div>
      </div>
      <button
        type="button"
        className="set-toggle"
        aria-checked={checked}
        aria-label={label}
        role="switch"
        onClick={disabled ? undefined : onToggle}
        disabled={disabled}
        style={disabled ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
      />
    </div>
  );
}

function ConfirmModal({
  kind,
  watchCount,
  onCancel,
}: {
  kind: "deleteWatches" | "deleteAccount" | "signOutAll";
  watchCount: number;
  onCancel: () => void;
}) {
  const [pending, start] = useTransition();
  const [phrase, setPhrase] = useState("");

  const config = {
    deleteWatches: {
      title: `Delete ${watchCount} watch${watchCount === 1 ? "" : "es"}?`,
      sub: "All watches, their snapshots, and their change history will be removed. Your MCP keys and account stay.",
      confirmPhrase: "delete watches",
      action: deleteAllWatches,
      btn: "Delete watches",
    },
    deleteAccount: {
      title: "Delete account?",
      sub: "This removes your account, watches, snapshots, changes, and sessions. There is no undo.",
      confirmPhrase: "delete account",
      action: deleteAccount,
      btn: "Delete account",
    },
    signOutAll: {
      title: "Sign out of all devices?",
      sub: "All sessions across browsers and the extension will be ended. You'll need to sign in again with a magic link.",
      confirmPhrase: null as string | null,
      action: signOutAllSessions,
      btn: "Sign out everywhere",
    },
  }[kind];

  const requiresPhrase = !!config.confirmPhrase;
  const canSubmit = !requiresPhrase || phrase.trim().toLowerCase() === config.confirmPhrase;

  function onConfirm() {
    start(async () => {
      await config.action();
      onCancel();
    });
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-h">{config.title}</h2>
        <p className="modal-sub">{config.sub}</p>
        {requiresPhrase && (
          <>
            <label className="new-label">
              Type <code style={{ color: "var(--rm)", fontFamily: "'Geist Mono', monospace" }}>{config.confirmPhrase}</code> to confirm
            </label>
            <input
              className="set-input set-input-mono"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              autoFocus
            />
          </>
        )}
        <div className="modal-foot" style={{ marginTop: 20 }}>
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
          <button type="button" className="btn-danger" onClick={onConfirm} disabled={pending || !canSubmit}>
            {pending ? "Working…" : config.btn}
          </button>
        </div>
      </div>
    </div>
  );
}
