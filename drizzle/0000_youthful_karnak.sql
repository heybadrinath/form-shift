CREATE TYPE "public"."workout_exercise_status" AS ENUM('pending', 'completed');--> statement-breakpoint
CREATE TYPE "public"."workout_status" AS ENUM('active', 'completed', 'incomplete');--> statement-breakpoint
CREATE TABLE "weight_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"weight_kg" numeric(5, 2) NOT NULL,
	"measured_at" timestamp with time zone NOT NULL,
	"logical_day" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weight_entries_range_check" CHECK ("weight_entries"."weight_kg" >= 20 AND "weight_entries"."weight_kg" <= 500),
	CONSTRAINT "weight_entries_logical_day_check" CHECK ("weight_entries"."logical_day" = ((("weight_entries"."measured_at" AT TIME ZONE 'Asia/Kolkata') - interval '4 hours')::date))
);
--> statement-breakpoint
CREATE TABLE "workout_exercises" (
	"session_id" uuid NOT NULL,
	"exercise_id" text NOT NULL,
	"position" integer NOT NULL,
	"expected_sets" integer NOT NULL,
	"exercise_snapshot" jsonb NOT NULL,
	"selected_variant" text,
	"variant_selected_at" timestamp with time zone,
	"status" "workout_exercise_status" DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workout_exercises_session_exercise_pk" PRIMARY KEY("session_id","exercise_id"),
	CONSTRAINT "workout_exercises_position_check" CHECK ("workout_exercises"."position" >= 0),
	CONSTRAINT "workout_exercises_expected_sets_check" CHECK ("workout_exercises"."expected_sets" > 0),
	CONSTRAINT "workout_exercises_status_timestamp_check" CHECK ((
      ("workout_exercises"."status" = 'pending' AND "workout_exercises"."completed_at" IS NULL)
      OR ("workout_exercises"."status" = 'completed' AND "workout_exercises"."completed_at" IS NOT NULL)
    ))
);
--> statement-breakpoint
CREATE TABLE "workout_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_key" text DEFAULT 'owner' NOT NULL,
	"template_id" text NOT NULL,
	"template_snapshot" jsonb NOT NULL,
	"logical_day" date NOT NULL,
	"status" "workout_status" DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"end_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workout_sessions_owner_key_check" CHECK ("workout_sessions"."owner_key" = 'owner'),
	CONSTRAINT "workout_sessions_logical_day_check" CHECK ("workout_sessions"."logical_day" = ((("workout_sessions"."started_at" AT TIME ZONE 'Asia/Kolkata') - interval '4 hours')::date)),
	CONSTRAINT "workout_sessions_status_timestamps_check" CHECK ((
      ("workout_sessions"."status" = 'active' AND "workout_sessions"."completed_at" IS NULL AND "workout_sessions"."ended_at" IS NULL)
      OR ("workout_sessions"."status" = 'completed' AND "workout_sessions"."completed_at" IS NOT NULL AND "workout_sessions"."ended_at" IS NOT NULL)
      OR ("workout_sessions"."status" = 'incomplete' AND "workout_sessions"."completed_at" IS NULL AND "workout_sessions"."ended_at" IS NOT NULL)
    ))
);
--> statement-breakpoint
CREATE TABLE "workout_sets" (
	"session_id" uuid NOT NULL,
	"exercise_id" text NOT NULL,
	"set_number" integer NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workout_sets_session_exercise_number_pk" PRIMARY KEY("session_id","exercise_id","set_number"),
	CONSTRAINT "workout_sets_number_check" CHECK ("workout_sets"."set_number" > 0)
);
--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_session_id_workout_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."workout_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_exercise_fk" FOREIGN KEY ("session_id","exercise_id") REFERENCES "public"."workout_exercises"("session_id","exercise_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "weight_entries_measured_at_idx" ON "weight_entries" USING btree ("measured_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workout_exercises_session_position_unique" ON "workout_exercises" USING btree ("session_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "workout_sessions_one_per_logical_day_unique" ON "workout_sessions" USING btree ("owner_key","logical_day");--> statement-breakpoint
CREATE UNIQUE INDEX "workout_sessions_one_active_unique" ON "workout_sessions" USING btree ("owner_key") WHERE "workout_sessions"."status" = 'active';--> statement-breakpoint
CREATE INDEX "workout_sessions_started_at_idx" ON "workout_sessions" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "workout_sets_incomplete_idx" ON "workout_sets" USING btree ("session_id","exercise_id") WHERE "workout_sets"."completed_at" IS NULL;