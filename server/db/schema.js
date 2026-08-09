import { sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const workoutStatus = pgEnum("workout_status", [
  "active",
  "completed",
  "incomplete",
]);

export const exerciseStatus = pgEnum("workout_exercise_status", [
  "pending",
  "completed",
  "skipped",
]);

export const workoutSessions = pgTable("workout_sessions", {
  id: uuid("id").primaryKey(),
  ownerKey: text("owner_key").notNull().default("owner"),
  templateId: text("template_id").notNull(),
  templateSnapshot: jsonb("template_snapshot").notNull(),
  logicalDay: date("logical_day", { mode: "string" }).notNull(),
  status: workoutStatus("status").notNull().default("active"),
  startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  endedAt: timestamp("ended_at", { withTimezone: true, mode: "date" }),
  endReason: text("end_reason"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  check("workout_sessions_owner_key_check", sql`${table.ownerKey} = 'owner'`),
  check(
    "workout_sessions_logical_day_check",
    sql`${table.logicalDay} = (((${table.startedAt} AT TIME ZONE 'Asia/Kolkata') - interval '4 hours')::date)`,
  ),
  check(
    "workout_sessions_status_timestamps_check",
    sql`(
      (${table.status} = 'active' AND ${table.completedAt} IS NULL AND ${table.endedAt} IS NULL)
      OR (${table.status} = 'completed' AND ${table.completedAt} IS NOT NULL AND ${table.endedAt} IS NOT NULL)
      OR (${table.status} = 'incomplete' AND ${table.completedAt} IS NULL AND ${table.endedAt} IS NOT NULL)
    )`,
  ),
  uniqueIndex("workout_sessions_one_per_logical_day_unique")
    .on(table.ownerKey, table.logicalDay),
  uniqueIndex("workout_sessions_one_active_unique")
    .on(table.ownerKey)
    .where(sql`${table.status} = 'active'`),
  index("workout_sessions_started_at_idx").on(table.startedAt),
]);

export const workoutExercises = pgTable("workout_exercises", {
  sessionId: uuid("session_id")
    .notNull()
    .references(() => workoutSessions.id, { onDelete: "cascade" }),
  exerciseId: text("exercise_id").notNull(),
  position: integer("position").notNull(),
  expectedSets: integer("expected_sets").notNull(),
  exerciseSnapshot: jsonb("exercise_snapshot").notNull(),
  selectedVariant: text("selected_variant"),
  variantSelectedAt: timestamp("variant_selected_at", { withTimezone: true, mode: "date" }),
  status: exerciseStatus("status").notNull().default("pending"),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  skippedAt: timestamp("skipped_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  primaryKey({
    name: "workout_exercises_session_exercise_pk",
    columns: [table.sessionId, table.exerciseId],
  }),
  check("workout_exercises_position_check", sql`${table.position} >= 0`),
  check("workout_exercises_expected_sets_check", sql`${table.expectedSets} > 0`),
  check(
    "workout_exercises_status_timestamp_check",
    sql`(
      (${table.status} = 'pending' AND ${table.completedAt} IS NULL AND ${table.skippedAt} IS NULL)
      OR (${table.status} = 'completed' AND ${table.completedAt} IS NOT NULL AND ${table.skippedAt} IS NULL)
      OR (${table.status} = 'skipped' AND ${table.completedAt} IS NULL AND ${table.skippedAt} IS NOT NULL)
    )`,
  ),
  uniqueIndex("workout_exercises_session_position_unique")
    .on(table.sessionId, table.position),
]);

export const workoutSets = pgTable("workout_sets", {
  sessionId: uuid("session_id").notNull(),
  exerciseId: text("exercise_id").notNull(),
  setNumber: integer("set_number").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  primaryKey({
    name: "workout_sets_session_exercise_number_pk",
    columns: [table.sessionId, table.exerciseId, table.setNumber],
  }),
  foreignKey({
    name: "workout_sets_exercise_fk",
    columns: [table.sessionId, table.exerciseId],
    foreignColumns: [workoutExercises.sessionId, workoutExercises.exerciseId],
  }).onDelete("cascade"),
  check("workout_sets_number_check", sql`${table.setNumber} > 0`),
  index("workout_sets_incomplete_idx")
    .on(table.sessionId, table.exerciseId)
    .where(sql`${table.completedAt} IS NULL`),
]);

export const weightEntries = pgTable("weight_entries", {
  id: uuid("id").primaryKey(),
  weightKg: numeric("weight_kg", { precision: 5, scale: 2 }).notNull(),
  measuredAt: timestamp("measured_at", { withTimezone: true, mode: "date" }).notNull(),
  logicalDay: date("logical_day", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  check("weight_entries_range_check", sql`${table.weightKg} >= 20 AND ${table.weightKg} <= 500`),
  check(
    "weight_entries_logical_day_check",
    sql`${table.logicalDay} = (((${table.measuredAt} AT TIME ZONE 'Asia/Kolkata') - interval '4 hours')::date)`,
  ),
  index("weight_entries_measured_at_idx").on(table.measuredAt),
]);
