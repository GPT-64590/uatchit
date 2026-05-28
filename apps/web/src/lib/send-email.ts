import "server-only";
import { Resend } from "resend";
import { render } from "@react-email/components";
import { env } from "@/lib/env";
import ChangeNotificationEmail from "@/emails/change-notification";
import type { Diff } from "./diff";
import type { InferredSchema } from "./infer-schema";

const resend = new Resend(env.RESEND_API_KEY);

export async function sendChangeNotification(args: {
  to: string;
  watchId: string;
  watchTitle: string;
  watchUrl: string;
  narration: string;
  diff: Diff;
  schema: InferredSchema;
  cadenceMinutes: number;
}) {
  const { to, watchId, watchTitle, watchUrl, narration, diff, schema, cadenceMinutes } = args;

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
  const pauseUrl = `${appUrl}/app/watches/${watchId}?tab=settings&action=pause`;
  const unsubscribeUrl = `${appUrl}/app/settings`;
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
    text: `${watchTitle} changed\n\n${narration}\n\nView: ${detailUrl}`,
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
