import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertJournalIsEmpty,
  databaseTarget,
  normalizeJournalCounts,
  resetIsConfirmed,
} from "../server/domain/journal-reset.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("journal reset requires the configured database name in its only confirmation flag", () => {
  assert.equal(resetIsConfirmed([], "form_shift"), false);
  assert.equal(
    resetIsConfirmed(["--confirm-reset-owner-journal=form_shift"], "form_shift"),
    true,
  );
  assert.throws(
    () => resetIsConfirmed(["--confirm-reset-owner-journal=other"], "form_shift"),
    /Reset refused/,
  );
  assert.throws(
    () => resetIsConfirmed(["--confirm-reset-owner-journal=form_shift", "--extra"], "form_shift"),
    /Reset refused/,
  );
});

test("database target reporting strips credentials and query parameters", () => {
  assert.deepEqual(
    databaseTarget("postgresql://private:secret@example.neon.tech/form_shift?sslmode=require"),
    { database: "form_shift", host: "example.neon.tech" },
  );
});

test("journal reset verification accepts only exact non-negative counts and an empty result", () => {
  assert.deepEqual(normalizeJournalCounts({ sessions: "1", exercises: 2, sets: 3, weights: 4 }), {
    sessions: 1,
    exercises: 2,
    sets: 3,
    weights: 4,
  });
  assert.deepEqual(assertJournalIsEmpty({ sessions: 0, exercises: 0, sets: 0, weights: 0 }), {
    sessions: 0,
    exercises: 0,
    sets: 0,
    weights: 0,
  });
  assert.throws(
    () => assertJournalIsEmpty({ sessions: 0, exercises: 1, sets: 0, weights: 0 }),
    /verification failed/,
  );
  assert.throws(
    () => normalizeJournalCounts({ sessions: -1, exercises: 0, sets: 0, weights: 0 }),
    /Invalid sessions count/,
  );
});

test("migrations cascade sessions through exercises and sets", async () => {
  const migrationFiles = (await readdir(path.join(projectRoot, "drizzle")))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const migrationSql = (await Promise.all(migrationFiles.map((file) => (
    readFile(path.join(projectRoot, "drizzle", file), "utf8")
  )))).join("\n");

  assert.match(
    migrationSql,
    /workout_exercises_session_id_workout_sessions_id_fk[\s\S]*ON DELETE cascade/,
  );
  assert.match(
    migrationSql,
    /workout_sets_exercise_fk[\s\S]*ON DELETE cascade/,
  );
});
