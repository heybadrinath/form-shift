import assert from "node:assert/strict";
import test from "node:test";
import { startSingleFlight } from "../src/asyncActionGate.js";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

test("starts one async action and joins later attempts to its promise", async () => {
  const lockRef = { current: null };
  const pending = deferred();
  let calls = 0;

  const first = startSingleFlight(lockRef, "start", async () => {
    calls += 1;
    return pending.promise;
  });
  const duplicate = startSingleFlight(lockRef, "finish", async () => {
    calls += 1;
  });

  assert.equal(first.started, true);
  assert.equal(duplicate.started, false);
  assert.equal(duplicate.key, "start");
  assert.equal(duplicate.promise, first.promise);

  await Promise.resolve();
  assert.equal(calls, 1);
  pending.resolve("saved");
  assert.equal(await first.promise, "saved");
  assert.equal(lockRef.current, null);
});

test("releases the gate after a failed action", async () => {
  const lockRef = { current: null };
  const first = startSingleFlight(lockRef, "set:one:1", async () => {
    throw new Error("network failed");
  });

  await assert.rejects(first.promise, /network failed/);
  assert.equal(lockRef.current, null);

  const retry = startSingleFlight(lockRef, "set:one:1", async () => "retried");
  assert.equal(retry.started, true);
  assert.equal(await retry.promise, "retried");
});

test("does not execute a conflicting action while the gate is occupied", async () => {
  const lockRef = { current: null };
  const pending = deferred();
  const calls = [];

  const first = startSingleFlight(lockRef, "lock", async () => {
    calls.push("lock");
    return pending.promise;
  });
  const blocked = startSingleFlight(lockRef, "start", async () => {
    calls.push("start");
  });

  await Promise.resolve();
  assert.deepEqual(calls, ["lock"]);
  pending.resolve();
  await first.promise;
  await blocked.promise;
  assert.deepEqual(calls, ["lock"]);
});
