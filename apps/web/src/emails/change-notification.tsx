import {
  Html, Head, Preview, Body, Container, Section, Text, Hr, Row, Column,
} from "@react-email/components";

interface FieldChange {
  key: string;
  label?: string;
  kind: "changed" | "added" | "removed";
  before?: unknown;
  after?: unknown;
}

interface Props {
  watchTitle: string;
  watchUrl: string;
  appUrl: string;
  narration: string;
  fieldChanges: FieldChange[];
  cadenceLabel: string;
  recipientEmail: string;
  manageUrl: string;
  pauseUrl: string;
  unsubscribeUrl: string;
  mcpUrl?: string;
  /** Optional context line shown in the muted box at the bottom (e.g. "first price change in 23 days"). */
  contextLine?: string;
  /** Optional time-of-day label for the header pill (e.g. "14:02"). Defaults to current local time. */
  timeLabel?: string;
}

const c = {
  bg: "#ffffff",
  bgSoft: "#f6f7fb",
  bgFooter: "#fbfbfd",
  border: "#ececef",
  borderSoft: "#e0e0e6",
  text: "#0a0a0b",
  textBody: "#111114",
  textMuted: "#4a4a55",
  textDim: "#6b6b76",
  textFaint: "#8a8a93",
  textPlaceholder: "#a0a0a9",
  accent: "#3F88F0",
  addBg: "#dff5e6",
  addText: "#15734a",
  rmBg: "#fde7ec",
  rmText: "#b0223e",
  arrowMute: "#c0c0c8",
  divider: "#c8c8d2",
};

const FONT_STACK =
  "Geist, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO_STACK = "'Geist Mono', ui-monospace, monospace";

function hostOf(url: string): string {
  try { return new URL(url).host; } catch { return url; }
}

function pathOf(url: string): string {
  try {
    const u = new URL(url);
    return u.host + u.pathname.replace(/\/$/, "");
  } catch { return url; }
}

function renderValue(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "string") {
    const s = v.length > 80 ? `${v.slice(0, 80)}…` : v;
    return `"${s}"`;
  }
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v).slice(0, 80);
}

function faviconGradient(host: string): { from: string; to: string } {
  let hash = 0;
  for (let i = 0; i < host.length; i++) hash = (hash * 31 + host.charCodeAt(i)) | 0;
  const h1 = Math.abs(hash) % 360;
  const h2 = (h1 + 50) % 360;
  return {
    from: `hsl(${h1}, 70%, 55%)`,
    to: `hsl(${h2}, 75%, 60%)`,
  };
}

