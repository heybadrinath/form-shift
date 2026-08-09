import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMonthWeekActivity,
  summarizeCalendarMonth,
  summarizeCalendarRecords,
} from "../src/components/calendarMetrics.js";
import { buildMonthCells } from "../src/components/historyUtils.js";

const records = [
  {
    id: "one",
    sessionId: "A",
    logicalDateKey: "2026-08-01",
    durationMinutes: 50,
    completionPercent: 100,
    isComplete: true,
  },
  {
    id: "two",
    sessionId: "B",
    logicalDateKey: "2026-08-02",
    durationMinutes: 35,
    completionPercent: 50,
    isComplete: false,
  },
  {
    id: "three",
    sessionId: "C",
    logicalDateKey: "2026-08-09",
    durationMinutes: 45,
    completionPercent: 100,
    isComplete: true,
  },
  {
    id: "four",
    sessionId: "D",
    logicalDateKey: "2026-08-31",
    durationMinutes: 40,
    completionPercent: 75,
    isComplete: false,
  },
  {
    id: "outside",
    sessionId: "E",
    logicalDateKey: "2026-09-01",
    durationMinutes: 60,
    completionPercent: 100,
    isComplete: true,
  },
];

test("summarizes only records from the requested month", () => {
  const summary = summarizeCalendarMonth(records, "2026-08");

  assert.equal(summary.records.length, 4);
  assert.deepEqual(
    {
      sessions: summary.sessions,
      completed: summary.completed,
      incomplete: summary.incomplete,
      trainingMinutes: summary.trainingMinutes,
      averageHandled: summary.averageHandled,
      finishRate: summary.finishRate,
    },
    {
      sessions: 4,
      completed: 2,
      incomplete: 2,
      trainingMinutes: 170,
      averageHandled: 81,
      finishRate: 50,
    },
  );
});

test("groups a Monday-first month grid into visible calendar weeks", () => {
  const monthCells = buildMonthCells(2026, 7);
  const monthRecords = records.filter((record) => record.logicalDateKey.startsWith("2026-08"));
  const weeks = buildMonthWeekActivity(monthCells, monthRecords);

  assert.equal(weeks.length, 6);
  assert.deepEqual(weeks.map(({ startDay, endDay, sessions }) => ({ startDay, endDay, sessions })), [
    { startDay: 1, endDay: 2, sessions: 2 },
    { startDay: 3, endDay: 9, sessions: 1 },
    { startDay: 10, endDay: 16, sessions: 0 },
    { startDay: 17, endDay: 23, sessions: 0 },
    { startDay: 24, endDay: 30, sessions: 0 },
    { startDay: 31, endDay: 31, sessions: 1 },
  ]);
  assert.deepEqual(weeks[0].sessionIds, ["A", "B"]);
});

test("returns a stable zero summary for missing records", () => {
  assert.deepEqual(summarizeCalendarRecords(null), {
    sessions: 0,
    completed: 0,
    incomplete: 0,
    trainingMinutes: 0,
    averageHandled: 0,
    finishRate: 0,
  });
});
