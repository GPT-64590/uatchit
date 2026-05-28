/**
 * Lightweight active-tab content extractor for the side panel's chat context.
 *
 * Runs in the page's MAIN world via chrome.scripting.executeScript, walks
 * the DOM, returns a small structured blob the AI can reason about without
 * paying Bright Data.
 */

export interface ExtractedPage {
  url: string;
  title: string;
  headings: string[];
  text: string;
  selection: string | null;
  hostname: string;
}

const MAX_TEXT = 4000;

function pageExtractFn(): {
  url: string;
  title: string;
  headings: string[];
  text: string;
  selection: string | null;
  hostname: string;
} {
  const maxText = 4000;
  const maxHeadings = 12;

  const headings: string[] = [];
  for (const h of Array.from(document.querySelectorAll("h1,h2,h3"))) {
    const t = (h.textContent ?? "").trim().replace(/\s+/g, " ");
    if (t) headings.push(`${h.tagName.toLowerCase()}: ${t}`);
    if (headings.length >= maxHeadings) break;
  }
  const text = (document.body?.innerText ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxText);
  const sel = (window.getSelection?.()?.toString() ?? "").trim();
  return {
    url: location.href,
    title: document.title || location.host,
    headings,
    text,
    selection: sel || null,
    hostname: location.hostname,
  };
}

export async function extractActiveTab(): Promise<ExtractedPage | null> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab?.id || !tab.url?.startsWith("http")) return null;
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: pageExtractFn,
      world: "MAIN",
    });
    const r = results?.[0]?.result;
    if (!r) return null;
    return r as ExtractedPage;
  } catch {
    return null;
  }
}

export function toMarkdown(p: ExtractedPage): string {
  const lines: string[] = [];
  lines.push(`# ${p.title}`);
  lines.push("");
  lines.push(`url: ${p.url}`);
  if (p.headings.length) {
    lines.push("");
    lines.push("## outline");
    for (const h of p.headings) lines.push(`- ${h}`);
  }
  if (p.text) {
    lines.push("");
    lines.push("## text");
    lines.push(p.text);
  }
  if (p.selection) {
    lines.push("");
    lines.push("## selection");
    lines.push(p.selection);
  }
  return lines.join("\n").slice(0, MAX_TEXT + 1500);
}
