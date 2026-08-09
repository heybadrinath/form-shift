import {
  authTokenFromRequest,
  verifyAuthToken,
} from "./auth.js";
import { AppError, asAppError } from "./errors.js";

const JSON_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};

export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      ...JSON_HEADERS,
      ...(init.headers ?? {}),
    },
  });
}

export function apiError(error) {
  const normalized = asAppError(error);
  return json({
    error: {
      code: normalized.code,
      message: normalized.message,
      ...(normalized.details ? { details: normalized.details } : {}),
    },
  }, { status: normalized.status });
}

export function methodNotAllowed(allowed) {
  return json({
    error: {
      code: "method_not_allowed",
      message: `Use ${allowed.join(" or ")} for this endpoint.`,
    },
  }, {
    status: 405,
    headers: { Allow: allowed.join(", ") },
  });
}

export function requireMethod(request, allowed) {
  if (!allowed.includes(request.method)) {
    throw new AppError(
      "method_not_allowed",
      `Use ${allowed.join(" or ")} for this endpoint.`,
      405,
      { allowed },
    );
  }
}

export function assertSameOrigin(request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new AppError("cross_origin_rejected", "Cross-origin mutation rejected.", 403);
  }
}

export async function readJson(request, maxBytes = 8_192) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new AppError("json_required", "Use an application/json request body.", 415);
  }
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new AppError("body_too_large", "Request body is too large.", 413);
  }
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > maxBytes) {
    throw new AppError("body_too_large", "Request body is too large.", 413);
  }
  try {
    return JSON.parse(body || "{}");
  } catch {
    throw new AppError("invalid_json", "Request body must contain valid JSON.", 400);
  }
}

export function getAuthConfig(env = process.env) {
  const pin = env.OWNER_PIN;
  const secret = env.AUTH_COOKIE_SECRET;
  if (typeof pin !== "string" || pin.length < 4 || typeof secret !== "string" || secret.length < 32) {
    throw new AppError(
      "server_misconfigured",
      "Owner authentication is not configured.",
      503,
    );
  }
  return { pin, secret };
}

export function isAuthenticated(request, env = process.env) {
  const { secret } = getAuthConfig(env);
  return Boolean(verifyAuthToken(authTokenFromRequest(request), secret));
}

export function requireAuthentication(request, env = process.env) {
  if (!isAuthenticated(request, env)) {
    throw new AppError("authentication_required", "Unlock the app first.", 401);
  }
}

export function sessionIdFromRequest(request) {
  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  const workoutsIndex = segments.indexOf("workouts");
  const sessionId = workoutsIndex >= 0 ? segments[workoutsIndex + 1] : null;
  if (!sessionId || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) {
    throw new AppError("invalid_session_id", "Session id is invalid.", 400);
  }
  return sessionId;
}

export function weightEntryIdFromRequest(request) {
  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  const weightsIndex = segments.indexOf("weights");
  const entryId = weightsIndex >= 0 ? segments[weightsIndex + 1] : null;
  if (!entryId || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(entryId)) {
    throw new AppError("invalid_weight_entry_id", "Weight entry id is invalid.", 400);
  }
  return entryId;
}

export function secureCookieForRequest(request) {
  return new URL(request.url).protocol === "https:" || process.env.VERCEL === "1";
}
