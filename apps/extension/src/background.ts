import { Storage } from "@plasmohq/storage";
import { APP_URL } from "./lib/config";

const storage = new Storage({ area: "local" });

const POLL_ALARM = "uatchit-poll-unseen";
const BADGE_COLOR = "#6EA8FF"; // accent

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "watch",
      title: "Watch with uatchit",
      contexts: ["all"],
    });
  });
  chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR }).catch(() => {});
  chrome.alarms.create(POLL_ALARM, { periodInMinutes: 5, when: Date.now() + 2_000 }).catch(() => {});
  void pollUnseenCount();
});

chrome.runtime.onStartup?.addListener?.(() => {
  chrome.alarms.create(POLL_ALARM, { periodInMinutes: 5, when: Date.now() + 2_000 }).catch(() => {});
  void pollUnseenCount();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POLL_ALARM) void pollUnseenCount();
});

async function pollUnseenCount(): Promise<void> {
  try {
    const res = await fetch(`${APP_URL}/api/me/unseen-count`, { credentials: "include" });
    if (!res.ok) return;
    const data = (await res.json()) as { authenticated: boolean; count: number };
    const text = !data.authenticated || data.count === 0 ? "" : data.count > 99 ? "99+" : String(data.count);
    await chrome.action.setBadgeText({ text }).catch(() => {});
  } catch {
    /* offline / no session — clear badge */
    await chrome.action.setBadgeText({ text: "" }).catch(() => {});
  }
}

/* ------------------------------------------------------------------ */
/* Right-click → side panel + stash intent                              */
/* ------------------------------------------------------------------ */

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;
  // sidePanel.open() MUST be called synchronously inside the user-gesture
  // handler — Chrome rejects it with "may only be called in response to a
  // user gesture" if any await runs first. So: fire the open immediately,
  // then do storage + broadcast async.
  chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});

  const intent = {
    kind: "page" as const,
    url: tab.url,
    title: tab.title,
    selection: info.selectionText ?? null,
    timestamp: Date.now(),
  };
  // Stash for the panel's boot effect (covers cold-open case) AND
  // broadcast a runtime message (covers already-open case — boot effect
  // won't re-run, so the panel needs a live signal).
  void (async () => {
    await storage.set("pending-intent", intent);
    // Small delay so the panel finishes mounting before the message arrives;
    // for already-open panels the message lands immediately on the next tick.
    setTimeout(() => {
      chrome.runtime.sendMessage({ type: "WATCH_INTENT", intent }).catch(() => {
        /* no listener (panel still booting) — boot effect will pick it up from storage */
      });
    }, 200);
  })();
});

/* Icon click → open side panel (no popup) */
chrome.action.onClicked?.addListener?.(async (tab) => {
  if (tab.id) await chrome.sidePanel.open({ tabId: tab.id });
});

/* ------------------------------------------------------------------ */
/* Message relay — auth bridge + manual badge poll                      */
/* ------------------------------------------------------------------ */

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "AUTH_CHECK") {
    (async () => {
      try {
        const res = await fetch(`${APP_URL}/api/me`, { credentials: "include" });
        const data = await res.json();
        sendResponse(data);
      } catch (e) {
        sendResponse({ authenticated: false, error: String(e) });
      }
    })();
    return true; // async
  }

  if (msg?.type === "POLL_UNSEEN_NOW") {
    void pollUnseenCount();
    return;
  }

  return;
});

export {};
