import test from "node:test";
import assert from "node:assert/strict";
import { sessions } from "../src/data.js";
import { guideForExercise } from "../src/exerciseLibrary.js";
import { listWorkoutTemplates } from "../server/workout-templates.js";

test("every template exposes the exercise library's variant IDs", () => {
  const templates = listWorkoutTemplates();
  for (const template of templates) {
    const source = sessions.find((session) => session.id === template.id);
    for (const exercise of template.exercises) {
      const sourceExercise = source.exercises.find((item) => item.id === exercise.id);
      const expectedIds = guideForExercise(sourceExercise).variants.map((variant) => variant.id);
      assert.deepEqual(
        exercise.variantOptions,
        expectedIds,
        `${template.id}/${exercise.id} must use library IDs`,
      );
      assert.ok(exercise.variantOptions.length > 0);
    }
  }
});
