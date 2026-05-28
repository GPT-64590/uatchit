import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { waitlistSignups } from "@/db/schema";

const Body = z.object({
  email: z.string().email(),
  source: z.string().max(64).optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  try {
    await db
      .insert(waitlistSignups)
      .values({
        email: parsed.data.email,
        source: parsed.data.source ?? null,
      })
      .onConflictDoNothing();
  } catch {
    // ignore unique-violation; idempotent
  }
  return NextResponse.json({ ok: true });
}
