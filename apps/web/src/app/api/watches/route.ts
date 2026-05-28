import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { watches } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { createWatch } from "@/server/create-watch";

const CreateBody = z.object({
  url: z.string().url(),
  intent: z.string().max(1000).optional(),
  intervalMinutes: z.number().int().min(30).max(10080).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = CreateBody.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "bad_request", issues: body.error.issues }, { status: 400 });
  }

  const result = await createWatch({ userId: session.user.id, ...body.data });
  if (!result.ok) {
    return NextResponse.json({ error: result.reason, detail: result.detail }, { status: 502 });
  }
  return NextResponse.json(result);
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const rows = await db
    .select()
    .from(watches)
    .where(eq(watches.userId, session.user.id))
    .orderBy(desc(watches.createdAt));
  return NextResponse.json({ watches: rows });
}
