import test from "node:test";
import assert from "node:assert/strict";
import { nextChennaiWorkoutBoundaryMs } from "../src/dailyAccess.js";

test("daily client access rolls over at 04:00 Chennai time", () => {
  assert.equal(
    new Date(nextChennaiWorkoutBoundaryMs(Date.parse("2026-08-10T23:30:00+05:30"))).toISOString(),
    "2026-08-10T22:30:00.000Z",
  );
  assert.equal(
    new Date(nextChennaiWorkoutBoundaryMs(Date.parse("2026-08-11T03:59:59+05:30"))).toISOString(),
    "2026-08-10T22:30:00.000Z",
  );
  assert.equal(
    new Date(nextChennaiWorkoutBoundaryMs(Date.parse("2026-08-11T04:00:00+05:30"))).toISOString(),
    "2026-08-11T22:30:00.000Z",
  );
});

test("daily client access rejects invalid clocks", () => {
  assert.throws(() => nextChennaiWorkoutBoundaryMs(Number.NaN), /finite timestamp/i);
});
