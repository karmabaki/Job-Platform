CREATE TABLE "candidate_education" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"institution_name" text NOT NULL,
	"degree" text,
	"field_of_study" text,
	"description" text,
	"start_year" smallint NOT NULL,
	"start_month" smallint,
	"end_year" smallint,
	"end_month" smallint,
	"is_current" boolean DEFAULT false NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidate_education_start_year_check" CHECK ("candidate_education"."start_year" BETWEEN 1950 AND 2100),
	CONSTRAINT "candidate_education_start_month_check" CHECK ("candidate_education"."start_month" IS NULL OR "candidate_education"."start_month" BETWEEN 1 AND 12),
	CONSTRAINT "candidate_education_end_month_check" CHECK ("candidate_education"."end_month" IS NULL OR "candidate_education"."end_month" BETWEEN 1 AND 12),
	CONSTRAINT "candidate_education_current_no_end_check" CHECK ("candidate_education"."is_current" = false OR ("candidate_education"."end_year" IS NULL AND "candidate_education"."end_month" IS NULL)),
	CONSTRAINT "candidate_education_end_after_start_year_check" CHECK ("candidate_education"."end_year" IS NULL OR "candidate_education"."end_year" >= "candidate_education"."start_year"),
	CONSTRAINT "candidate_education_end_after_start_month_check" CHECK ("candidate_education"."end_year" IS NULL OR "candidate_education"."end_year" > "candidate_education"."start_year" OR "candidate_education"."end_month" IS NULL OR "candidate_education"."start_month" IS NULL OR "candidate_education"."end_month" >= "candidate_education"."start_month")
);
--> statement-breakpoint
CREATE TABLE "candidate_languages" (
	"candidate_id" uuid NOT NULL,
	"language_code" char(2) NOT NULL,
	"proficiency" text NOT NULL,
	CONSTRAINT "candidate_languages_candidate_id_language_code_pk" PRIMARY KEY("candidate_id","language_code"),
	CONSTRAINT "candidate_languages_proficiency_check" CHECK ("candidate_languages"."proficiency" IN ('basic','conversational','professional','fluent','native'))
);
--> statement-breakpoint
CREATE TABLE "candidate_portfolio_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"url" text,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_work_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"role_title" text NOT NULL,
	"company_name" text,
	"description" text,
	"start_year" smallint NOT NULL,
	"start_month" smallint,
	"end_year" smallint,
	"end_month" smallint,
	"is_current" boolean DEFAULT false NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidate_work_history_start_year_check" CHECK ("candidate_work_history"."start_year" BETWEEN 1950 AND 2100),
	CONSTRAINT "candidate_work_history_start_month_check" CHECK ("candidate_work_history"."start_month" IS NULL OR "candidate_work_history"."start_month" BETWEEN 1 AND 12),
	CONSTRAINT "candidate_work_history_end_month_check" CHECK ("candidate_work_history"."end_month" IS NULL OR "candidate_work_history"."end_month" BETWEEN 1 AND 12),
	CONSTRAINT "candidate_work_history_current_no_end_check" CHECK ("candidate_work_history"."is_current" = false OR ("candidate_work_history"."end_year" IS NULL AND "candidate_work_history"."end_month" IS NULL)),
	CONSTRAINT "candidate_work_history_end_after_start_year_check" CHECK ("candidate_work_history"."end_year" IS NULL OR "candidate_work_history"."end_year" >= "candidate_work_history"."start_year"),
	CONSTRAINT "candidate_work_history_end_after_start_month_check" CHECK ("candidate_work_history"."end_year" IS NULL OR "candidate_work_history"."end_year" > "candidate_work_history"."start_year" OR "candidate_work_history"."end_month" IS NULL OR "candidate_work_history"."start_month" IS NULL OR "candidate_work_history"."end_month" >= "candidate_work_history"."start_month")
);
--> statement-breakpoint
ALTER TABLE "candidate_education" ADD CONSTRAINT "candidate_education_candidate_id_candidate_profiles_user_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidate_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_languages" ADD CONSTRAINT "candidate_languages_candidate_id_candidate_profiles_user_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidate_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_portfolio_items" ADD CONSTRAINT "candidate_portfolio_items_candidate_id_candidate_profiles_user_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidate_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_work_history" ADD CONSTRAINT "candidate_work_history_candidate_id_candidate_profiles_user_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidate_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "candidate_education_candidate_sort_idx" ON "candidate_education" USING btree ("candidate_id","sort_order");--> statement-breakpoint
CREATE INDEX "candidate_portfolio_items_candidate_sort_idx" ON "candidate_portfolio_items" USING btree ("candidate_id","sort_order");--> statement-breakpoint
CREATE INDEX "candidate_work_history_candidate_sort_idx" ON "candidate_work_history" USING btree ("candidate_id","sort_order");--> statement-breakpoint
ALTER TABLE "candidate_profiles" DROP COLUMN "portfolio_url";