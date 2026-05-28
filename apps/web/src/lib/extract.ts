import "server-only";
import { z } from "zod";
import { generateStructured } from "./llm";
import type { InferredSchema } from "./infer-schema";

function buildExtractionSchema(fields: InferredSchema["fields"]) {
  const shape: Record<string, z.ZodType> = {};
  for (const f of fields) {
    let zType: z.ZodType;
    switch (f.type) {
      case "string": zType = z.string().nullable(); break;
      case "number": zType = z.number().nullable(); break;
      case "boolean": zType = z.boolean().nullable(); break;
      case "array": zType = z.array(z.unknown()).nullable(); break;
      case "object": zType = z.record(z.string(), z.unknown()).nullable(); break;
      default: zType = z.unknown().nullable();
    }
    shape[f.name] = zType;
  }
  return z.object(shape);
}

const SYSTEM_INSTRUCTION = `You are an extractor for uatchit. Given a known schema and a page's markdown (which preserves links as [text](url)), return the current values of each field.

Rules:
- Return null for any field you can't find — don't guess.
- Return the exact form on the page (dollar amounts with $, dates as written).
- For booleans (e.g. "is_in_stock"), infer from page language.
- No commentary, no extra fields.

Array fields:
- Read the field's description carefully. If it indicates per-item shape (e.g., "each item: {title, url}"), each array element MUST be an object matching that shape, NOT a bare string.
- Extract urls from the [text](url) markdown links in the source — they're right there in the content, do not invent or omit them.
- Use bare-string arrays ONLY when the field description explicitly says strings (rare).
- Prefer 5-15 items per array; truncate the long tail.`;

export async function extractFields(args: {
  schema: InferredSchema;
  markdown: string;
}): Promise<Record<string, unknown>> {
  const { schema, markdown } = args;
  const trimmed = markdown.length > 80_000 ? markdown.slice(0, 80_000) + "\n…[truncated]" : markdown;

  const fieldsTable = schema.fields
    .map((f) => `- ${f.name} (${f.type}): ${f.description}. Locator hint: ${f.locator}`)
    .join("\n");

  const prompt = `Schema fields to extract:
${fieldsTable}

Page markdown:
"""
${trimmed}
"""

Extract the current value of each field. Return a single JSON object keyed by field name.`;

  const zSchema = buildExtractionSchema(schema.fields);

  return generateStructured({
    schema: zSchema as never,
    prompt,
    systemInstruction: SYSTEM_INSTRUCTION,
    temperature: 0.0,
    maxOutputTokens: 4096,
  });
}

export async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
