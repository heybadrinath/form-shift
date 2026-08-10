import {
  buildAuthCookie,
  buildClearAuthCookie,
  createAuthToken,
  verifyOwnerPin,
} from "../auth.js";
import { createWorkoutRepository } from "../db/repository.js";
import { getDatabase } from "../db/client.js";
import { AppError } from "../errors.js";
import {
  apiError,
  assertSameOrigin,
  getAuthConfig,
  isAuthenticated,
  json,
  readJson,
  requireAuthentication,
  requireMethod,
  secureCookieForRequest,
  sessionIdFromRequest,
  weightEntryIdFromRequest,
} from "../http.js";
import {
  getLogicalDay,
  resolveLogicalDateMeasurement,
  secondsUntilNextLogicalDay,
  toValidDate,
} from "../time.js";
import {
  getWorkoutTemplate,
  listWorkoutTemplates,
} from "../workout-templates.js";

function repository() {
  return createWorkoutRepository(getDatabase());
}

function shortText(value, field, { max = 120, optional = false } = {}) {
  if (optional && (value === undefined || value === null || value === "")) return null;
  if (typeof value !== "string") {
    throw new AppError("validation_error", `${field} must be text.`, 422, { field });
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > max) {
    throw new AppError(
      "validation_error",
      `${field} must contain between 1 and ${max} characters.`,
      422,
      { field },
    );
  }
  return normalized;
}

function sessionExerciseId(value) {
  const normalized = shortText(value, "exerciseId", { max: 80 });
  if (!/^[a-z0-9-]+$/i.test(normalized)) {
    throw new AppError("validation_error", "exerciseId is invalid.", 422, { field: "exerciseId" });
  }
  return normalized;
}

function setNumber(value) {
  if (!Number.isInteger(value) || value < 1 || value > 50) {
    throw new AppError("validation_error", "setNumber must be an integer from 1 to 50.", 422, { field: "setNumber" });
  }
  return value;
}

function normalizedVariantSelections(value) {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AppError("validation_error", "variantSelections must be an object.", 422);
  }
  const entries = Object.entries(value);
  if (entries.length > 30) {
    throw new AppError("validation_error", "Too many variant selections.", 422);
  }
  return Object.fromEntries(entries.map(([exerciseId, variant]) => [
    sessionExerciseId(exerciseId),
    shortText(variant, `variantSelections.${exerciseId}`, { max: 80 }),
  ]));
}

function requestedWeight(value) {
  const weight = typeof value === "string" ? Number(value.trim()) : value;
  if (!Number.isFinite(weight) || weight < 20 || weight > 500) {
    throw new AppError(
      "validation_error",
      "weightKg must be between 20 and 500.",
      422,
      { field: "weightKg" },
    );
  }
  return Math.round(weight * 100) / 100;
}

function requestedMeasuredAt(value) {
  if (value === undefined || value === null || value === "") return new Date();
  try {
    const dateOnly = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
    const measuredAt = dateOnly
      ? resolveLogicalDateMeasurement(value)
      : toValidDate(value, "measuredAt");
    if (measuredAt.getTime() > Date.now() + 5 * 60 * 1000) {
      throw new AppError(
        "validation_error",
        "measuredAt cannot be in the future.",
        422,
        { field: "measuredAt" },
      );
    }
    return measuredAt;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "validation_error",
      "measuredAt must be a valid ISO timestamp.",
      422,
      { field: "measuredAt" },
    );
  }
}

