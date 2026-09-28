CREATE TYPE "public"."form_status_enum" AS ENUM('DRAFT', 'PUBLISHED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."layout_mode_enum" AS ENUM('STEP', 'PAGED');--> statement-breakpoint
CREATE TYPE "public"."question_kind_enum" AS ENUM('SHORT_TEXT', 'LONG_TEXT', 'NUMBER', 'EMAIL', 'PHONE', 'PASSWORD', 'YES_NO', 'SINGLE_CHOICE', 'MULTI_CHOICE', 'DROPDOWN', 'RATING', 'DATE', 'ADDRESS');--> statement-breakpoint
CREATE TYPE "public"."form_session_status_enum" AS ENUM('IN_PROGRESS', 'COMPLETED', 'ABANDONED');--> statement-breakpoint
CREATE TYPE "public"."form_event_type_enum" AS ENUM('VIEW', 'UNLOCK', 'START', 'QUESTION_VIEW', 'PAGE_VIEW', 'SUBMIT', 'ABANDON');--> statement-breakpoint
CREATE TABLE "forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by" uuid NOT NULL,
	"slug" varchar(64) NOT NULL,
	"title" varchar(120) NOT NULL,
	"description" text,
	"layout_mode" "layout_mode_enum" DEFAULT 'PAGED' NOT NULL,
	"theme_key" varchar(32) DEFAULT 'sage' NOT NULL,
	"status" "form_status_enum" DEFAULT 'DRAFT' NOT NULL,
	"password_hash" text,
	"show_progress" boolean DEFAULT true NOT NULL,
	"allow_back" boolean DEFAULT true NOT NULL,
	"one_response_per_device" boolean DEFAULT true NOT NULL,
	"max_responses" integer,
	"closes_at" timestamp,
	"thank_you_title" varchar(120),
	"thank_you_message" text,
	"thank_you_redirect_url" text,
	"version" integer DEFAULT 1 NOT NULL,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "form_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"title" varchar(120),
	"description" text,
	"position" numeric(8, 2) DEFAULT '1.00' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"page_id" uuid,
	"position" numeric(8, 2) DEFAULT '1.00' NOT NULL,
	"kind" "question_kind_enum" NOT NULL,
	"label" varchar(200) NOT NULL,
	"label_key" varchar(50) NOT NULL,
	"description" text,
	"placeholder" text,
	"is_required" boolean DEFAULT false NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "form_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"form_version" integer DEFAULT 1 NOT NULL,
	"status" "form_session_status_enum" DEFAULT 'IN_PROGRESS' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"current_page_id" uuid,
	"current_question_id" uuid,
	"user_agent" text,
	"ip_hash" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "form_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"form_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"value_text" text,
	"value_number" numeric(20, 6),
	"value_date" date,
	"value_json" jsonb,
	"question_label" varchar(200),
	"question_label_key" varchar(50),
	"question_kind" "question_kind_enum",
	"is_draft" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "form_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"form_id" uuid NOT NULL,
	"session_id" uuid,
	"type" "form_event_type_enum" NOT NULL,
	"question_id" uuid,
	"page_id" uuid,
	"form_version" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "forms" ADD CONSTRAINT "forms_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_pages" ADD CONSTRAINT "form_pages_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_page_id_form_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."form_pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_sessions" ADD CONSTRAINT "form_sessions_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_sessions" ADD CONSTRAINT "form_sessions_current_page_id_form_pages_id_fk" FOREIGN KEY ("current_page_id") REFERENCES "public"."form_pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_sessions" ADD CONSTRAINT "form_sessions_current_question_id_questions_id_fk" FOREIGN KEY ("current_question_id") REFERENCES "public"."questions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_answers" ADD CONSTRAINT "form_answers_session_id_form_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."form_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_answers" ADD CONSTRAINT "form_answers_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_answers" ADD CONSTRAINT "form_answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_events" ADD CONSTRAINT "form_events_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_events" ADD CONSTRAINT "form_events_session_id_form_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."form_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_events" ADD CONSTRAINT "form_events_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_events" ADD CONSTRAINT "form_events_page_id_form_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."form_pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "forms_slug_unique" ON "forms" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "forms_created_by_idx" ON "forms" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "forms_status_idx" ON "forms" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "form_pages_form_id_position_unique" ON "form_pages" USING btree ("form_id","position");--> statement-breakpoint
CREATE INDEX "form_pages_form_id_idx" ON "form_pages" USING btree ("form_id");--> statement-breakpoint
CREATE UNIQUE INDEX "questions_form_page_position_unique" ON "questions" USING btree ("form_id","page_id","position") WHERE "questions"."deleted_at" is null and "questions"."page_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "questions_form_position_unique" ON "questions" USING btree ("form_id","position") WHERE "questions"."deleted_at" is null and "questions"."page_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "questions_form_label_key_unique" ON "questions" USING btree ("form_id","label_key") WHERE "questions"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "questions_form_id_idx" ON "questions" USING btree ("form_id");--> statement-breakpoint
CREATE INDEX "questions_page_id_idx" ON "questions" USING btree ("page_id");--> statement-breakpoint
CREATE UNIQUE INDEX "form_sessions_form_id_device_id_completed_unique" ON "form_sessions" USING btree ("form_id","device_id") WHERE "form_sessions"."status" = 'COMPLETED';--> statement-breakpoint
CREATE INDEX "form_sessions_form_id_completed_at_idx" ON "form_sessions" USING btree ("form_id","completed_at");--> statement-breakpoint
CREATE INDEX "form_sessions_form_id_started_at_idx" ON "form_sessions" USING btree ("form_id","started_at");--> statement-breakpoint
CREATE INDEX "form_sessions_form_id_status_idx" ON "form_sessions" USING btree ("form_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "form_answers_session_id_question_id_unique" ON "form_answers" USING btree ("session_id","question_id");--> statement-breakpoint
CREATE INDEX "form_answers_form_id_idx" ON "form_answers" USING btree ("form_id");--> statement-breakpoint
CREATE INDEX "form_answers_question_id_idx" ON "form_answers" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "form_answers_form_id_is_draft_idx" ON "form_answers" USING btree ("form_id","is_draft");--> statement-breakpoint
CREATE INDEX "form_events_form_id_created_at_idx" ON "form_events" USING btree ("form_id","created_at");--> statement-breakpoint
CREATE INDEX "form_events_form_id_type_created_at_idx" ON "form_events" USING btree ("form_id","type","created_at");--> statement-breakpoint
CREATE INDEX "form_events_session_id_created_at_idx" ON "form_events" USING btree ("session_id","created_at");