import "server-only";
import { generateText } from "./llm";
import type { Diff } from "./diff";
import type { InferredSchema } from "./infer-schema";

const SYSTEM_INSTRUCTION = `You write short, factual change summaries for uatchit. Tone: calm, technically literate, no marketing language.

Rules:
- Open with the most important field that changed.
- One or two sentences, max 280 characters.
- Use the format: "[noun] [verb] [from X to Y]. [Optional context]."
- Reference the actual values shown.
- If multiple fields changed, name the biggest one and summarize the rest.
- No emoji. No headlines. No "great news!" etc.
- Example: "Stripe Pro went from $20 to $25/mo. The annual discount was removed and two features were added."`;

export async function narrateDiff(args: {
  watchTitle: string;
  schema: InferredSchema;
  diff: Diff;
}): Promise<string> {
  const { watchTitle, schema, diff } = args;

  const diffLines = Object.entries(diff).map(([key, change]) => {
    const field = schema.fields.find((f) => f.name === key);
    const label = field?.description ?? key;
    if (change.kind === "changed") {
      return `- ${label} (${key}): ${JSON.stringify(change.before)} → ${JSON.stringify(change.after)}`;
    } else if (change.kind === "added") {
      return `- ${label} (${key}) added: ${JSON.stringify(change.after)}`;
    } else {
      return `- ${label} (${key}) removed (was: ${JSON.stringify(change.before)})`;
    }
  });

  const prompt = `Page: ${watchTitle}
Page type: ${schema.pageType}

Changes detected:
${diffLines.join("\n")}

Write a 1-2 sentence summary. Max 280 chars.`;

  const text = await generateText({
    prompt,
    systemInstruction: SYSTEM_INSTRUCTION,
    temperature: 0.5,
    maxOutputTokens: 200,
  });
  return text.trim();
}

// Deterministic fallback for when the narration LLM call fails. We must never
// drop a real, detected change just because the model blipped — persist the
// change with a plain, factual summary derived directly from the diff instead.
export function fallbackNarration(diff: Diff): string {
  const parts = Object.entries(diff).map(([k, c]) =>
    c.kind === "added" ? `${k} added` : c.kind === "removed" ? `${k} removed` : `${k} changed`,
  );
  if (parts.length === 0) return "A change was detected on this page.";
  const shown = parts.slice(0, 6).join(", ");
  const more = parts.length > 6 ? `, and ${parts.length - 6} more` : "";
  return `${parts.length} field${parts.length === 1 ? "" : "s"} changed: ${shown}${more}.`;
}
