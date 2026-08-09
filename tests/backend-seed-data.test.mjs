import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSeedData,
  omitOccupiedWorkoutDays,
  SEEDED_SESSION_IDS,
  SEEDED_WEIGHT_IDS,
} from "../server/seed-data.js";

test("sample data is deterministic, relationally complete, and stays before its anchor day", () => {
  const seed = buildSeedData("2026-08-09");

  assert.equal(seed.sessions.length, 25);
  assert.equal(seed.weights.length, 10);
  assert.equal(new Set(SEEDED_SESSION_IDS).size, 25);
  assert.equal(new Set(SEEDED_WEIGHT_IDS).size, 10);
  assert.ok(seed.sessions.every((session) => session.logicalDay < "2026-08-09"));
  assert.ok(seed.weights.every((entry) => entry.logicalDay < "2026-08-09"));
  assert.ok(seed.sessions.some((session) => session.status === "incomplete"));
  assert.ok(seed.sessions.some((session) => session.templateId === "D"));
  assert.ok(seed.sessions.some((session) => session.templateId === "E"));

  const sessionIds = new Set(seed.sessions.map((session) => session.id));
  assert.ok(seed.exercises.every((exercise) => sessionIds.has(exercise.sessionId)));
  assert.ok(seed.sets.every((set) => sessionIds.has(set.sessionId)));
  assert.ok(seed.exercises.every((exercise) => exercise.selectedVariant));
  assert.ok(seed.sessions.every((session) => {
    const expected = session.templateSnapshot.exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
    return seed.sets.filter((set) => set.sessionId === session.id).length === expected;
  }));
});

test("sample data omits occupied workout days without orphaning child rows", () => {
  const seed = buildSeedData("2026-08-09");
  const occupiedDay = seed.sessions[3].logicalDay;
  const filtered = omitOccupiedWorkoutDays(seed, [occupiedDay]);

  assert.equal(filtered.sessions.length, seed.sessions.length - 1);
  assert.ok(filtered.sessions.every((session) => session.logicalDay !== occupiedDay));
  const retainedIds = new Set(filtered.sessions.map((session) => session.id));
  assert.ok(filtered.exercises.every((exercise) => retainedIds.has(exercise.sessionId)));
  assert.ok(filtered.sets.every((set) => retainedIds.has(set.sessionId)));
  assert.deepEqual(filtered.weights, seed.weights);
});
