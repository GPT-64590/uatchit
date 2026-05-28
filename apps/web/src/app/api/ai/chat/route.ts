import { auth } from "@/auth";
import { z } from "zod";
import { runAgent, encodeNdjson } from "@/lib/chat-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MessageSchema = z.union([
  z.object({ role: z.literal("user"), text: z.string().min(1) }),
  z.object({
    role: z.literal("model"),
    text: z.string().optional(),
    toolCalls: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          args: z.record(z.string(), z.unknown()),
        }),
      )
      .optional(),
  }),
  z.object({
    role: z.literal("tool"),
    results: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        ok: z.boolean(),
        result: z.unknown(),
      }),
    ),
  }),
]);

const Body = z.object({
  messages: z.array(MessageSchema).min(1),
  pageContext: z
    .object({
      url: z.string().url().optional(),
      title: z.string().optional(),
      markdown: z.string().optional(),
    })
    .optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("unauthorized", { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return new Response("bad request", { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const ev of runAgent({
          userId: session.user!.id!,
          messages: parsed.data.messages,
          pageContext: parsed.data.pageContext,
        })) {
          controller.enqueue(encoder.encode(encodeNdjson(ev)));
        }
      } catch (e: unknown) {
        controller.enqueue(
          encoder.encode(
            encodeNdjson({ type: "error", detail: String((e as Error)?.message ?? e) }),
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
