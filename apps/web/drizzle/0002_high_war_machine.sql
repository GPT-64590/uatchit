CREATE TABLE IF NOT EXISTS "mcp_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"name" text NOT NULL,
	"tokenHash" text NOT NULL,
	"prefix" text NOT NULL,
	"lastUsedAt" timestamp with time zone,
	"revokedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mcp_token_tokenHash_unique" UNIQUE("tokenHash")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mcp_token" ADD CONSTRAINT "mcp_token_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mcp_token_user_idx" ON "mcp_token" USING btree ("userId");