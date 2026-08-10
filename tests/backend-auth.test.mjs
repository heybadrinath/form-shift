import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  AUTH_COOKIE_NAME,
  AUTH_TOKEN_VERSION,
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

test("tokens from the former long-lived gate are rejected", () => {
  const encodedPayload = Buffer.from(JSON.stringify({
    version: AUTH_TOKEN_VERSION - 1,
    issuedAt: 1_700_000_000,
    expiresAt: 1_700_000_060,
    nonce: "legacy-token",
  })).toString("base64url");
  const signature = createHmac("sha256", secret).update(encodedPayload).digest("base64url");

  assert.equal(verifyAuthToken(`${encodedPayload}.${signature}`, secret, {
    nowMs: 1_700_000_030_000,
  }), null);
});

test("signed owner tokens cannot outlive one logical day", () => {
  const token = createAuthToken(secret, {
    nowMs: 1_700_000_000_000,
    ttlSeconds: 24 * 60 * 60 + 1,
    nonce: "too-long",
  });
  assert.equal(verifyAuthToken(token, secret, { nowMs: 1_700_000_001_000 }), null);
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
