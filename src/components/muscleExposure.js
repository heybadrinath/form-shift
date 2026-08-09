import {
  getExerciseMuscleExposure,
  MUSCLE_EXPOSURE_BY_EXERCISE,
  MUSCLE_EXPOSURE_EXCLUDED_EXERCISE_IDS,
  MUSCLE_REGIONS,
  SECONDARY_SET_WEIGHT,
} from "../exerciseMuscles.js";
import {
  getLogicalNow,
  getWeekRange,
  normalizeSessionHistory,
  toLocalDateKey,
} from "./historyUtils.js";

export {
  MUSCLE_EXPOSURE_BY_EXERCISE,
  MUSCLE_EXPOSURE_EXCLUDED_EXERCISE_IDS,
  MUSCLE_REGIONS,
  SECONDARY_SET_WEIGHT,
};

function nonNegativeInteger(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
}

export function getPersistedCompletedSetCount(exercise) {
  if (Array.isArray(exercise?.sets)) {
    return exercise.sets.filter((set) => Boolean(set?.completedAt)).length;
  }

  const completedSets = nonNegativeInteger(
    exercise?.completedSets ?? exercise?.completedSetCount,
  );
  const totalSets = nonNegativeInteger(exercise?.totalSets ?? exercise?.expectedSets);
  return totalSets > 0 ? Math.min(completedSets, totalSets) : completedSets;
}

export function getMuscleExposureTier(score) {
  const normalized = Number.isFinite(Number(score)) ? Math.max(0, Number(score)) : 0;
  if (normalized === 0) return "none";
  if (normalized < 3) return "low";
  if (normalized < 6) return "moderate";
  return "high";
}

function emptyRegions() {
  return Object.fromEntries(MUSCLE_REGIONS.map((region) => [region, {
    score: 0,
    directSets: 0,
    secondarySets: 0,
    trainingDays: 0,
    tier: "none",
  }]));
}

function exerciseId(exercise) {
  const candidate = exercise?.exerciseId ?? exercise?.id ?? exercise?.exerciseSnapshot?.id;
  return typeof candidate === "string" ? candidate.trim().toLowerCase() : "";
}

function normalizeSnapshotExposure(value) {
  if (!value || typeof value !== "object") return null;
  if (value.category === "cardio") {
    return { category: "cardio", primary: [], secondary: [] };
  }
  if (value.category !== "resistance") return null;
  if (!Array.isArray(value.primary) || !Array.isArray(value.secondary)) return null;

  const primary = [...new Set(value.primary)];
  const secondary = [...new Set(value.secondary)];
  if (primary.length === 0) return null;
  if (![...primary, ...secondary].every((region) => MUSCLE_REGIONS.includes(region))) return null;
  if (secondary.some((region) => primary.includes(region))) return null;
  return { category: "resistance", primary, secondary };
}

function muscleExposureForExercise(exercise) {
  const snapshot = exercise?.muscleExposure ?? exercise?.exerciseSnapshot?.muscleExposure;
  if (snapshot !== null && snapshot !== undefined) {
    return normalizeSnapshotExposure(snapshot);
  }
  return getExerciseMuscleExposure(exerciseId(exercise));
}

export function summarizeWeeklyMuscleExposure(records = [], now = new Date(), cutoffHour = 4) {
  const regions = emptyRegions();
  const regionTrainingDays = Object.fromEntries(
    MUSCLE_REGIONS.map((region) => [region, new Set()]),
  );
  const trainingDayKeys = new Set();
  const normalized = normalizeSessionHistory(records, cutoffHour);
  const { startKey, endKey } = getWeekRange(now, cutoffHour);
  const currentLogicalDateKey = toLocalDateKey(getLogicalNow(now, cutoffHour));
  let totalCompletedSets = 0;
  let unclassifiedCompletedSets = 0;

  for (const record of normalized) {
    if (record.logicalDateKey < startKey || record.logicalDateKey >= endKey) continue;
    if (record.logicalDateKey > currentLogicalDateKey) continue;

    for (const exercise of Array.isArray(record.exercises) ? record.exercises : []) {
      const completedSets = getPersistedCompletedSetCount(exercise);
      if (completedSets === 0) continue;

      const mapping = muscleExposureForExercise(exercise);
      if (!mapping) {
        unclassifiedCompletedSets += completedSets;
        continue;
      }
      if (mapping.category === "cardio") continue;

      totalCompletedSets += completedSets;
      trainingDayKeys.add(record.logicalDateKey);

      for (const region of mapping.primary) {
        regions[region].directSets += completedSets;
        regions[region].score += completedSets;
        regionTrainingDays[region].add(record.logicalDateKey);
      }
      for (const region of mapping.secondary) {
        regions[region].secondarySets += completedSets;
        regions[region].score += completedSets * SECONDARY_SET_WEIGHT;
        regionTrainingDays[region].add(record.logicalDateKey);
      }
    }
  }

  for (const region of MUSCLE_REGIONS) {
    regions[region].score = Number(regions[region].score.toFixed(2));
    regions[region].trainingDays = regionTrainingDays[region].size;
    regions[region].tier = getMuscleExposureTier(regions[region].score);
  }

  return {
    totalCompletedSets,
    unclassifiedCompletedSets,
    trainingDays: trainingDayKeys.size,
    regions,
  };
}