export async function handleUnlock(request) {
  try {
    requireMethod(request, ["POST"]);
    assertSameOrigin(request);
    const body = await readJson(request, 1_024);
    const candidatePin = shortText(body.pin, "pin", { max: 64 });
    const { pin, secret } = getAuthConfig();
    if (!verifyOwnerPin(candidatePin, pin, secret)) {
      throw new AppError("invalid_credentials", "The PIN is incorrect.", 401);
    }

    const now = new Date();
    const ttlSeconds = secondsUntilNextLogicalDay(now);
    const token = createAuthToken(secret, { nowMs: now.getTime(), ttlSeconds });
    return json({ authenticated: true }, {
      headers: {
        "Set-Cookie": buildAuthCookie(token, {
          secure: secureCookieForRequest(request),
          maxAgeSeconds: ttlSeconds,
        }),
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function handleLock(request) {
  try {
    requireMethod(request, ["POST"]);
    assertSameOrigin(request);
    return json({ authenticated: false }, {
      headers: {
        "Set-Cookie": buildClearAuthCookie({
          secure: secureCookieForRequest(request),
        }),
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function handleBootstrap(request) {
  try {
    requireMethod(request, ["GET"]);
    if (!isAuthenticated(request)) {
      return json({ authenticated: false });
    }

    const now = new Date();
    const logicalDay = getLogicalDay(now);
    const state = await repository().getBootstrapState(logicalDay);
    return json({
      authenticated: true,
      logicalDay,
      serverNow: now.toISOString(),
      templates: listWorkoutTemplates(),
      ...state,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function handleStartWorkout(request) {
  try {
    requireMethod(request, ["POST"]);
    assertSameOrigin(request);
    requireAuthentication(request);
    const body = await readJson(request);
    const template = getWorkoutTemplate(shortText(body.templateId, "templateId", { max: 8 }));
    const variantSelections = normalizedVariantSelections(body.variantSelections);
    const exerciseIds = new Set(template.exercises.map((exercise) => exercise.id));
    const unknownExerciseId = Object.keys(variantSelections)
      .find((exerciseId) => !exerciseIds.has(exerciseId));
    if (unknownExerciseId) {
      throw new AppError(
        "validation_error",
        `variantSelections.${unknownExerciseId} does not belong to this workout.`,
        422,
        { field: `variantSelections.${unknownExerciseId}` },
      );
    }
    const startedAt = new Date();
    const session = await repository().startWorkout({
      templateSnapshot: template,
      logicalDay: getLogicalDay(startedAt),
      startedAt,
      variantSelections,
    });
    return json({ session }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function handleToggleSet(request) {
  try {
    requireMethod(request, ["PUT"]);
    assertSameOrigin(request);
    requireAuthentication(request);
    const body = await readJson(request);
    if (typeof body.completed !== "boolean") {
      throw new AppError("validation_error", "completed must be true or false.", 422, { field: "completed" });
    }
    const result = await repository().toggleSet({
      sessionId: sessionIdFromRequest(request),
      exerciseId: sessionExerciseId(body.exerciseId),
      setNumber: setNumber(body.setNumber),
      completed: body.completed,
    });
    return json(result);
  } catch (error) {
    return apiError(error);
  }
}

export async function handleSelectVariant(request) {
  try {
    requireMethod(request, ["PUT"]);
    assertSameOrigin(request);
    requireAuthentication(request);
    const body = await readJson(request);
    const exercise = await repository().selectVariant({
      sessionId: sessionIdFromRequest(request),
      exerciseId: sessionExerciseId(body.exerciseId),
      variant: shortText(body.variant, "variant", { max: 80 }),
    });
    return json({ exercise });
  } catch (error) {
    return apiError(error);
  }
}

export async function handleSkipExercise(request) {
  try {
    requireMethod(request, ["PUT"]);
    assertSameOrigin(request);
    requireAuthentication(request);
    const body = await readJson(request);
    if (typeof body.skipped !== "boolean") {
      throw new AppError(
        "validation_error",
        "skipped must be true or false.",
        422,
        { field: "skipped" },
      );
    }
    const exercise = await repository().setExerciseSkipped({
      sessionId: sessionIdFromRequest(request),
      exerciseId: sessionExerciseId(body.exerciseId),
      skipped: body.skipped,
    });
    return json({ exercise });
  } catch (error) {
    return apiError(error);
  }
}

export async function handleFinishWorkout(request) {
  try {
    requireMethod(request, ["POST"]);
    assertSameOrigin(request);
    requireAuthentication(request);
    const session = await repository().finishWorkout(sessionIdFromRequest(request));
    return json({ session });
  } catch (error) {
    return apiError(error);
  }
}

export async function handleEndIncompleteWorkout(request) {
  try {
    requireMethod(request, ["POST"]);
    assertSameOrigin(request);
    requireAuthentication(request);
    const body = request.headers.get("content-type")
      ? await readJson(request)
      : {};
    const reason = shortText(body.reason, "reason", { max: 200, optional: true });
    const session = await repository().endIncompleteWorkout(
      sessionIdFromRequest(request),
      reason,
    );
    return json({ session });
  } catch (error) {
    return apiError(error);
  }
}

export async function handleWeights(request) {
  try {
    requireMethod(request, ["GET", "POST"]);
    requireAuthentication(request);

    if (request.method === "GET") {
      const requestedLimit = Number(new URL(request.url).searchParams.get("limit") ?? 30);
      const limit = Number.isInteger(requestedLimit)
        ? Math.min(365, Math.max(1, requestedLimit))
        : 30;
      const weights = await repository().getWeightHistory(limit);
      return json({ weights });
    }

    assertSameOrigin(request);
    const body = await readJson(request);
    const measuredAt = requestedMeasuredAt(body.measuredAt ?? body.date);
    const entry = await repository().addWeight({
      weightKg: requestedWeight(body.weightKg),
      measuredAt,
      logicalDay: getLogicalDay(measuredAt),
    });
    return json({ entry }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function handleWeightEntry(request) {
  try {
    requireMethod(request, ["PUT", "DELETE"]);
    assertSameOrigin(request);
    requireAuthentication(request);
    const entryId = weightEntryIdFromRequest(request);

    if (request.method === "DELETE") {
      await repository().deleteWeight(entryId);
      return json({ deleted: true, entryId });
    }

    const body = await readJson(request);
    const measuredAt = requestedMeasuredAt(body.measuredAt ?? body.date);
    const entry = await repository().updateWeight({
      entryId,
      weightKg: requestedWeight(body.weightKg),
      measuredAt,
      logicalDay: getLogicalDay(measuredAt),
    });
    return json({ entry });
  } catch (error) {
    return apiError(error);
  }
}
