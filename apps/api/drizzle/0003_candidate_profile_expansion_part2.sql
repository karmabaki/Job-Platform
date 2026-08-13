ALTER TABLE "candidate_profiles" ADD COLUMN "total_years_experience" smallint;--> statement-breakpoint
ALTER TABLE "candidate_profiles" ADD COLUMN "profile_completeness" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "candidate_profiles" ADD COLUMN "is_searchable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "candidate_profiles" ADD CONSTRAINT "candidate_profiles_total_years_experience_check" CHECK ("candidate_profiles"."total_years_experience" IS NULL OR ("candidate_profiles"."total_years_experience" >= 0 AND "candidate_profiles"."total_years_experience" <= 60));--> statement-breakpoint
ALTER TABLE "candidate_profiles" ADD CONSTRAINT "candidate_profiles_completeness_check" CHECK ("candidate_profiles"."profile_completeness" BETWEEN 0 AND 100);