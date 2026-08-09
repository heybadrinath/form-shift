import { sessions } from "../src/data.js";
import { getExerciseMuscleExposure } from "../src/exerciseMuscles.js";
import { guideForExercise } from "../src/exerciseLibrary.js";
import { AppError } from "./errors.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeTemplate(template) {
  return {
    ...clone(template),
    schemaVersion: 2,
    exercises: template.exercises.map((exercise) => {
      const muscleExposure = getExerciseMuscleExposure(exercise.id);
      if (!muscleExposure) {
        throw new AppError(
          "template_muscle_exposure_missing",
          `Exercise ${exercise.id} does not have muscle-exposure metadata.`,
          500,
        );
      }
      return {
        ...clone(exercise),
        variantOptions: guideForExercise(exercise).variants.map((variant) => variant.id),
        muscleExposure: clone(muscleExposure),
      };
    }),
  };
}

export function listWorkoutTemplates() {
  return sessions.map(normalizeTemplate);
}

export function getWorkoutTemplate(templateId) {
  const normalizedId = typeof templateId === "string" ? templateId.trim().toUpperCase() : "";
  const template = sessions.find((session) => session.id === normalizedId);
  if (!template) {
    throw new AppError("template_not_found", "Workout template not found.", 404);
  }
  return normalizeTemplate(template);
}
