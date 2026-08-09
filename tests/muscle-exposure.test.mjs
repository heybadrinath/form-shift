import assert from "node:assert/strict";
import test from "node:test";
import { sessions } from "../src/data.js";
import {
  getMuscleExposureTier,
  getPersistedCompletedSetCount,
  MUSCLE_EXPOSURE_BY_EXERCISE,
  MUSCLE_EXPOSURE_EXCLUDED_EXERCISE_IDS,
  MUSCLE_REGIONS,
  summarizeWeeklyMuscleExposure,
} from "../src/components/muscleExposure.js";

const NOW = new Date("2026-08-12T12:00:00.000Z");

function historyRecord(overrides = {}) {
  return {
    id: "session-1",
    templateId: "A",
    logicalDay: "2026-08-10",
    status: "completed",
    exercises: [],
    ...overrides,
  };
}

test("maps every current workout exercise to supported body-map regions", () => {
  const templateExercises = sessions.flatMap((session) => session.exercises);
  const cardioExerciseIds = templateExercises
    .filter((exercise) => exercise.id.endsWith("-cardio"))
    .map((exercise) => exercise.id)
    .sort();
  const resistanceExerciseIds = templateExercises
    .filter((exercise) => !exercise.id.endsWith("-cardio"))
    .map((exercise) => exercise.id)
    .sort();

  assert.deepEqual(
    [...MUSCLE_EXPOSURE_EXCLUDED_EXERCISE_IDS].sort(),
    cardioExerciseIds,
  );
  assert.deepEqual(Object.keys(MUSCLE_EXPOSURE_BY_EXERCISE).sort(), resistanceExerciseIds);
  assert.deepEqual(
    Object.entries(MUSCLE_EXPOSURE_BY_EXERCISE)
      .filter(([, mapping]) => mapping.primary.length === 0)
      .map(([exerciseId]) => exerciseId)
      .sort(),
    [],
  );

  const allTemplateExerciseIds = sessions.flatMap((session) => (
    session.exercises.map((exercise) => exercise.id)
  )).sort();
  assert.deepEqual(
    [
      ...Object.keys(MUSCLE_EXPOSURE_BY_EXERCISE),
      ...MUSCLE_EXPOSURE_EXCLUDED_EXERCISE_IDS,
    ].sort(),
    allTemplateExerciseIds,
  );

  for (const [exerciseId, mapping] of Object.entries(MUSCLE_EXPOSURE_BY_EXERCISE)) {
    assert.equal(mapping.category, "resistance");
    assert.equal(new Set(mapping.primary).size, mapping.primary.length, `${exerciseId} repeats a primary region`);
    assert.equal(new Set(mapping.secondary).size, mapping.secondary.length, `${exerciseId} repeats a secondary region`);
    assert.deepEqual(
      mapping.primary.filter((region) => mapping.secondary.includes(region)),
      [],
      `${exerciseId} marks a region as both primary and secondary`,
    );
    for (const region of [...mapping.primary, ...mapping.secondary]) {
      assert.ok(MUSCLE_REGIONS.includes(region), `${exerciseId} uses unsupported region ${region}`);
    }
  }
});

test("counts mapped persisted sets, excludes cardio, and weights secondary exposure by one half", () => {
  const result = summarizeWeeklyMuscleExposure([
    historyRecord({
      exercises: [
        { exerciseId: "a-incline-pushup", status: "completed", totalSets: 2, completedSets: 2 },
        { exerciseId: "a-row", status: "skipped", totalSets: 2, completedSets: 1 },
        { exerciseId: "d-curl", status: "pending", totalSets: 2, completedSets: 1 },
        { exerciseId: "a-triceps", status: "pending", totalSets: 2, completedSets: 0 },
        { exerciseId: "a-cardio", status: "completed", totalSets: 1, completedSets: 1 },
      ],
    }),
    historyRecord({
      id: "session-2",
      templateId: "B",
      logicalDay: "2026-08-11",
      exercises: [
        { exerciseId: "b-compression", status: "skipped", totalSets: 1, completedSets: 1 },
        { exerciseId: "b-tibialis", status: "pending", totalSets: 2, completedSets: 2 },
      ],
    }),
  ], NOW);

  assert.equal(result.totalCompletedSets, 7);
  assert.equal(result.unclassifiedCompletedSets, 0);
  assert.equal(result.trainingDays, 2);
  assert.deepEqual(result.regions.chest, {
    score: 2,
    directSets: 2,
    secondarySets: 0,
    trainingDays: 1,
    tier: "low",
  });
  assert.deepEqual(result.regions.shoulders, {
    score: 1,
    directSets: 0,
    secondarySets: 2,
    trainingDays: 1,
    tier: "low",
  });
  assert.deepEqual(result.regions.upperBack, {
    score: 1,
    directSets: 1,
    secondarySets: 0,
    trainingDays: 1,
    tier: "low",
  });
  assert.deepEqual(result.regions.lats, {
    score: 0.5,
    directSets: 0,
    secondarySets: 1,
    trainingDays: 1,
    tier: "low",
  });
  assert.deepEqual(result.regions.biceps, {
    score: 1.5,
    directSets: 1,
    secondarySets: 1,
    trainingDays: 1,
    tier: "low",
  });
  assert.deepEqual(result.regions.hipFlexors, {
    score: 1,
    directSets: 1,
    secondarySets: 0,
    trainingDays: 1,
    tier: "low",
  });
  assert.deepEqual(result.regions.lowerLegs, {
    score: 2,
    directSets: 2,
    secondarySets: 0,
    trainingDays: 1,
    tier: "low",
  });
  assert.deepEqual(result.regions.core, {
    score: 0.5,
    directSets: 0,
    secondarySets: 1,
    trainingDays: 1,
    tier: "low",
  });
});

