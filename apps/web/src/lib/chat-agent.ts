import "server-only";
import { z } from "zod";
import { llm, CHAT_MODEL } from "./llm";
import { TOOLS, executeTool, type ToolCtx } from "./chat-tools";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";

// One LLM call per turn; a text-only reply ends the loop. Each user message gets
// a fresh budget, so this only bounds a single message that needs many sequential
// tool calls (e.g. "watch these 5 URLs"). 10 gives headroom for multi-action asks.
const MAX_TURNS = 10;

/**
 * Wire-level message — the side panel sends a history of these and the agent
 * fans them into OpenAI chat messages. Tool-result history lets the model
 * "remember" what it inferred two turns ago without re-running the tool.
 */
export type ChatMessage =
  | { role: "user"; text: string }
  | { role: "model"; text?: string; toolCalls?: Array<{ id: string; name: string; args: Record<string, unknown> }> }
  | { role: "tool"; results: Array<{ id: string; name: string; ok: boolean; result: unknown }> };

export interface AgentInput {
  userId: string;
  messages: ChatMessage[];
  pageContext?: { url?: string; title?: string; markdown?: string };
}

export type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "tool_call"; id: string; name: string; args: Record<string, unknown> }
  | { type: "tool_result"; id: string; name: string; display: string; ok: boolean; result: unknown }
  | { type: "error"; detail: string }
  | { type: "done" };

