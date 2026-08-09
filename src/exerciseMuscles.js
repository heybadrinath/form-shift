export const MUSCLE_REGIONS = Object.freeze([
  "chest",
  "upperBack",
  "lats",
  "shoulders",
  "biceps",
  "triceps",
  "quads",
  "hamstrings",
  "glutes",
  "hipFlexors",
  "lowerLegs",
  "core",
]);

export const SECONDARY_SET_WEIGHT = 0.5;

export const MUSCLE_EXPOSURE_EXCLUDED_EXERCISE_IDS = Object.freeze([
  "a-cardio",
  "b-cardio",
  "c-cardio",
  "d-cardio",
  "e-cardio",
]);

function resistanceExposure(primary, secondary = []) {
  return Object.freeze({
    category: "resistance",
    primary: Object.freeze(primary),
    secondary: Object.freeze(secondary),
  });
}

const cardioExposure = Object.freeze({
  category: "cardio",
  primary: Object.freeze([]),
  secondary: Object.freeze([]),
});

export const MUSCLE_EXPOSURE_BY_EXERCISE = Object.freeze({
  "a-incline-pushup": resistanceExposure(["chest"], ["shoulders", "triceps"]),
  "a-chest-press": resistanceExposure(["chest"], ["shoulders", "triceps"]),
  "a-pulldown": resistanceExposure(["lats"], ["upperBack", "biceps"]),
  "a-row": resistanceExposure(["upperBack"], ["lats", "biceps"]),
  "a-lateral-raise": resistanceExposure(["shoulders"]),
  "a-triceps": resistanceExposure(["triceps"]),
  "a-hammer-curl": resistanceExposure(["biceps"]),

  "b-leg-press": resistanceExposure(["quads"], ["glutes"]),
  "b-leg-curl": resistanceExposure(["hamstrings"]),
  "b-glute-bridge": resistanceExposure(["glutes"], ["hamstrings"]),
  "b-calf": resistanceExposure(["lowerLegs"]),
  "b-tibialis": resistanceExposure(["lowerLegs"]),
  "b-plank": resistanceExposure(["core"], ["shoulders", "glutes"]),
  "b-dead-bug": resistanceExposure(["core"]),
  "b-compression": resistanceExposure(["hipFlexors"], ["core"]),

  "c-assisted-pullup": resistanceExposure(["lats"], ["upperBack", "biceps"]),
  "c-chest-press": resistanceExposure(["chest"], ["shoulders", "triceps"]),
  "c-row": resistanceExposure(["upperBack"], ["lats", "biceps"]),
  "c-leg-press": resistanceExposure(["quads"], ["glutes"]),
  "c-leg-curl": resistanceExposure(["hamstrings"]),
  "c-reverse-pec": resistanceExposure(["shoulders"], ["upperBack"]),
  "c-crunch": resistanceExposure(["core"]),

  "d-pushup": resistanceExposure(["chest"], ["shoulders", "triceps"]),
  "d-pullup": resistanceExposure(["lats"], ["upperBack", "biceps"]),
  "d-row": resistanceExposure(["upperBack"], ["lats", "biceps"]),
  "d-triceps": resistanceExposure(["triceps"]),
  "d-curl": resistanceExposure(["biceps"]),
  "d-raise": resistanceExposure(["shoulders"]),
  "d-compression": resistanceExposure(["hipFlexors"], ["core"]),

  "e-bridge": resistanceExposure(["glutes"], ["hamstrings"]),
  "e-calf": resistanceExposure(["lowerLegs"]),
  "e-tibialis": resistanceExposure(["lowerLegs"]),
  "e-side-plank": resistanceExposure(["core"], ["shoulders", "glutes"]),
});

export function getExerciseMuscleExposure(exerciseId) {
  const normalizedId = typeof exerciseId === "string" ? exerciseId.trim().toLowerCase() : "";
  if (MUSCLE_EXPOSURE_BY_EXERCISE[normalizedId]) {
    return MUSCLE_EXPOSURE_BY_EXERCISE[normalizedId];
  }
  if (MUSCLE_EXPOSURE_EXCLUDED_EXERCISE_IDS.includes(normalizedId)) {
    return cardioExposure;
  }
  return null;
}
