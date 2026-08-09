import { createHash } from "node:crypto";
import { getWorkoutTemplate } from "./workout-templates.js";

export const SEED_SESSION_COUNT = 25;
export const SEED_WEIGHT_COUNT = 10;

const SESSION_OFFSETS = [54, 52, 50, 47, 45, 43, 40, 38, 36, 33, 31, 29, 26, 24, 22, 19, 17, 15, 12, 10, 8, 6, 4, 2, 1];
const SESSION_SEQUENCE = ["A", "B", "C", "A", "B", "C", "D", "A", "B", "C", "E", "A", "B", "C", "D", "A", "B", "C", "A", "B", "C", "E", "A", "B", "C"];
const SESSION_DURATIONS = [48, 53, 56, 44, 61, 50, 47, 55, 42];
const INCOMPLETE_SESSION_INDEXES = new Set([5, 19, 23]);
const WEIGHT_OFFSETS = [52, 45, 38, 31, 24, 17, 10, 6, 3, 1];
const WEIGHT_VALUES = [74.6, 74.4, 74.1, 74.2, 73.8, 73.6, 73.4, 73.5, 73.1, 73.2];

function seedUuid(kind, index) {
  const hash = createHash("sha256").update(`form-shift-sample:${kind}:${index}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export const SEEDED_SESSION_IDS = Array.from(
  { length: SEED_SESSION_COUNT },
  (_, index) => seedUuid("session", index),
);

export const SEEDED_WEIGHT_IDS = Array.from(
  { length: SEED_WEIGHT_COUNT },
  (_, index) => seedUuid("weight", index),
);

function subtractDays(dateKey, days) {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function localInstant(dateKey, hour, minute) {
  return new Date(`${dateKey}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+05:30`);
}

function addMinutes(value, minutes) {
  return new Date(value.getTime() + minutes * 60_000);
}

function sessionRows(anchorDateKey) {
  const sessions = [];
  const exercises = [];
  const sets = [];

  SESSION_OFFSETS.forEach((offset, sessionIndex) => {
    const logicalDay = subtractDays(anchorDateKey, offset);
    const templateId = SESSION_SEQUENCE[sessionIndex];
    const templateSnapshot = getWorkoutTemplate(templateId);
    const sessionId = SEEDED_SESSION_IDS[sessionIndex];
    const durationMinutes = SESSION_DURATIONS[sessionIndex % SESSION_DURATIONS.length];
    const startedAt = localInstant(logicalDay, 22 + (sessionIndex % 2), 12 + (sessionIndex * 7) % 35);
    const endedAt = addMinutes(startedAt, durationMinutes);
    const isIncomplete = INCOMPLETE_SESSION_INDEXES.has(sessionIndex);
    const completedExerciseCount = isIncomplete
      ? Math.max(2, Math.floor(templateSnapshot.exercises.length * (sessionIndex === 5 ? 0.58 : 0.42)))
      : templateSnapshot.exercises.length;

    sessions.push({
      id: sessionId,
      ownerKey: "owner",
      templateId,
      templateSnapshot,
      logicalDay,
      status: isIncomplete ? "incomplete" : "completed",
      startedAt,
      completedAt: isIncomplete ? null : endedAt,
      endedAt,
      endReason: isIncomplete ? "Sample session ended early" : null,
      createdAt: startedAt,
      updatedAt: endedAt,
    });

    templateSnapshot.exercises.forEach((exercise, exerciseIndex) => {
      const variants = exercise.variantOptions ?? [];
      const selectedVariant = variants.length
        ? variants[(sessionIndex + exerciseIndex) % variants.length]
        : null;
      const shouldSkip = !isIncomplete
        && sessionIndex % 7 === 4
        && exerciseIndex === templateSnapshot.exercises.length - 2;
      const isCompleted = !isIncomplete || exerciseIndex < completedExerciseCount;
      const status = shouldSkip ? "skipped" : isCompleted ? "completed" : "pending";
      const handledAt = addMinutes(
        startedAt,
        Math.min(durationMinutes - 2, 5 + Math.round(((exerciseIndex + 1) / templateSnapshot.exercises.length) * (durationMinutes - 8))),
      );

      exercises.push({
        sessionId,
        exerciseId: exercise.id,
        position: exerciseIndex,
        expectedSets: exercise.sets,
        exerciseSnapshot: exercise,
        selectedVariant,
        variantSelectedAt: selectedVariant ? addMinutes(startedAt, exerciseIndex) : null,
        status,
        completedAt: status === "completed" ? handledAt : null,
        skippedAt: status === "skipped" ? handledAt : null,
        createdAt: startedAt,
        updatedAt: status === "pending" ? endedAt : handledAt,
      });

      Array.from({ length: exercise.sets }, (_, setIndex) => {
        const completePendingSet = isIncomplete
          && exerciseIndex === completedExerciseCount
          && setIndex === 0;
        const completedAt = status === "completed" || completePendingSet
          ? addMinutes(startedAt, Math.min(durationMinutes - 3, 4 + exerciseIndex * 5 + setIndex * 2))
          : null;
        sets.push({
          sessionId,
          exerciseId: exercise.id,
          setNumber: setIndex + 1,
          completedAt,
          createdAt: startedAt,
          updatedAt: completedAt ?? endedAt,
        });
      });
    });
  });

  return { sessions, exercises, sets };
}

function weightRows(anchorDateKey) {
  return WEIGHT_OFFSETS.map((offset, index) => {
    const logicalDay = subtractDays(anchorDateKey, offset);
    const measuredAt = localInstant(logicalDay, 8, 10 + index * 3);
    return {
      id: SEEDED_WEIGHT_IDS[index],
      weightKg: WEIGHT_VALUES[index].toFixed(2),
      measuredAt,
      logicalDay,
      createdAt: measuredAt,
      updatedAt: measuredAt,
    };
  });
}

export function buildSeedData(anchorDateKey) {
  if (typeof anchorDateKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(anchorDateKey)) {
    throw new TypeError("anchorDateKey must be a YYYY-MM-DD date.");
  }
  return {
    ...sessionRows(anchorDateKey),
    weights: weightRows(anchorDateKey),
  };
}

export function omitOccupiedWorkoutDays(seedData, occupiedLogicalDays) {
  const occupied = new Set(occupiedLogicalDays);
  const sessions = seedData.sessions.filter((session) => !occupied.has(session.logicalDay));
  const sessionIds = new Set(sessions.map((session) => session.id));
  return {
    sessions,
    exercises: seedData.exercises.filter((exercise) => sessionIds.has(exercise.sessionId)),
    sets: seedData.sets.filter((set) => sessionIds.has(set.sessionId)),
    weights: seedData.weights,
  };
}