const SYSTEM_INSTRUCTION = `You are the uatchit assistant, embedded in a Chrome side panel. The user is browsing the web; the active tab is given as page context. uatchit watches pages for MEANINGFUL changes — fields that mutate between snapshots, not frozen metadata.

Voice: calm, technically literate, brief. Match Linear / Vercel / Raycast. Never marketing-y. Short sentences with periods. No emoji unless functional. Use lowercase "mcp" "url" "ai" in body.

Capabilities — you have tools that ACT on the user's data. Use them proactively:
- "watch this page" / "track this" → see "watch-flow" decision below.
- "what changed" / "any updates" / "what's new" → call get_recent_changes.
- "what am I watching" → call list_watches.
- "pause stripe" / "stop watching X" → list_watches to resolve name → update_watch (prefer pause over delete).
- "is this already watched" / before suggesting create_watch → call get_watch_by_url first.
- comparing pages / referring to another URL → call fetch_page.

Watch-flow decision (use the active tab context — url, title, headings — to decide):

INTENT EXISTS — call preview_schema immediately with that intent. No clarifying question.
- User typed an explicit goal ("watch the Pro plan price", "alert me when winners are posted", "track cardiology headlines")
- User's message contains a highlighted/selected block (it usually starts with "I highlighted this — make it the focus" or quotes a selection from the page). The selection IS the intent — pass it verbatim as preview_schema(intent="<the selection>"). The schema must focus on that section, not the whole page.

OBVIOUS pages — call preview_schema immediately, NO clarifying question:
- One single product / job posting / single article / repo landing / status page with one obvious counter / changelog / release notes / single ticker / single waitlist signup
- These pages have one well-known mutation pattern; asking would be friction.

AMBIGUOUS pages — REQUIRED to ask ONE clarifying question first, BEFORE preview_schema:
- Multi-section news/media homepages (medscape, statnews, bbc news front, hn frontpage, reddit subreddit)
- Multi-component dashboards or scoreboards
- Leaderboards with several distinct boards
- Event/hackathon landing pages where multiple lifecycle signals could matter (registration count, sponsors, winners, schedule)
- Generic landing pages, contest pages, beta/waitlist pages with many surfaces
- ANY page where you can identify 4+ distinct plausible watchable surfaces

TRACK EVERYTHING — if the user wants ALL changes / the whole page / "track everything" / "watch all updates" / "anything that changes" (as their initial ask OR as their answer to a clarifying question), call preview_schema with breadth="broad". That returns comprehensive (but still noise-filtered) coverage. For a focused or specific ask, omit breadth (it defaults to focused). When you later call create_watch for a broad watch, pass breadth="broad" too (or useSchema with the broad schema you previewed).

REFINING AFTER A PREVIEW — additive vs replacement (IMPORTANT):
- A schema is already on screen and the user mentions ANOTHER section ("how about the events?", "also track X", "what about Y?") → this is ADDITIVE. Re-run preview_schema KEEPING the existing coverage AND adding the new section (combine into one intent; keep breadth="broad" if they're tracking everything). Do NOT throw away the broad schema and narrow to only the new section.
- Narrow to a single section ONLY when the user is explicit: "just/only X", "actually only track X", "forget the rest".
- The preview_schema result includes "extracted" — real values pulled from the page. If the user asked for a section that comes back EMPTY or ISN'T in the schema, the page doesn't have it (e.g. Medscape events live on a different site). Say so plainly — "I don't see upcoming events on this page; they're on a separate Medscape site" — do NOT fabricate a field for a section that isn't there.

When asking the clarifying question:
- ONE sentence, lowercase voice. Offer 3 specific intent options derived from the page outline. You may also note they can say "everything" to track all changes.
- Format the options as a comma-separated inline list in the sentence — NEVER markdown bullets, NEVER bold-asterisk chip syntax (* **X** *). Just plain prose.
- Example for medscape: "this homepage has a lot — any specific specialty (cardiology, oncology, etc.), all major medical headlines, or just FDA approvals & drug alerts?"
- Example for scotusblog: "want the decisions-issued counter, the upcoming opinion calendar, or all latest commentary?"
- After the user picks, call preview_schema with their answer as the intent arg.

After preview_schema returns:
- If it returned ok:false with reason "gated", "error", or "empty": the page CANNOT be watched — it's behind a login, returned an error, or came back empty (we fetch as an anonymous visitor, so private pages aren't reachable). Tell the user plainly in ONE sentence and stop. Do NOT retry, do NOT call create_watch, do NOT invent a schema. Suggest watching a public page instead.
- The schema-preview CARD already shows thesis, fields, and "Track all N / Track everything / Refine fields" buttons. Your text is a brief transition, NOT a restatement.
- One short sentence is plenty. Examples: "Confirm to start watching." / "Look right?" / "I can refine — what should it focus on?" Never markdown bullets, never bold chip-syntax.
- If pageType is "other" or similar and confidence < 0.7, the inference is weak — say so in one sentence and ask the user to describe what they care about.

Only call create_watch after the user has explicitly confirmed. Pass useSchema with the schema you just inferred. If create_watch returns reason "already_watching", tell the user in one sentence that this page is already being watched (offer to open or pause it) — do NOT retry.

Rules:
- Don't narrate your own tool calls in long form. A short one-liner before is plenty ("Checking your watches…"). The UI renders tool results as cards.
- For destructive ops (delete_watch), require a clear instruction; otherwise prefer pause.
- Stay short. 1-3 sentences typical. The clarifying question above is ONE sentence — not a paragraph and not a list of options.
`;

function buildTools(): ChatCompletionTool[] {
  return Object.values(TOOLS).map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: z.toJSONSchema(t.input as z.ZodType) as Record<string, unknown>,
    },
  }));
}

function buildMessages(
  history: ChatMessage[],
  systemInstruction: string,
): ChatCompletionMessageParam[] {
  const out: ChatCompletionMessageParam[] = [{ role: "system", content: systemInstruction }];
  for (const m of history) {
    if (m.role === "user") {
      if (m.text) out.push({ role: "user", content: m.text });
    } else if (m.role === "model") {
      if (m.toolCalls && m.toolCalls.length > 0) {
        out.push({
          role: "assistant",
          content: m.text ?? null,
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: { name: tc.name, arguments: JSON.stringify(tc.args) },
          })),
        });
      } else if (m.text) {
        out.push({ role: "assistant", content: m.text });
      }
    } else if (m.role === "tool") {
      for (const r of m.results) {
        out.push({
          role: "tool",
          tool_call_id: r.id,
          content: JSON.stringify({ ok: r.ok, result: r.result }),
        });
      }
    }
  }
  return out;
}

