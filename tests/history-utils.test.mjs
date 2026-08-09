import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMonthCells,
  getCompletionPercent,
  getDurationMinutes,
  getLogicalDateKey,
  getLogicalNow,
  getSessionId,
  isSessionComplete,
  normalizeSessionHistory,
  normalizeWeightEntries,
  summarizeTraining,
  toLocalDateKey,
} from "../src/components/historyUtils.js";

test("assigns sessions before 4 a.m. to the previous logical day", () => {
  assert.equal(getLogicalDateKey({ completedAt: "2026-08-08T22:29:59.999Z" }), "2026-08-08");
  assert.equal(getLogicalDateKey({ completedAt: "2026-08-08T22:30:00.000Z" }), "2026-08-09");
  assert.equal(toLocalDateKey(getLogicalNow("2026-08-08T22:29:59.999Z")), "2026-08-08");
  assert.equal(toLocalDateKey(getLogicalNow("2026-08-08T22:30:00.000Z")), "2026-08-09");
});

test("prefers an explicit logical date", () => {
  assert.equal(
    getLogicalDateKey({ logicalDate: "2026-08-06", completedAt: "2026-08-09T12:00:00+05:30" }),
    "2026-08-06",
  );
});

test("prefers the backend logical day and otherwise assigns a crossing session by its start", () => {
  assert.equal(
    getLogicalDateKey({
      logicalDay: "2026-08-07",
      logicalDate: "2026-08-08",
      startedAt: "2026-08-08T22:40:00.000Z",
    }),
    "2026-08-07",
  );
  assert.equal(
    getLogicalDateKey({
      startedAt: "2026-08-08T22:20:00.000Z",
      endedAt: "2026-08-08T22:45:00.000Z",
    }),
    "2026-08-08",
  );
});

test("normalizes backend template IDs and treats status as the completion authority", () => {
  assert.equal(getSessionId({ sessionId: "session-uuid", templateId: " b " }), "B");
  assert.equal(isSessionComplete({ status: "completed", completionPercent: 75 }), true);
  assert.equal(isSessionComplete({ status: "incomplete", completionPercent: 100 }), false);
  assert.equal(getCompletionPercent({ handledExercises: 3, totalExercises: 4 }), 75);

  const [record] = normalizeSessionHistory([{
    id: "session-uuid",
    templateId: "C",
    logicalDay: "2026-08-08",
    status: "incomplete",
    durationSeconds: "3301",
    handledExercises: 3,
    totalExercises: 4,
  }]);
  assert.deepEqual(
    {
      recordKey: record.recordKey,
      sessionId: record.sessionId,
      logicalDateKey: record.logicalDateKey,
      durationMinutes: record.durationMinutes,
      completionPercent: record.completionPercent,
      isComplete: record.isComplete,
    },
    {
      recordKey: "session-uuid",
      sessionId: "C",
      logicalDateKey: "2026-08-08",
      durationMinutes: 55,
      completionPercent: 75,
      isComplete: false,
    },
  );
});

test("derives completion and duration from supported record shapes", () => {
  assert.equal(getCompletionPercent({ completedExercises: 6, totalExercises: 8 }), 75);
  assert.equal(getCompletionPercent({ progress: 0.625 }), 63);
  assert.equal(getDurationMinutes({ durationSeconds: 3_301 }), 55);
  assert.equal(
    getDurationMinutes({ startedAt: "2026-08-09T20:00:00Z", completedAt: "2026-08-09T20:48:00Z" }),
    48,
  );
});

test("builds a stable six-week, Monday-first month grid", () => {
  const cells = buildMonthCells(2026, 7);
  assert.equal(cells.length, 42);
  assert.equal(cells[0].date.getDay(), 1);
  assert.equal(cells[0].dateKey, "2026-07-27");
  assert.equal(cells.at(-1).dateKey, "2026-09-06");
});

test("summarizes weekly frequency, duration, completion, and all-time session mix", () => {
  const now = new Date(2026, 7, 12, 15, 0);
  const records = [
    { id: "one", sessionId: "A", logicalDate: "2026-08-10", durationMinutes: 50, completionPercent: 100 },
    { id: "two", sessionId: "B", logicalDate: "2026-08-11", durationMinutes: 40, completionPercent: 50 },
    { id: "old", sessionId: "A", logicalDate: "2026-08-02", durationMinutes: 55, completionPercent: 100 },
  ];
  const result = summarizeTraining(records, now);

  assert.equal(result.weeklyFrequency, 2);
  assert.equal(result.durationMinutes, 90);
  assert.equal(result.averageCompletion, 75);
  assert.deepEqual(result.sessionMix, { A: 2, B: 1, C: 0, D: 0, E: 0 });
});

test("normalizes and sorts supported weight-entry shapes", () => {
  const result = normalizeWeightEntries([
    { id: "new", date: "2026-08-09", weight: "73.4" },
    { id: "old", date: "2026-08-01", value: 74.1 },
  ]);

  assert.deepEqual(result.map(({ entryKey, dateKey, weightKg }) => ({ entryKey, dateKey, weightKg })), [
    { entryKey: "old", dateKey: "2026-08-01", weightKg: 74.1 },
    { entryKey: "new", dateKey: "2026-08-09", weightKg: 73.4 },
  ]);
});

test("uses backend weight logical days and orders same-day entries by measurement time", () => {
  const result = normalizeWeightEntries([
    {
      id: "later",
      weightKg: "73.2",
      logicalDay: "2026-08-08",
      measuredAt: "2026-08-08T20:30:00.000Z",
    },
    {
      id: "earlier",
      weightKg: "73.6",
      logicalDay: "2026-08-08",
      measuredAt: "2026-08-08T18:30:00.000Z",
    },
  ]);

  assert.deepEqual(result.map(({ entryKey, dateKey }) => ({ entryKey, dateKey })), [
    { entryKey: "earlier", dateKey: "2026-08-08" },
    { entryKey: "later", dateKey: "2026-08-08" },
  ]);
});
