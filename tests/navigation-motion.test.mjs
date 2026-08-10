import assert from "node:assert/strict";
import test from "node:test";
import { pageMotionMode } from "../src/navigationMotion.js";

test("primary pages move according to their navigation order", () => {
  assert.equal(pageMotionMode("workouts", "calendar"), "forward");
  assert.equal(pageMotionMode("analytics", "food"), "back");
});

test("focused pages enter and return without pretending to be primary tabs", () => {
  assert.equal(pageMotionMode("workouts", "session"), "focus");
  assert.equal(pageMotionMode("guide", "analytics"), "return");
  assert.equal(pageMotionMode("food", "food"), "stay");
});

