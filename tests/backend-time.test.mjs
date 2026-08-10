import test from "node:test";
import assert from "node:assert/strict";
import {
  getNextLogicalDayStart,
  getLogicalDay,
  resolveLogicalDateMeasurement,
  secondsUntilNextLogicalDay,
} from "../server/time.js";

test("the Asia/Kolkata logical day changes exactly at 04:00", () => {
  assert.equal(getLogicalDay("2026-08-08T22:29:59.999Z"), "2026-08-08");
  assert.equal(getLogicalDay("2026-08-08T22:30:00.000Z"), "2026-08-09");
});

test("the 04:00 boundary works across a month change", () => {
  assert.equal(getLogicalDay("2026-08-31T22:29:59.999Z"), "2026-08-31");
  assert.equal(getLogicalDay("2026-08-31T22:30:00.000Z"), "2026-09-01");
});

test("daily authentication expires at the next 04:00 Chennai boundary", () => {
  const lateEvening = new Date("2026-08-10T23:30:00+05:30");
  assert.equal(getNextLogicalDayStart(lateEvening).toISOString(), "2026-08-10T22:30:00.000Z");
  assert.equal(secondsUntilNextLogicalDay(lateEvening), 4.5 * 60 * 60);

  const beforeBoundary = new Date("2026-08-11T03:59:59+05:30");
  assert.equal(secondsUntilNextLogicalDay(beforeBoundary), 1);

  const atBoundary = new Date("2026-08-11T04:00:00+05:30");
  assert.equal(secondsUntilNextLogicalDay(atBoundary), 24 * 60 * 60);
});

test("invalid instants are rejected", () => {
  assert.throws(() => getLogicalDay("not-a-date"), /valid date/i);
});

test("today's logical-date weight uses the current instant instead of future noon", () => {
  const morning = new Date("2026-08-10T03:45:00.000Z");
  assert.equal(resolveLogicalDateMeasurement("2026-08-10", morning).toISOString(), morning.toISOString());

  const beforeCutoff = new Date("2026-08-09T20:00:00.000Z");
  assert.equal(resolveLogicalDateMeasurement("2026-08-09", beforeCutoff).toISOString(), beforeCutoff.toISOString());
});

test("a backdated weight uses noon in Chennai and rejects impossible dates", () => {
  const now = new Date("2026-08-10T03:45:00.000Z");
  assert.equal(
    resolveLogicalDateMeasurement("2026-08-08", now).toISOString(),
    "2026-08-08T06:30:00.000Z",
  );
  assert.throws(() => resolveLogicalDateMeasurement("2026-02-30", now), /real calendar date/i);
});
