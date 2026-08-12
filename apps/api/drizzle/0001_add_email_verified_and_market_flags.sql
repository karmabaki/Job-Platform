ALTER TABLE "countries" ADD COLUMN "candidate_allowed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "countries" ADD COLUMN "employer_allowed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp with time zone;