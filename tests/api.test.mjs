import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, appApi } from "../src/api.js";

test("an abort while reading a response stays an abort", async () => {
  const previousFetch = globalThis.fetch;
  const abortError = new Error("aborted");
  abortError.name = "AbortError";
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => { throw abortError; },
  });

  try {
    await assert.rejects(appApi.bootstrap(), (error) => error === abortError);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("a malformed response still becomes a readable API error", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => { throw new SyntaxError("bad json"); },
  });

  try {
    await assert.rejects(appApi.bootstrap(), (error) => (
      error instanceof ApiError && error.code === "invalid_server_response"
    ));
  } finally {
    globalThis.fetch = previousFetch;
  }
});

