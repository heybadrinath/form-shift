import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { AppError } from "./errors.js";

export const AUTH_COOKIE_NAME = "form_shift_owner";
export const AUTH_TOKEN_VERSION = 2;
export const DEFAULT_AUTH_TTL_SECONDS = 60 * 60 * 24;

function mac(secret, value) {
  return createHmac("sha256", secret).update(value).digest();
}

function safeEqual(left, right) {
  if (!Buffer.isBuffer(left) || !Buffer.isBuffer(right) || left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

function assertSecret(secret) {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new AppError(
      "server_misconfigured",
      "Authentication is not configured.",
      503,
    );
  }
}

export function verifyOwnerPin(candidate, configuredPin, secret) {
  assertSecret(secret);
  if (!/^\d{4}$/.test(candidate ?? "") || !/^\d{4}$/.test(configuredPin ?? "")) return false;

  return safeEqual(
    mac(secret, `candidate:${candidate}`),
    mac(secret, `candidate:${configuredPin}`),
  );
}

export function createAuthToken(secret, options = {}) {
  assertSecret(secret);
  const issuedAt = Math.floor((options.nowMs ?? Date.now()) / 1000);
  const ttlSeconds = options.ttlSeconds ?? DEFAULT_AUTH_TTL_SECONDS;
  const payload = {
    version: AUTH_TOKEN_VERSION,
    issuedAt,
    expiresAt: issuedAt + ttlSeconds,
    nonce: options.nonce ?? randomBytes(18).toString("base64url"),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = mac(secret, encodedPayload).toString("base64url");
  return `${encodedPayload}.${signature}`;
}

export function verifyAuthToken(token, secret, options = {}) {
  try {
    assertSecret(secret);
    if (typeof token !== "string") return null;
    const [encodedPayload, encodedSignature, extra] = token.split(".");
    if (!encodedPayload || !encodedSignature || extra) return null;

    const expectedSignature = mac(secret, encodedPayload);
    const actualSignature = Buffer.from(encodedSignature, "base64url");
    if (!safeEqual(expectedSignature, actualSignature)) return null;

    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    const now = Math.floor((options.nowMs ?? Date.now()) / 1000);
    if (
      payload.version !== AUTH_TOKEN_VERSION
      || !Number.isInteger(payload.issuedAt)
      || !Number.isInteger(payload.expiresAt)
      || typeof payload.nonce !== "string"
      || payload.issuedAt > now + 60
      || payload.expiresAt <= now
      || payload.expiresAt - payload.issuedAt > DEFAULT_AUTH_TTL_SECONDS
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function parseCookies(headerValue = "") {
  return Object.fromEntries(
    headerValue
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf("=");
        if (separator < 0) return [part, ""];
        const value = part.slice(separator + 1);
        try {
          return [part.slice(0, separator), decodeURIComponent(value)];
        } catch {
          return [part.slice(0, separator), value];
        }
      }),
  );
}

export function authTokenFromRequest(request) {
  return parseCookies(request.headers.get("cookie") ?? "")[AUTH_COOKIE_NAME] ?? null;
}

export function buildAuthCookie(token, options = {}) {
  const maxAge = options.maxAgeSeconds ?? DEFAULT_AUTH_TTL_SECONDS;
  const secure = options.secure ?? true;
  return [
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    secure ? "Secure" : null,
    `Max-Age=${maxAge}`,
  ].filter(Boolean).join("; ");
}

export function buildClearAuthCookie(options = {}) {
  const secure = options.secure ?? true;
  return [
    `${AUTH_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    secure ? "Secure" : null,
    "Max-Age=0",
  ].filter(Boolean).join("; ");
}
