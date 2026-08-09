import test from "node:test";
import assert from "node:assert/strict";
import { buildWorkoutHistory } from "../server/domain/workout-history.js";

test("workout history reports times and completed, skipped, and set counts", () => {
  const startedAt = new Date("2026-08-09T18:30:00.000Z");
  const endedAt = new Date("2026-08-09T19:20:20.000Z");
  const history = buildWorkoutHistory([{
    id: "session-1",
    templateId: "A",
    logicalDay: "2026-08-09",
    status: "completed",
    startedAt,
    completedAt: endedAt,
    endedAt,
    endReason: null,
  }], [
    {
      sessionId: "session-1",
      exerciseId: "a-one",
      position: 0,
      expectedSets: 2,
      status: "completed",
      selectedVariant: "machine",
      variantSelectedAt: startedAt,
      completedAt: endedAt,
      skippedAt: null,
    },
    {
      sessionId: "session-1",
      exerciseId: "a-two",
      position: 1,
      expectedSets: 2,
      status: "skipped",
      selectedVariant: null,
      variantSelectedAt: null,
      completedAt: null,
      skippedAt: endedAt,
    },
  ], [
    { sessionId: "session-1", exerciseId: "a-one", completedAt: startedAt },
    { sessionId: "session-1", exerciseId: "a-one", completedAt: endedAt },
    { sessionId: "session-1", exerciseId: "a-two", completedAt: startedAt },
    { sessionId: "session-1", exerciseId: "a-two", completedAt: null },
  ]);

  assert.equal(history.length, 1);
  assert.equal(history[0].sessionId, "A");
  assert.equal(history[0].logicalDate, "2026-08-09");
  assert.equal(history[0].durationSeconds, 3_020);
  assert.equal(history[0].durationMinutes, 50);
  assert.equal(history[0].totalExercises, 2);
  assert.equal(history[0].completedExercises, 1);
  assert.equal(history[0].skippedExercises, 1);
  assert.equal(history[0].handledExercises, 2);
  assert.equal(history[0].completionPercent, 100);
  assert.deepEqual(
    history[0].exercises.map(({ status, totalSets, completedSets }) => ({
      status,
      totalSets,
      completedSets,
    })),
    [
      { status: "completed", totalSets: 2, completedSets: 2 },
      { status: "skipped", totalSets: 2, completedSets: 1 },
    ],
  );
  assert.equal(history[0].exercises[1].completedAt, null);
  assert.equal(history[0].exercises[1].skippedAt, endedAt);
});
