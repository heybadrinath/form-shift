import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTH_COOKIE_NAME,
  buildAuthCookie,
  createAuthToken,
  parseCookies,
  verifyAuthToken,
  verifyOwnerPin,
} from "../server/auth.js";

const secret = "test-secret-that-is-deliberately-32-characters-plus";

test("a signed owner token verifies until its expiry", () => {
  const token = createAuthToken(secret, {
    nowMs: 1_700_000_000_000,
    ttlSeconds: 60,
    nonce: "fixed-test-nonce",
  });

  assert.equal(
    verifyAuthToken(token, secret, { nowMs: 1_700_000_030_000 })?.nonce,
    "fixed-test-nonce",
  );
  assert.equal(verifyAuthToken(token, secret, { nowMs: 1_700_000_060_000 }), null);
});

test("tampering with a signed owner token is rejected", () => {
  const token = createAuthToken(secret, {
    nowMs: 1_700_000_000_000,
    nonce: "fixed-test-nonce",
  });
  const [payload, signature] = token.split(".");

  assert.equal(verifyAuthToken(`${payload}x.${signature}`, secret, {
    nowMs: 1_700_000_001_000,
  }), null);
  assert.equal(verifyAuthToken(`${payload}.${signature.slice(0, -1)}x`, secret, {
    nowMs: 1_700_000_001_000,
  }), null);
});

test("PIN comparison is exact and cookie flags are hardened", () => {
  assert.equal(verifyOwnerPin("4826", "4826", secret), true);
  assert.equal(verifyOwnerPin("4827", "4826", secret), false);

  const cookie = buildAuthCookie("signed-token", {
    secure: true,
    maxAgeSeconds: 60,
  });
  assert.match(cookie, new RegExp(`^${AUTH_COOKIE_NAME}=`));
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /Path=\//);
  assert.equal(parseCookies(`${AUTH_COOKIE_NAME}=signed-token; theme=dark`)[AUTH_COOKIE_NAME], "signed-token");
});
