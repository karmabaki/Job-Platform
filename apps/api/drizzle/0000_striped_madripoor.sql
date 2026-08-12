CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"status" text DEFAULT 'applied' NOT NULL,
	"cover_note" text,
	"hired_at" timestamp with time zone,
	"agreed_rate_amount" integer,
	"agreed_rate_currency" char(3),
	"engagement_type" text,
	"engagement_months" smallint,
	"placement_fee_amount" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "applications_job_candidate_unique" UNIQUE("job_id","candidate_id"),
	CONSTRAINT "applications_status_check" CHECK ("applications"."status" IN ('applied','shortlisted','rejected','hired')),
	CONSTRAINT "applications_engagement_type_check" CHECK ("applications"."engagement_type" IS NULL OR "applications"."engagement_type" IN ('permanent','fixed_term')),
	CONSTRAINT "applications_engagement_months_check" CHECK ("applications"."engagement_months" IS NULL OR "applications"."engagement_months" >= 6),
	CONSTRAINT "applications_agreed_rate_currency_required" CHECK ("applications"."agreed_rate_amount" IS NULL OR "applications"."agreed_rate_currency" IS NOT NULL),
	CONSTRAINT "applications_hired_requires_hired_at" CHECK ("applications"."status" <> 'hired' OR "applications"."hired_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "candidate_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"headline" text,
	"bio" text,
	"github_url" text,
	"portfolio_url" text,
	"country_code" char(2) NOT NULL,
	"timezone" text NOT NULL,
	"availability" text NOT NULL,
	"salary_expectation_min" integer,
	"salary_expectation_max" integer,
	"salary_currency" char(3),
	"salary_period" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidate_profiles_availability_check" CHECK ("candidate_profiles"."availability" IN ('full_time','part_time','contract')),
	CONSTRAINT "candidate_profiles_salary_period_check" CHECK ("candidate_profiles"."salary_period" IS NULL OR "candidate_profiles"."salary_period" IN ('yearly','monthly','hourly')),
	CONSTRAINT "candidate_profiles_salary_min_nonnegative" CHECK ("candidate_profiles"."salary_expectation_min" IS NULL OR "candidate_profiles"."salary_expectation_min" >= 0),
	CONSTRAINT "candidate_profiles_salary_max_gte_min" CHECK ("candidate_profiles"."salary_expectation_min" IS NULL OR "candidate_profiles"."salary_expectation_max" IS NULL OR "candidate_profiles"."salary_expectation_max" >= "candidate_profiles"."salary_expectation_min"),
	CONSTRAINT "candidate_profiles_salary_currency_period_required" CHECK (("candidate_profiles"."salary_expectation_min" IS NULL AND "candidate_profiles"."salary_expectation_max" IS NULL) OR ("candidate_profiles"."salary_currency" IS NOT NULL AND "candidate_profiles"."salary_period" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "candidate_skills" (
	"candidate_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"years_experience" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidate_skills_candidate_id_skill_id_pk" PRIMARY KEY("candidate_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"website" text,
	"country_code" char(2) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "countries" (
	"code" char(2) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "countries_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "job_skills" (
	"job_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_skills_job_id_skill_id_pk" PRIMARY KEY("job_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"created_by" uuid,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"salary_min" integer,
	"salary_max" integer,
	"salary_currency" char(3),
	"salary_period" text,
	"timezone_anchor" text,
	"timezone_overlap_hours" smallint,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_status_check" CHECK ("jobs"."status" IN ('draft','published','closed')),
	CONSTRAINT "jobs_salary_period_check" CHECK ("jobs"."salary_period" IS NULL OR "jobs"."salary_period" IN ('yearly','monthly','hourly')),
	CONSTRAINT "jobs_salary_min_nonnegative" CHECK ("jobs"."salary_min" IS NULL OR "jobs"."salary_min" >= 0),
	CONSTRAINT "jobs_salary_max_gte_min" CHECK ("jobs"."salary_min" IS NULL OR "jobs"."salary_max" IS NULL OR "jobs"."salary_max" >= "jobs"."salary_min"),
	CONSTRAINT "jobs_salary_currency_period_required" CHECK (("jobs"."salary_min" IS NULL AND "jobs"."salary_max" IS NULL) OR ("jobs"."salary_currency" IS NOT NULL AND "jobs"."salary_period" IS NOT NULL)),
	CONSTRAINT "jobs_published_requires_published_at" CHECK ("jobs"."status" <> 'published' OR "jobs"."published_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_application_id_unique" UNIQUE("application_id")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"skill_id" uuid NOT NULL,
	"alias" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skills_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text NOT NULL,
	"company_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_role_check" CHECK ("users"."role" IN ('candidate','employer','admin')),
	CONSTRAINT "users_role_company_check" CHECK ("users"."role" = 'employer' OR "users"."company_id" IS NULL)
);
--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_candidate_id_candidate_profiles_user_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidate_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_profiles" ADD CONSTRAINT "candidate_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_profiles" ADD CONSTRAINT "candidate_profiles_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_skills" ADD CONSTRAINT "candidate_skills_candidate_id_candidate_profiles_user_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidate_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_skills" ADD CONSTRAINT "candidate_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_skills" ADD CONSTRAINT "job_skills_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_skills" ADD CONSTRAINT "job_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_aliases" ADD CONSTRAINT "skill_aliases_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "applications_candidate_id_idx" ON "applications" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "applications_job_id_status_idx" ON "applications" USING btree ("job_id","status");--> statement-breakpoint
CREATE INDEX "candidate_profiles_country_code_idx" ON "candidate_profiles" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX "candidate_profiles_availability_idx" ON "candidate_profiles" USING btree ("availability");--> statement-breakpoint
CREATE INDEX "candidate_skills_skill_id_idx" ON "candidate_skills" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "companies_country_code_idx" ON "companies" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX "job_skills_skill_id_idx" ON "job_skills" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "jobs_company_id_idx" ON "jobs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "jobs_status_published_at_idx" ON "jobs" USING btree ("status","published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "jobs_created_by_idx" ON "jobs" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages" USING btree ("conversation_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "skill_aliases_alias_lower_unique" ON "skill_aliases" USING btree (lower("alias"));--> statement-breakpoint
CREATE INDEX "skill_aliases_skill_id_idx" ON "skill_aliases" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "skills_name_idx" ON "skills" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_unique" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "users_company_id_idx" ON "users" USING btree ("company_id");