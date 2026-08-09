import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function migrationSql() {
  const files = (await readdir(path.join(projectRoot, "drizzle")))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  return (await Promise.all(files.map((file) => readFile(
    path.join(projectRoot, "drizzle", file),
    "utf8",
  )))).join("\n");
}

test("migration enforces the logical-day and global-active invariants", async () => {
  const sql = await migrationSql();
  assert.match(sql, /AT TIME ZONE 'Asia\/Kolkata'/);
  assert.match(sql, /interval '4 hours'/);
  assert.match(sql, /workout_sessions_one_per_logical_day_unique/);
  assert.match(sql, /workout_sessions_one_active_unique/);
  assert.match(sql, /WHERE .*status.* = 'active'/);
});

test("migration stores snapshots and completion timestamps", async () => {
  const sql = await migrationSql();
  assert.match(sql, /"template_snapshot" jsonb NOT NULL/);
  assert.match(sql, /"exercise_snapshot" jsonb NOT NULL/);
  assert.match(sql, /"variant_selected_at" timestamp with time zone/);
  assert.match(sql, /CREATE TABLE "workout_sets"[\s\S]*"completed_at" timestamp with time zone/);
});

test("migration persists mutually exclusive skipped and completed exercise states", async () => {
  const sql = await migrationSql();
  assert.match(sql, /ADD VALUE 'skipped'/);
  assert.match(sql, /ADD COLUMN "skipped_at" timestamp with time zone/);
  assert.match(sql, /status.* = 'skipped'[\s\S]*completed_at.*IS NULL[\s\S]*skipped_at.*IS NOT NULL/);
  assert.match(sql, /weight_entries[\s\S]*ADD COLUMN "updated_at" timestamp with time zone DEFAULT now\(\) NOT NULL/);
});