test("prefers persisted set timestamps over a conflicting completed-set summary", () => {
  assert.equal(getPersistedCompletedSetCount({
    completedSets: 2,
    sets: [
      { setNumber: 1, completedAt: "2026-08-10T18:00:00.000Z" },
      { setNumber: 2, completedAt: null },
    ],
  }), 1);
  assert.equal(getPersistedCompletedSetCount({ totalSets: 2, completedSets: 7 }), 2);
  assert.equal(getPersistedCompletedSetCount({ totalSets: 2, completedSets: 0 }), 0);
});

test("uses the Asia/Kolkata 4 a.m. boundary for the current logical week", () => {
  const result = summarizeWeeklyMuscleExposure([
    historyRecord({
      id: "before-cutoff",
      logicalDay: undefined,
      startedAt: "2026-08-09T22:29:59.999Z",
      exercises: [{ exerciseId: "a-chest-press", totalSets: 2, completedSets: 2 }],
    }),
    historyRecord({
      id: "at-cutoff",
      logicalDay: undefined,
      startedAt: "2026-08-09T22:30:00.000Z",
      exercises: [{ exerciseId: "c-leg-press", totalSets: 2, completedSets: 2 }],
    }),
    historyRecord({
      id: "previous-week",
      logicalDay: "2026-08-09",
      exercises: [{ exerciseId: "a-row", totalSets: 2, completedSets: 2 }],
    }),
    historyRecord({
      id: "future-day",
      logicalDay: "2026-08-13",
      exercises: [{ exerciseId: "c-row", totalSets: 2, completedSets: 2 }],
    }),
  ], NOW);

  assert.equal(result.totalCompletedSets, 2);
  assert.equal(result.trainingDays, 1);
  assert.equal(result.regions.quads.directSets, 2);
  assert.equal(result.regions.glutes.secondarySets, 2);
  assert.equal(result.regions.chest.score, 0);
  assert.equal(result.regions.upperBack.score, 0);
});

test("prefers snapshot metadata and reports completed sets that cannot be classified", () => {
  const result = summarizeWeeklyMuscleExposure([
    historyRecord({
      exercises: [
        {
          exerciseId: "a-row",
          totalSets: 2,
          completedSets: 2,
          muscleExposure: {
            category: "resistance",
            primary: ["chest"],
            secondary: ["triceps"],
          },
        },
        { exerciseId: "legacy-unknown", totalSets: 3, completedSets: 3 },
        { exerciseId: "a-cardio", totalSets: 1, completedSets: 1 },
      ],
    }),
  ], NOW);

  assert.equal(result.totalCompletedSets, 2);
  assert.equal(result.unclassifiedCompletedSets, 3);
  assert.equal(result.trainingDays, 1);
  assert.equal(result.regions.chest.directSets, 2);
  assert.equal(result.regions.triceps.secondarySets, 2);
  assert.equal(result.regions.upperBack.score, 0);
});

test("returns all regions at zero and applies deterministic tier boundaries", () => {
  const result = summarizeWeeklyMuscleExposure([], NOW);
  assert.equal(result.totalCompletedSets, 0);
  assert.equal(result.unclassifiedCompletedSets, 0);
  assert.equal(result.trainingDays, 0);
  assert.deepEqual(Object.keys(result.regions), MUSCLE_REGIONS);
  for (const region of MUSCLE_REGIONS) {
    assert.deepEqual(result.regions[region], {
      score: 0,
      directSets: 0,
      secondarySets: 0,
      trainingDays: 0,
      tier: "none",
    });
  }

  assert.equal(getMuscleExposureTier(0), "none");
  assert.equal(getMuscleExposureTier(0.5), "low");
  assert.equal(getMuscleExposureTier(2.99), "low");
  assert.equal(getMuscleExposureTier(3), "moderate");
  assert.equal(getMuscleExposureTier(5.99), "moderate");
  assert.equal(getMuscleExposureTier(6), "high");
});
