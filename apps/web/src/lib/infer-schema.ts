import "server-only";
import { z } from "zod";
import { generateStructured } from "./llm";

export const InferredFieldSchema = z.object({
  name: z.string().describe("Snake_case identifier for this field, e.g. 'pro_plan_price'"),
  type: z.enum(["string", "number", "boolean", "array", "object"]).describe("JSON type"),
  description: z.string().describe(
    "Plain-English description. For array fields, MUST include the per-item shape, e.g. 'list of latest headlines. Each item: {title, url, published_at?}'",
  ),
  locator: z.string().describe(
    "Short plain-English hint of where this lives on the page — e.g. 'the integer in the OT Term Tracker labelled Decisions Issued'. The extractor at cron-tick time uses this to re-find the value.",
  ),
  sampleValue: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

const InferredSchemaBase = z.object({
  /**
   * Free-form descriptor of what this page IS, in the LLM's words.
   * No fixed enum — different pages have meaningfully different shapes.
   * Examples: "api_pricing_matrix", "scotus_term_tracker", "medical_news_homepage",
   * "github_status_page", "single_product_detail".
   */
  pageType: z.string().describe(
    "Short snake_case descriptor of this page's type. Free-form — match what's natural for THIS page.",
  ),
  title: z.string().describe("Best-guess human title of the page"),
  intent: z.string().describe("One calm lowercase sentence describing what we're tracking, for the user."),
  mutationThesis: z.string().describe(
    "Two short lines. Line 1 starts with 'watching' — what we'll alert on. Line 2 starts with 'skipping' — frozen metadata we deliberately ignore. Lowercase, specific to THIS page.",
  ),
  confidence: z.number().min(0).max(1),
});

// Focused (default): minimal, mutation-only — 1-6 typical, 12 hard ceiling.
export const InferredSchemaSchema = InferredSchemaBase.extend({
  fields: z.array(InferredFieldSchema).min(1).max(12),
});

// Broad ("track everything"): comprehensive coverage of substantive content,
// still noise-filtered. Cap is 30 — empirically the AIMLAPI/Gemini structured-
// output gateway rejects this field shape (4-way sampleValue union) at 40 but
// accepts it through 32, so 30 leaves margin while staying 2.5x the focused cap.
export const InferredSchemaSchemaBroad = InferredSchemaBase.extend({
  fields: z.array(InferredFieldSchema).min(1).max(30),
});

export type InferredSchema = z.infer<typeof InferredSchemaSchema>;
export type InferredField = z.infer<typeof InferredFieldSchema>;
export type SchemaBreadth = "focused" | "broad";

/* ------------------------------------------------------------------ */
/* Universal mutation-watch prompt                                     */
/* ------------------------------------------------------------------ */

const SYSTEM = `You are the schema-inference brain for uatchit, a service that re-fetches web pages on a schedule and alerts users when something MEANINGFUL changes between snapshots.

ONE PRINCIPLE: identify fields LIKELY TO DIFFER between two snapshots taken a week apart. This is NOT "important fields." Identity metadata (page name, brand, scheduled dates locked at publish, author names) is important but unwatchable — re-fetching it forever yields zero alerts. Skip it.

MINIMALISM BIAS — read carefully:
- If the page has ONE obvious high-value mutable signal (a counter widget, a status pill, a top-N leaderboard), that is the schema. ONE field. Don't pad with low-value sections.
- Typical schema is 1-6 fields. 12 is a hard ceiling. Maximalist sweeps generate noisy alerts that train users to ignore the watch.
- If you're picking the 7th, 8th, 9th field, ask yourself: would the user actually want a notification when THIS changes? If not, drop it.

PER-ITEM IDENTITY for collection fields:
- When a field represents a collection (rows in a table, items in a feed, plans in a pricing matrix, entries in a leaderboard, models in an API catalog, components on a status page, sessions in a schedule), each element MUST be an OBJECT carrying stable identity (URL, ID, or unique name).
- Do NOT collapse multi-row tables into scalar fields representing only one row — that loses mutation granularity for every other row.
- Extract URLs from [text](url) markdown links in the content — they're right there; do not invent or omit.

USER INTENT (if provided):
- If the user gave explicit intent ("watch the Pro plan price", "alert me when winners are announced", "track cardiology headlines"), the schema is JUST that. One field if possible. Don't fan out into unrelated sections.
- If the user selected/highlighted a specific part of the page, treat that selection as the focus. Build the schema around the section the user highlighted, not the whole page.

OUTPUT FORMAT (strict JSON matching the schema):
- pageType: short snake_case descriptor in your own words. Examples: "scotus_term_tracker", "api_pricing_matrix", "github_repo_landing", "medical_news_homepage", "status_page_dashboard". Match what's natural for THIS page.
- title: the human title of the page.
- intent: one calm lowercase sentence describing what we're tracking, written for the user.
- mutationThesis: exactly two lines. Line 1: "watching <what>" — what we'll alert on, specific. Line 2: "skipping <what>" — the frozen metadata you deliberately decided not to watch. Lowercase. No marketing voice.
- fields: snake_case names. Each field is one a human could reasonably expect to differ a week from now. For arrays, the description must include per-item shape.
- confidence: 0.0-1.0. Reserve 0.9+ for unambiguous cases; lower for genuinely uncertain pages.`;

// "Track everything" mode. Flips the minimalism bias to comprehensive coverage,
// but is NOT a raw whole-page diff — it still filters pure noise so the user
// isn't drowned in alerts. The difference vs SYSTEM is the COVERAGE section.
const BROAD_SYSTEM = `You are the schema-inference brain for uatchit, a service that re-fetches web pages on a schedule and alerts users when something MEANINGFUL changes between snapshots.

The user chose TRACK EVERYTHING: they want to be alerted to ANY substantive content change on this page, not just one signal. Your job is COMPREHENSIVE coverage — capture every meaningful section whose content could plausibly differ between two snapshots.

COVERAGE BIAS — read carefully:
- Enumerate ALL substantive, mutable content: main body text/headings that carry state, every collection (tables, feeds, lists, leaderboards, pricing rows, catalog entries, status components, schedules), every counter/price/status/badge.
- Prefer many fields over few. Cap is 30. It is fine to return 15-30 fields on a content-rich page.
- Group sensibly: a repeating section is ONE array field of objects (with per-item identity), not 20 scalar fields.

STILL FILTER NOISE (this is what separates us from a dumb whole-page diff — do NOT skip this):
- Drop pure chrome and noise: nav menus, footers, cookie/consent banners, ad slots, social-share widgets, "N people viewing", live view counts, rotating promo carousels, session/CSRF tokens, and RELATIVE timestamps like "5 minutes ago" (absolute publish dates are fine).
- If a region exists only to render differently on every load (ads, recommendations, "trending now" shuffles) and carries no signal the user asked about, skip it.

PER-ITEM IDENTITY for collection fields:
- Each element of a collection MUST be an OBJECT carrying stable identity (URL, ID, or unique name). Never collapse a multi-row table into a single scalar.
- Extract URLs from [text](url) markdown links — they're right there; do not invent or omit.

OUTPUT FORMAT (strict JSON matching the schema):
- pageType: short snake_case descriptor in your own words.
- title: the human title of the page.
- intent: one calm lowercase sentence — make clear this watch is comprehensive ("tracking all substantive content on ...").
- mutationThesis: exactly two lines. Line 1: "watching <broad coverage>". Line 2: "skipping <the noise you filtered>". Lowercase.
- fields: snake_case names; arrays carry per-item shape in the description.
- confidence: 0.0-1.0.`;

/* ------------------------------------------------------------------ */
/* Single-pass inference                                               */
/* ------------------------------------------------------------------ */

export async function inferSchema(args: {
  url: string;
  markdown: string;
  userIntent?: string;
  breadth?: SchemaBreadth;
}): Promise<InferredSchema> {
  const { url, markdown, userIntent, breadth = "focused" } = args;
  const broad = breadth === "broad";

  const intentBlock = userIntent
    ? `USER INTENT (verbatim — let this steer the schema${broad ? "; cover it comprehensively" : "; produce the smallest schema that satisfies it"}):\n${userIntent}\n\n`
    : "";

  const closing = broad
    ? "Produce the schema JSON now. Be comprehensive: cover every substantive mutable section, but skip pure noise (ads, nav, view-counts, relative timestamps)."
    : "Produce the schema JSON now. Remember: minimalism beats maximalism. Every field must mutate.";

  const prompt = `URL: ${url}

${intentBlock}PAGE CONTENT (link-preserving markdown — [text](url), - lists, ![alt](src) all carry semantics):
${markdown.slice(0, 100_000)}

${closing}`;

  return generateStructured({
    schema: broad ? InferredSchemaSchemaBroad : InferredSchemaSchema,
    prompt,
    systemInstruction: broad ? BROAD_SYSTEM : SYSTEM,
    temperature: 0.2,
    maxOutputTokens: broad ? 8192 : 4096,
  });
}
