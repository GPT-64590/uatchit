import "server-only";
import OpenAI from "openai";
import { env } from "@/lib/env";
import { z } from "zod";

/**
 * AIMLAPI is OpenAI-compatible. Two models in play:
 *   MODEL       — single-call paths (schema inference, extraction, narration)
 *   CHAT_MODEL  — chat agent multi-turn loop (Flash-Lite breaks on followup
 *                 turns over the gateway because it can't accept Gemini
 *                 thought_signatures back; Pro handles it transparently)
 */
export const llm = new OpenAI({
  apiKey: env.AIMLAPI_KEY,
  baseURL: env.LLM_BASE_URL,
});
export const MODEL = env.LLM_MODEL;
export const CHAT_MODEL = env.LLM_CHAT_MODEL;

/**
 * Translate the legacy thinkingBudget hint into AIMLAPI's max_completion_tokens.
 * Native @google/genai exposed thinkingBudget as an explicit dial; AIMLAPI's
 * OpenAI-compat surface doesn't, but max_completion_tokens caps total output
 * (reasoning + visible), so widening it lets the model reason more without
 * starving the visible answer. thinkingBudget:0 keeps the cap tight; a
 * positive budget adds headroom.
 */
function resolveCompletionCap(maxOutputTokens: number, thinkingBudget?: number): number {
  if (thinkingBudget === undefined) return maxOutputTokens;
  return maxOutputTokens + Math.max(0, thinkingBudget);
}

export async function generateStructured<T>(args: {
  schema: z.ZodType<T>;
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  thinkingBudget?: number;
  model?: string;
}): Promise<T> {
  const {
    schema,
    prompt,
    systemInstruction,
    temperature = 0.1,
    maxOutputTokens = 8192,
    thinkingBudget,
    model = MODEL,
  } = args;

  const jsonSchema = z.toJSONSchema(schema as never) as Record<string, unknown>;

  const response = await llm.chat.completions.create({
    model,
    temperature,
    max_completion_tokens: resolveCompletionCap(maxOutputTokens, thinkingBudget),
    messages: [
      ...(systemInstruction ? [{ role: "system" as const, content: systemInstruction }] : []),
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "Output", strict: true, schema: jsonSchema },
    },
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`LLM returned invalid JSON: ${raw.slice(0, 500)}`);
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Schema mismatch: ${JSON.stringify(result.error.issues).slice(0, 500)}`);
  }
  return result.data;
}

export async function generateText(args: {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  thinkingBudget?: number;
  model?: string;
}): Promise<string> {
  const {
    prompt,
    systemInstruction,
    temperature = 0.5,
    maxOutputTokens = 1024,
    thinkingBudget,
    model = MODEL,
  } = args;

  const response = await llm.chat.completions.create({
    model,
    temperature,
    max_completion_tokens: resolveCompletionCap(maxOutputTokens, thinkingBudget),
    messages: [
      ...(systemInstruction ? [{ role: "system" as const, content: systemInstruction }] : []),
      { role: "user", content: prompt },
    ],
  });

  return response.choices[0]?.message?.content ?? "";
}