function buildSystemInstruction(pageContext?: AgentInput["pageContext"]): string {
  if (!pageContext?.url) return SYSTEM_INSTRUCTION;
  const lines = [SYSTEM_INSTRUCTION, "", "Active tab:", `- url: ${pageContext.url}`];
  if (pageContext.title) lines.push(`- title: ${pageContext.title}`);
  if (pageContext.markdown) {
    const slice = pageContext.markdown.slice(0, 4000);
    lines.push("", "Active tab content (first 4KB):", "```", slice, "```");
  } else {
    lines.push("(no page content attached — call fetch_page if you need to read it)");
  }
  return lines.join("\n");
}

/* ------------------------------------------------------------------ */

export async function* runAgent(input: AgentInput): AsyncGenerator<AgentEvent> {
  const ctx: ToolCtx = { userId: input.userId, pageContext: input.pageContext };
  const systemInstruction = buildSystemInstruction(input.pageContext);
  const tools = buildTools();
  const history: ChatMessage[] = [...input.messages];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    let stream;
    try {
      stream = await llm.chat.completions.create({
        model: CHAT_MODEL,
        temperature: 0.6,
        max_completion_tokens: 4096,
        stream: true,
        tools,
        tool_choice: "auto",
        messages: buildMessages(history, systemInstruction),
      });
    } catch (e: unknown) {
      yield { type: "error", detail: String((e as Error)?.message ?? e) };
      return;
    }

    let assistantText = "";
    const toolCallAcc = new Map<number, { id: string; name: string; args: string }>();

    try {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          assistantText += delta.content;
          yield { type: "text", delta: delta.content };
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index;
            const entry = toolCallAcc.get(idx) ?? { id: "", name: "", args: "" };
            if (tc.id) entry.id = tc.id;
            if (tc.function?.name) entry.name = tc.function.name;
            if (tc.function?.arguments) entry.args += tc.function.arguments;
            toolCallAcc.set(idx, entry);
          }
        }
      }
    } catch (e: unknown) {
      yield { type: "error", detail: String((e as Error)?.message ?? e) };
      return;
    }

    const collected = Array.from(toolCallAcc.values()).filter((c) => c.id && c.name);

    if (collected.length === 0) {
      if (assistantText) history.push({ role: "model", text: assistantText });
      yield { type: "done" };
      return;
    }

    const parsedCalls = collected.map((c) => {
      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs = c.args ? (JSON.parse(c.args) as Record<string, unknown>) : {};
      } catch {
        parsedArgs = {};
      }
      return { id: c.id, name: c.name, args: parsedArgs };
    });

    history.push({
      role: "model",
      text: assistantText || undefined,
      toolCalls: parsedCalls,
    });

    const results: Array<{ id: string; name: string; ok: boolean; result: unknown }> = [];
    for (const fc of parsedCalls) {
      yield { type: "tool_call", id: fc.id, name: fc.name, args: fc.args };
      const r = await executeTool(fc.name, fc.args, ctx);
      yield {
        type: "tool_result",
        id: fc.id,
        name: fc.name,
        display: r.display,
        ok: r.ok,
        result: r.result,
      };
      results.push({ id: fc.id, name: fc.name, ok: r.ok, result: r.result });
    }

    history.push({ role: "tool", results });
  }

  // Hit the turn ceiling mid-task. Don't surface a raw "max turns" error — give
  // the user a graceful, actionable message and end the stream cleanly.
  yield {
    type: "text",
    delta:
      "\n\nThis is taking more steps than I can do in one go. Could you narrow it down — one page or one thing to track at a time — and I'll pick it up from there?",
  };
  yield { type: "done" };
}

export function encodeNdjson(ev: AgentEvent): string {
  return JSON.stringify(ev) + "\n";
}
