import test from "node:test";
import assert from "node:assert/strict";
import {
  assertSessionCanFinish,
  assertStartIsAvailable,
  deriveExerciseCompletion,
  deriveExerciseSkipState,
} from "../server/domain/session-invariants.js";

test("a second globally active session is rejected", () => {
  assert.throws(
    () => assertStartIsAvailable({
      activeSession: { id: "active-session" },
      logicalDaySession: null,
    }),
    (error) => error.code === "active_session_exists" && error.status === 409,
  );
});

test("a second session in the same logical day is rejected even after completion", () => {
  assert.throws(
    () => assertStartIsAvailable({
      activeSession: null,
      logicalDaySession: { id: "completed-session", status: "completed" },
    }),
    (error) => error.code === "logical_day_already_used" && error.status === 409,
  );
});

test("a start is allowed only when both database slots are free", () => {
  assert.doesNotThrow(() => assertStartIsAvailable({
    activeSession: null,
    logicalDaySession: null,
  }));
});

test("finishing requires every exercise to be completed or explicitly skipped", () => {
  assert.doesNotThrow(() => assertSessionCanFinish({
    status: "active",
    exercises: [
      { exerciseId: "one", status: "completed" },
      { exerciseId: "two", status: "skipped" },
    ],
  }));

  assert.throws(
    () => assertSessionCanFinish({
      status: "active",
      exercises: [
        { exerciseId: "one", status: "completed" },
        { exerciseId: "two", status: "pending" },
      ],
    }),
    (error) => error.code === "session_incomplete"
      && error.details.incompleteExerciseIds[0] === "two",
  );
});

test("skip state never retains a completion timestamp and unskip derives set state", () => {
  const completedAt = new Date("2026-08-09T12:00:00.000Z");
  const skippedAt = new Date("2026-08-09T12:05:00.000Z");
  assert.deepEqual(
    deriveExerciseSkipState({
      completedAt,
      skippedAt: null,
      sets: [{ completedAt }],
    }, true, skippedAt),
    { status: "skipped", completedAt: null, skippedAt },
  );

  assert.deepEqual(
    deriveExerciseSkipState({
      completedAt: null,
      skippedAt,
      sets: [{ completedAt }, { completedAt: null }],
    }, false, skippedAt),
    { status: "pending", completedAt: null, skippedAt: null },
  );
});

test("exercise completion timestamp is created, preserved, and cleared from set state", () => {
  const firstCompletion = new Date("2026-08-09T12:00:00.000Z");
  const later = new Date("2026-08-09T12:05:00.000Z");

  assert.deepEqual(
    deriveExerciseCompletion([
      { completedAt: firstCompletion },
      { completedAt: later },
    ], null, later),
    { status: "completed", completedAt: later },
  );

  assert.deepEqual(
    deriveExerciseCompletion([
      { completedAt: firstCompletion },
      { completedAt: later },
    ], firstCompletion, later),
    { status: "completed", completedAt: firstCompletion },
  );

  assert.deepEqual(
    deriveExerciseCompletion([
      { completedAt: firstCompletion },
      { completedAt: null },
    ], firstCompletion, later),
    { status: "pending", completedAt: null },
  );
});
