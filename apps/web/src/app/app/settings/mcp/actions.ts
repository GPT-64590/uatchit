"use server";
import { db } from "@/db";
import { mcpTokens } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireUserId } from "@/lib/auth-helpers";
import { generateMcpToken } from "@/lib/mcp-auth";
import { revalidatePath } from "next/cache";

export async function createToken(name: string): Promise<{ plaintext: string }> {
  const userId = await requireUserId();
  const { plaintext, hash, prefix } = await generateMcpToken();
  await db.insert(mcpTokens).values({
    userId,
    name: name.trim() || "Unnamed",
    tokenHash: hash,
    prefix,
  });
  revalidatePath("/app/settings/mcp");
  return { plaintext };
}

export async function revokeToken(tokenId: string): Promise<void> {
  const userId = await requireUserId();
  await db.update(mcpTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(mcpTokens.id, tokenId), eq(mcpTokens.userId, userId)));
  revalidatePath("/app/settings/mcp");
}
