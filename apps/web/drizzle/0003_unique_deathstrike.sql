CREATE TABLE IF NOT EXISTS "waitlist_signup" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"source" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "waitlist_signup_email_unique" UNIQUE("email")
);
