import assert from "node:assert/strict";
import test from "node:test";
import {
  historyEntryFromSession,
  reconcileClosedWorkout,
  upsertJournalEntry,
} from "../src/journalReconciliation.js";

test("journal entries are inserted once and replaced by stable id", () => {
  const existing = [{ id: "older", value: 1 }, { id: "entry", value: 2 }];
  assert.deepEqual(upsertJournalEntry(existing, { id: "entry", value: 3 }), [
    { id: "entry", value: 3 },
    { id: "older", value: 1 },
  ]);
  assert.equal(upsertJournalEntry(existing, null), existing);
});

test("a server-closed workout immediately leaves the active slot and enters summarized history", () => {
  const activeSession = { id: "session-1", templateId: "A", status: "active", logicalDay: "2026-08-10" };
  const closedSession = {
    ...activeSession,
    status: "completed",
    startedAt: "2026-08-10T11:00:00.000Z",
    endedAt: "2026-08-10T12:00:00.000Z",
    exercises: [{
      exerciseId: "a-press",
      status: "completed",
      exerciseSnapshot: { muscleExposure: { category: "resistance", primary: ["chest"], secondary: [] } },
      sets: [{ completedAt: "2026-08-10T11:20:00.000Z" }, { completedAt: "2026-08-10T11:22:00.000Z" }],
    }],
  };
  const state = {
    activeSession,
    logicalDay: "2026-08-10",
    logicalDaySession: activeSession,
    sessionHistory: [{ id: "older-session" }],
    weights: [],
  };

  assert.deepEqual(reconcileClosedWorkout(state, closedSession), {
    ...state,
    activeSession: null,
    logicalDaySession: closedSession,
    sessionHistory: [historyEntryFromSession(closedSession), { id: "older-session" }],
  });
});
