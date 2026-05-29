import "server-only";
import { Resend } from "resend";
import { render } from "@react-email/components";
import { env } from "@/lib/env";
import { signEmailToken } from "@/lib/email-tokens";
import ChangeNotificationEmail from "@/emails/change-notification";
import type { Diff } from "./diff";
import type { InferredSchema } from "./infer-schema";

const resend = new Resend(env.RESEND_API_KEY);

export async function sendChangeNotification(args: {
  to: string;
  userId: string;
  watchId: string;
  watchTitle: string;
  watchUrl: string;
  narration: string;
  diff: Diff;
  schema: InferredSchema;
  cadenceMinutes: number;
}) {
  const { to, userId, watchId, watchTitle, watchUrl, narration, diff, schema, cadenceMinutes } = args;

  const fieldChanges = Object.entries(diff).map(([key, change]) => {
    const field = schema.fields.find((f) => f.name === key);
    return {
      key,
      label: field?.description ?? key,
      kind: change.kind,
      before: "before" in change ? change.before : undefined,
      after: "after" in change ? change.after : undefined,
    };
  });

  const appUrl = env.NEXT_PUBLIC_APP_URL;
  const detailUrl = `${appUrl}/app/watches/${watchId}`;
  const manageUrl = `${appUrl}/app/watches/${watchId}?tab=settings`;
  // Real one-click actions (HMAC-signed, no login bounce). The old pauseUrl set a
  // dead ?action=pause the page ignored, and unsubscribe pointed at the auth-
  // gated settings page with no actual unsubscribe.
  const pauseUrl = `${appUrl}/api/email/pause?token=${signEmailToken({ u: userId, w: watchId, a: "pause" })}`;
  const unsubscribeUrl = `${appUrl}/api/email/unsubscribe?token=${signEmailToken({ u: userId, a: "unsubscribe" })}`;
  const mcpUrl = `${appUrl}/app/watches/${watchId}?tab=mcp`;
  const fieldCount = fieldChanges.length;
  const contextLine = fieldCount > 0
    ? `${fieldCount} field${fieldCount === 1 ? "" : "s"} changed on this watch. View the full timeline for context and previous snapshots.`
    : undefined;

  const html = await render(
    ChangeNotificationEmail({
      watchTitle,
      watchUrl,
      appUrl: detailUrl,
      narration,
      fieldChanges,
      cadenceLabel: cadenceLabelFromMinutes(cadenceMinutes),
      recipientEmail: to,
      manageUrl,
      pauseUrl,
      unsubscribeUrl,
      mcpUrl,
      contextLine,
    })
  );

  const subject = `${watchTitle} changed — ${truncate(narration, 60)}`;

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject,
    html,
    text: `${watchTitle} changed\n\n${narration}\n\nView: ${detailUrl}\n\nUnsubscribe: ${unsubscribeUrl}`,
    headers: {
      // Gmail/Yahoo bulk-sender requirement (RFC 8058 one-click unsubscribe).
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
  if (error) throw new Error(`Resend error: ${JSON.stringify(error)}`);
}

/**
 * One-time "we can no longer reach this page" notice, sent when a watch crosses
 * the consecutive-failure threshold (404/error/gated/unfetchable). Reuses the
 * change-notification template with no diff rows — accurate and actionable,
 * unlike the false "everything changed" emails this replaces.
 */
export async function sendWatchUnreachableNotice(args: {
  to: string;
  userId: string;
  watchId: string;
  watchTitle: string;
  watchUrl: string;
  detail: string;
  cadenceMinutes: number;
}) {
  const { to, userId, watchId, watchTitle, watchUrl, detail, cadenceMinutes } = args;
  const appUrl = env.NEXT_PUBLIC_APP_URL;
  const detailUrl = `${appUrl}/app/watches/${watchId}`;
  const manageUrl = `${appUrl}/app/watches/${watchId}?tab=settings`;
  const unsubscribeUrl = `${appUrl}/api/email/unsubscribe?token=${signEmailToken({ u: userId, a: "unsubscribe" })}`;
  const narration = `uatchit can no longer read this page — ${detail}. The watch is paused until you resume it.`;

  const html = await render(
    ChangeNotificationEmail({
      watchTitle,
      watchUrl,
      appUrl: detailUrl,
      narration,
      fieldChanges: [],
      cadenceLabel: cadenceLabelFromMinutes(cadenceMinutes),
      recipientEmail: to,
      manageUrl,
      pauseUrl: manageUrl,
      unsubscribeUrl,
      contextLine: "Resume the watch from its settings once the page is back online. We won't keep emailing about this one.",
    })
  );

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: `${watchTitle} — page no longer reachable`,
    html,
    text: `${watchTitle}\n\n${narration}\n\nManage: ${manageUrl}\n\nUnsubscribe: ${unsubscribeUrl}`,
    headers: {
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
  if (error) throw new Error(`Resend error: ${JSON.stringify(error)}`);
}

function cadenceLabelFromMinutes(m: number): string {
  if (m < 60) return `every ${m}m`;
  if (m < 1440) return `every ${Math.round(m / 60)}h`;
  return `every ${Math.round(m / 1440)}d`;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}
