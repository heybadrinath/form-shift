import { sessions } from "../src/data.js";
import { guideForExercise } from "../src/exerciseLibrary.js";
import { AppError } from "./errors.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeTemplate(template) {
  return {
    schemaVersion: 1,
    ...clone(template),
    exercises: template.exercises.map((exercise) => ({
      ...clone(exercise),
      variantOptions: guideForExercise(exercise).variants.map((variant) => variant.id),
    })),
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
