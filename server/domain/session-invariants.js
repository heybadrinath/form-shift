import { AppError } from "../errors.js";

export function assertSessionIsActive(session) {
  if (!session) {
    throw new AppError("session_not_found", "Workout session not found.", 404);
  }
  if (session.status !== "active") {
    throw new AppError(
      "session_not_active",
      "Only the active workout session can be changed.",
      409,
    );
  }
}

export function assertSessionCanFinish(session) {
  assertSessionIsActive(session);
  const exercises = Array.isArray(session.exercises) ? session.exercises : [];
  const incomplete = exercises.filter(
    (exercise) => !["completed", "skipped"].includes(exercise.status),
  );
  if (exercises.length === 0 || incomplete.length > 0) {
    throw new AppError(
      "session_incomplete",
      "Complete or explicitly skip every exercise, or end the workout as incomplete.",
      409,
      { incompleteExerciseIds: incomplete.map((exercise) => exercise.exerciseId) },
    );
  }
}

export function deriveExerciseSkipState(exercise, skipped, now = new Date()) {
  if (typeof skipped !== "boolean") {
    throw new TypeError("skipped must be true or false.");
  }
  if (skipped) {
    return {
      status: "skipped",
      completedAt: null,
      skippedAt: exercise?.skippedAt ?? now,
    };
  }

  const completion = deriveExerciseCompletion(
    exercise?.sets,
    exercise?.completedAt,
    now,
  );
  return { ...completion, skippedAt: null };
}

export function assertStartIsAvailable({ activeSession, logicalDaySession }) {
  if (activeSession) {
    throw new AppError(
      "active_session_exists",
      "Finish or end the active workout before starting another one.",
      409,
      { activeSessionId: activeSession.id },
    );
  }
  if (logicalDaySession) {
    throw new AppError(
      "logical_day_already_used",
      "A workout has already been started in the current 4 AM logical day.",
      409,
      { sessionId: logicalDaySession.id },
    );
  }
}

export function deriveExerciseCompletion(sets, existingCompletedAt, now = new Date()) {
  if (!Array.isArray(sets) || sets.length === 0) {
    throw new TypeError("An exercise must have at least one set.");
  }
  const completed = sets.every((set) => Boolean(set.completedAt));
  return {
    status: completed ? "completed" : "pending",
    completedAt: completed ? (existingCompletedAt ?? now) : null,
  };
}

export function assertAllowedVariant(exercise, variant) {
  const options = exercise?.exerciseSnapshot?.variantOptions ?? [];
  if (!options.includes(variant)) {
    throw new AppError(
      "invalid_variant",
      "That variant is not available for this exercise.",
      422,
      { allowedVariants: options },
    );
  }
}
