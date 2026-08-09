ALTER TYPE "public"."workout_exercise_status" ADD VALUE 'skipped';--> statement-breakpoint
ALTER TABLE "workout_exercises" DROP CONSTRAINT "workout_exercises_status_timestamp_check";--> statement-breakpoint
ALTER TABLE "weight_entries" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD COLUMN "skipped_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_status_timestamp_check" CHECK ((
      ("workout_exercises"."status" = 'pending' AND "workout_exercises"."completed_at" IS NULL AND "workout_exercises"."skipped_at" IS NULL)
      OR ("workout_exercises"."status" = 'completed' AND "workout_exercises"."completed_at" IS NOT NULL AND "workout_exercises"."skipped_at" IS NULL)
      OR ("workout_exercises"."status" = 'skipped' AND "workout_exercises"."completed_at" IS NULL AND "workout_exercises"."skipped_at" IS NOT NULL)
    ));