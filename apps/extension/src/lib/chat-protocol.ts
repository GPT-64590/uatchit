/**
 * NDJSON chat protocol — mirror of the server's AgentEvent shape
 * (apps/web/src/lib/chat-agent.ts). Kept hand-synced because the
 * extension does not import server types.
 */

export type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "tool_call"; id: string; name: string; args: Record<string, unknown> }
  | {
      type: "tool_result";
      id: string;
      name: string;
      display:
        | "watches-list"
        | "changes-list"
        | "watch-state"
        | "schema-preview"
        | "watch-created"
        | "watch-updated"
        | "watch-deleted"
        | "page-fetched"
        | "error";
      ok: boolean;
      result: unknown;
    }
  | { type: "error"; detail: string }
  | { type: "done" };

export async function* readNdjsonStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<AgentEvent> {
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl = buffer.indexOf("\n");
    while (nl !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) {
        try {
          yield JSON.parse(line) as AgentEvent;
        } catch {
          yield { type: "error", detail: `bad ndjson line: ${line.slice(0, 120)}` };
        }
      }
      nl = buffer.indexOf("\n");
    }
  }
  if (buffer.trim()) {
    try {
      yield JSON.parse(buffer) as AgentEvent;
    } catch {
      /* swallow trailing scrap */
    }
  }
}

/* ------------------------------------------------------------------ */
/* Typed result helpers — narrow tool_result results by display tag.   */
/* ------------------------------------------------------------------ */

interface InferredField {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  description: string;
  locator: string;
  sampleValue: string | number | boolean | null;
}

export interface InferredSchemaShape {
  pageType: string;
  title: string;
  intent: string;
  /**
   * Two-line user-facing rationale: what we'll alert on + what we're skipping
   * (frozen metadata). Optional only for backward compatibility with cached
   * results pre-rollout; new inferences always include it.
   */
  mutationThesis?: string;
  fields: InferredField[];
  confidence: number;
}

export interface WatchSummary {
  id: string;
  url: string;
  host: string;
  title: string | null;
  status: string;
  intervalMinutes: number;
  lastFetchedAt: string | null;
  createdAt: string;
}

export interface ChangeSummary {
  id: string;
  watchId: string;
  narration: string;
  diff: Record<string, { kind: "changed" | "added" | "removed"; before?: unknown; after?: unknown }>;
  createdAt: string;
  seenAt: string | null;
  watchTitle: string | null;
  watchUrl: string;
  host: string;
}
