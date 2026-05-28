CREATE TABLE IF NOT EXISTS "change" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"watchId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"fromSnapshotId" uuid,
	"toSnapshotId" uuid NOT NULL,
	"narration" text NOT NULL,
	"diff" jsonb NOT NULL,
	"notifiedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"watchId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"contentHash" text NOT NULL,
	"contentMarkdown" text NOT NULL,
	"extracted" jsonb NOT NULL,
	"bdDurationMs" integer,
	"bdZone" text,
	"fetchedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "watch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"favicon" text,
	"pageType" text,
	"schema" jsonb NOT NULL,
	"intervalMinutes" integer DEFAULT 360 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"lastFetchedAt" timestamp with time zone,
	"nextFetchAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "change" ADD CONSTRAINT "change_watchId_watch_id_fk" FOREIGN KEY ("watchId") REFERENCES "public"."watch"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "change" ADD CONSTRAINT "change_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "change" ADD CONSTRAINT "change_fromSnapshotId_snapshot_id_fk" FOREIGN KEY ("fromSnapshotId") REFERENCES "public"."snapshot"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "change" ADD CONSTRAINT "change_toSnapshotId_snapshot_id_fk" FOREIGN KEY ("toSnapshotId") REFERENCES "public"."snapshot"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "snapshot" ADD CONSTRAINT "snapshot_watchId_watch_id_fk" FOREIGN KEY ("watchId") REFERENCES "public"."watch"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "snapshot" ADD CONSTRAINT "snapshot_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "watch" ADD CONSTRAINT "watch_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "change_watch_idx" ON "change" USING btree ("watchId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "change_user_idx" ON "change" USING btree ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "change_created_idx" ON "change" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "snapshot_watch_idx" ON "snapshot" USING btree ("watchId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "snapshot_user_idx" ON "snapshot" USING btree ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "watch_user_idx" ON "watch" USING btree ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "watch_next_fetch_idx" ON "watch" USING btree ("nextFetchAt");