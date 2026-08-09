import test from "node:test";
import assert from "node:assert/strict";
import { getLogicalDay } from "../server/time.js";

test("the Asia/Kolkata logical day changes exactly at 04:00", () => {
  assert.equal(getLogicalDay("2026-08-08T22:29:59.999Z"), "2026-08-08");
  assert.equal(getLogicalDay("2026-08-08T22:30:00.000Z"), "2026-08-09");
});

test("the 04:00 boundary works across a month change", () => {
  assert.equal(getLogicalDay("2026-08-31T22:29:59.999Z"), "2026-08-31");
  assert.equal(getLogicalDay("2026-08-31T22:30:00.000Z"), "2026-09-01");
});

test("invalid instants are rejected", () => {
  assert.throws(() => getLogicalDay("not-a-date"), /valid date/i);
});
