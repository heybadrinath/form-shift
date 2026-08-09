import test from "node:test";
import assert from "node:assert/strict";
import {
  handleSkipExercise,
  handleWeightEntry,
} from "../server/api/handlers.js";

const originalPin = process.env.OWNER_PIN;
const originalSecret = process.env.AUTH_COOKIE_SECRET;

test.after(() => {
  if (originalPin === undefined) delete process.env.OWNER_PIN;
  else process.env.OWNER_PIN = originalPin;
  if (originalSecret === undefined) delete process.env.AUTH_COOKIE_SECRET;
  else process.env.AUTH_COOKIE_SECRET = originalSecret;
});

test("exercise skip and weight-entry mutations reject an unsigned request", async () => {
  process.env.OWNER_PIN = "1234";
  process.env.AUTH_COOKIE_SECRET = "test-secret-that-is-at-least-32-characters";
  const sessionId = "42642ae9-d516-4d02-940f-622c2a19e803";
  const entryId = "542aee91-7342-4d28-a421-876f1e08d58e";

  const skipResponse = await handleSkipExercise(new Request(
    `https://form-shift.example/api/workouts/${sessionId}/exercises`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exerciseId: "a-row", skipped: true }),
    },
  ));
  assert.equal(skipResponse.status, 401);

  const deleteResponse = await handleWeightEntry(new Request(
    `https://form-shift.example/api/weights/${entryId}`,
    { method: "DELETE" },
  ));
  assert.equal(deleteResponse.status, 401);
});