export default function ChangeNotificationEmail({
  watchTitle, watchUrl, appUrl, narration, fieldChanges,
  cadenceLabel, recipientEmail, manageUrl, pauseUrl, unsubscribeUrl,
  mcpUrl, contextLine, timeLabel,
}: Props) {
  const host = hostOf(watchUrl);
  const path = pathOf(watchUrl);
  const fav = faviconGradient(host);
  const time = timeLabel ?? new Date().toLocaleTimeString([], {
    hour: "2-digit", minute: "2-digit", hour12: false,
  });

  return (
    <Html lang="en">
      <Head />
      <Preview>{narration}</Preview>
      <Body style={{ backgroundColor: c.bg, fontFamily: FONT_STACK, color: c.textBody, margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: 600, width: "100%", margin: "0 auto" }}>
          {/* HEADER */}
          <Section style={{ padding: "28px 32px 18px 32px", borderBottom: `1px solid ${c.border}` }}>
            <Row>
              <Column align="left">
                <table cellPadding={0} cellSpacing={0} style={{ display: "inline-table", verticalAlign: "middle" }}>
                  <tbody>
                    <tr>
                      <td style={{ paddingRight: 8, lineHeight: 1 }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="url(#uatchitEmailLogo)" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
                          <defs>
                            <linearGradient id="uatchitEmailLogo" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                              <stop offset="0" stopColor="#7cb0ff" />
                              <stop offset="1" stopColor="#4e7cef" />
                            </linearGradient>
                          </defs>
                          <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                          <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                          <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                          <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                          <circle cx="12" cy="12" r="1" fill="#4e7cef" stroke="none" />
                          <path d="M18.944 12.33a1 1 0 0 0 0-.66 7.5 7.5 0 0 0-13.888 0 1 1 0 0 0 0 .66 7.5 7.5 0 0 0 13.888 0" />
                        </svg>
                      </td>
                      <td style={{ fontSize: 16, fontWeight: 500, color: c.textBody, letterSpacing: "-0.01em", lineHeight: 1 }}>
                        uatchit
                      </td>
                    </tr>
                  </tbody>
                </table>
              </Column>
              <Column align="right" style={{ fontFamily: MONO_STACK, fontSize: 11, color: c.textFaint, letterSpacing: "0.03em", textTransform: "uppercase" }}>
                change · {time}
              </Column>
            </Row>
          </Section>

          {/* HERO */}
          <Section style={{ padding: "32px 32px 8px 32px" }}>
            <Row>
              <Column style={{ width: 48, paddingRight: 12, verticalAlign: "middle" }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 9,
                  background: `linear-gradient(135deg, ${fav.from}, ${fav.to})`,
                }} />
              </Column>
              <Column style={{ verticalAlign: "middle" }}>
                <Text style={{ margin: 0, fontSize: 13, color: c.textDim, fontFamily: MONO_STACK, letterSpacing: "0.02em" }}>
                  {path}
                </Text>
                <Text style={{ margin: "2px 0 0 0", fontSize: 16, fontWeight: 500, color: c.textBody, letterSpacing: "-0.01em" }}>
                  {watchTitle}
                </Text>
              </Column>
            </Row>

            <Text style={{ margin: "24px 0 0 0", fontSize: 22, lineHeight: 1.35, letterSpacing: "-0.025em", color: c.text, fontWeight: 500 }}>
              {narration}
            </Text>
          </Section>

          {/* DIFF FIELDS */}
          {fieldChanges.length > 0 && (
            <Section style={{ padding: "24px 32px 8px 32px" }}>
              <Text style={{ margin: "0 0 10px 0", fontFamily: MONO_STACK, fontSize: 11, color: c.textFaint, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                {fieldChanges.length} field{fieldChanges.length === 1 ? "" : "s"} changed
              </Text>
              <table cellPadding={0} cellSpacing={0} width="100%" style={{ border: `1px solid ${c.border}`, borderRadius: 10, borderCollapse: "separate", overflow: "hidden" }}>
                <tbody>
                  {fieldChanges.map((f, i) => (
                    <tr key={f.key}>
                      <td style={{ padding: "12px 14px", borderBottom: i < fieldChanges.length - 1 ? `1px solid ${c.border}` : "none" }}>
                        <table cellPadding={0} cellSpacing={0} width="100%">
                          <tbody>
                            <tr>
                              <td style={{ fontFamily: MONO_STACK, fontSize: 12, color: c.textDim, verticalAlign: "top", paddingTop: 4 }}>
                                {f.label ?? f.key}
                              </td>
                              <td align="right">
                                {f.kind === "changed" && (
                                  <span>
                                    <span style={{
                                      display: "inline-block", padding: "3px 9px", borderRadius: 5,
                                      background: c.rmBg, color: c.rmText, fontFamily: MONO_STACK, fontSize: 12,
                                      textDecoration: "line-through", textDecorationColor: "rgba(176,34,62,0.4)",
                                    }}>
                                      {renderValue(f.before)}
                                    </span>
                                    <span style={{ display: "inline-block", padding: "0 6px", color: c.arrowMute, fontSize: 13 }}>→</span>
                                    <span style={{
                                      display: "inline-block", padding: "3px 9px", borderRadius: 5,
                                      background: c.addBg, color: c.addText, fontFamily: MONO_STACK, fontSize: 12,
                                    }}>
                                      {renderValue(f.after)}
                                    </span>
                                  </span>
                                )}
                                {f.kind === "added" && (
                                  <span style={{
                                    display: "inline-block", padding: "3px 9px", borderRadius: 5,
                                    background: c.addBg, color: c.addText, fontFamily: MONO_STACK, fontSize: 12,
                                  }}>
                                    + {renderValue(f.after)}
                                  </span>
                                )}
                                {f.kind === "removed" && (
                                  <span style={{
                                    display: "inline-block", padding: "3px 9px", borderRadius: 5,
                                    background: c.rmBg, color: c.rmText, fontFamily: MONO_STACK, fontSize: 12,
                                    textDecoration: "line-through", textDecorationColor: "rgba(176,34,62,0.4)",
                                  }}>
                                    {renderValue(f.before)}
                                  </span>
                                )}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {/* CTA */}
          <Section style={{ padding: "28px 32px 8px 32px" }}>
            <table cellPadding={0} cellSpacing={0}>
              <tbody>
                <tr>
                  <td>
                    <a href={appUrl} style={{
                      display: "inline-block", padding: "13px 22px", borderRadius: 11,
                      background: c.text, color: "#ffffff", fontSize: 14.5, fontWeight: 500,
                      textDecoration: "none", letterSpacing: "-0.005em",
                    }}>
                      View full details &nbsp;→
                    </a>
                  </td>
                  {mcpUrl && (
                    <td style={{ paddingLeft: 8 }}>
                      <a href={mcpUrl} style={{
                        display: "inline-block", padding: "13px 18px", borderRadius: 11,
                        background: c.bg, border: `1px solid ${c.borderSoft}`, color: c.text,
                        fontSize: 14.5, fontWeight: 500, textDecoration: "none", letterSpacing: "-0.005em",
                      }}>
                        Copy MCP url
                      </a>
                    </td>
                  )}
                </tr>
              </tbody>
            </table>
          </Section>

          {/* CONTEXT */}
          {contextLine && (
            <Section style={{ padding: "18px 32px 28px 32px" }}>
              <div style={{
                padding: "14px 16px", background: c.bgSoft, border: `1px solid ${c.border}`,
                borderRadius: 10, fontSize: 13, color: c.textMuted, lineHeight: 1.55,
              }}>
                {contextLine}
              </div>
            </Section>
          )}

          {!contextLine && <Hr style={{ borderColor: c.border, margin: "16px 32px 0 32px" }} />}

          {/* FOOTER */}
          <Section style={{ padding: "18px 32px 28px 32px", borderTop: `1px solid ${c.border}`, background: c.bgFooter }}>
            <Row>
              <Column style={{ fontFamily: MONO_STACK, fontSize: 11, color: c.textFaint, letterSpacing: "0.02em" }}>
                sent to {recipientEmail} · re-checks {cadenceLabel}
              </Column>
              <Column align="right" style={{ fontSize: 11.5 }}>
                <a href={manageUrl} style={{ color: c.textDim, textDecoration: "none" }}>Manage watch</a>
                <span style={{ color: c.divider, padding: "0 6px" }}>·</span>
                <a href={pauseUrl} style={{ color: c.textDim, textDecoration: "none" }}>Pause</a>
                <span style={{ color: c.divider, padding: "0 6px" }}>·</span>
                <a href={unsubscribeUrl} style={{ color: c.textDim, textDecoration: "none" }}>Unsubscribe</a>
              </Column>
            </Row>
            <Row>
              <Column style={{ paddingTop: 14, fontSize: 11, color: c.textPlaceholder, lineHeight: 1.5 }}>
                uatchit · An AI watcher for the web.
              </Column>
            </Row>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
