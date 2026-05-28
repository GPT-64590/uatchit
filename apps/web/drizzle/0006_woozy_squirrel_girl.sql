CREATE TABLE IF NOT EXISTS "markdown_cache" (
	"url" text PRIMARY KEY NOT NULL,
	"body" text NOT NULL,
	"fetchedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "markdown_cache_expires_idx" ON "markdown_cache" USING btree ("expiresAt");