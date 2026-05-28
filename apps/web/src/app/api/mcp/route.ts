import { NextResponse } from "next/server";
import { createMcpHandler } from "mcp-handler";
import { AsyncLocalStorage } from "node:async_hooks";
import {
  listWatches,
  getWatch,
  getLatestSnapshot,
  getChanges,
  getSchema,
  inputSchemas,
} from "@/lib/mcp-tools";
import { authenticateMcpRequest } from "@/lib/mcp-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reqContext = new AsyncLocalStorage<{ userId: string }>();

function buildHandler() {
  return createMcpHandler(
    (server) => {
      server.registerTool(
        "list_watches",
        {
          description: "List all watches owned by the authenticated user. Returns id, url, title, page type, status, interval.",
          inputSchema: inputSchemas.listWatches.shape,
        },
        async () => {
          const ctx = reqContext.getStore();
          const data = await listWatches(ctx!.userId);
          return {
            content: [{ type: "text", text: `${data.length} watch${data.length === 1 ? "" : "es"}` }],
            structuredContent: { watches: data },
          };
        }
      );

      server.registerTool(
        "get_watch",
        {
          description: "Get the full record of one watch by id.",
          inputSchema: inputSchemas.getWatch.shape,
        },
        async ({ watchId }) => {
          const ctx = reqContext.getStore();
          const w = await getWatch(ctx!.userId, watchId);
          if (!w) {
            return {
              content: [{ type: "text", text: "watch not found" }],
              isError: true,
            };
          }
          return {
            content: [{ type: "text", text: w.title ?? w.url }],
            structuredContent: w,
          };
        }
      );

      server.registerTool(
        "get_latest_snapshot",
        {
          description: "Return the most recent snapshot of a watched page (extracted fields, not raw markdown).",
          inputSchema: inputSchemas.getLatestSnapshot.shape,
        },
        async ({ watchId }) => {
          const ctx = reqContext.getStore();
          const snap = await getLatestSnapshot(ctx!.userId, watchId);
          if (!snap) {
            return { content: [{ type: "text", text: "no snapshots yet" }] };
          }
          return {
            content: [{ type: "text", text: `Latest snapshot from ${snap.fetchedAt}` }],
            structuredContent: snap,
          };
        }
      );

      server.registerTool(
        "get_changes",
        {
          description: "Return diffs between snapshots since the given ISO timestamp (or all changes if omitted).",
          inputSchema: inputSchemas.getChanges.shape,
        },
        async ({ watchId, since, limit }) => {
          const ctx = reqContext.getStore();
          const data = await getChanges(ctx!.userId, watchId, since, limit);
          if (data === null) {
            return { content: [{ type: "text", text: "watch not found" }], isError: true };
          }
          return {
            content: [{ type: "text", text: `${data.length} change(s)` }],
            structuredContent: { changes: data },
          };
        }
      );

      server.registerTool(
        "get_schema",
        {
          description: "Return the inferred schema (fields + types + locator hints) for this watch.",
          inputSchema: inputSchemas.getSchema.shape,
        },
        async ({ watchId }) => {
          const ctx = reqContext.getStore();
          const schema = await getSchema(ctx!.userId, watchId);
          if (!schema) {
            return { content: [{ type: "text", text: "watch not found" }], isError: true };
          }
          return {
            content: [{ type: "text", text: "ok" }],
            structuredContent: schema as Record<string, unknown>,
          };
        }
      );
    },
    {
      serverInfo: { name: "uatchit", version: "0.1.0" },
    },
    {
      basePath: "/api",
    }
  );
}

const handler = buildHandler();

async function withAuth(req: Request) {
  const authResult = await authenticateMcpRequest(req);
  if (!authResult.ok) {
    return new NextResponse(authResult.message, {
      status: authResult.status,
      headers: {
        "WWW-Authenticate":
          'Bearer realm="uatchit", resource_metadata="https://app.uatchit.com/.well-known/oauth-protected-resource"',
      },
    });
  }
  return reqContext.run({ userId: authResult.userId }, () => handler(req));
}

export const GET = withAuth;
export const POST = withAuth;
