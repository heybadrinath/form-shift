function milliseconds(value) {
  if (!value) return null;
  const parsed = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildWorkoutHistory(sessionRows, exerciseRows, setRows) {
  const setsByExercise = new Map();
  for (const set of setRows) {
    const key = `${set.sessionId}:${set.exerciseId}`;
    const counts = setsByExercise.get(key) ?? { totalSets: 0, completedSets: 0 };
    counts.totalSets += 1;
    if (set.completedAt) counts.completedSets += 1;
    setsByExercise.set(key, counts);
  }

  const exercisesBySession = new Map();
  for (const exercise of exerciseRows) {
    const exercises = exercisesBySession.get(exercise.sessionId) ?? [];
    const counts = setsByExercise.get(`${exercise.sessionId}:${exercise.exerciseId}`) ?? {
      totalSets: exercise.expectedSets,
      completedSets: 0,
    };
    exercises.push({
      exerciseId: exercise.exerciseId,
      position: exercise.position,
      status: exercise.status,
      totalSets: counts.totalSets,
      completedSets: counts.completedSets,
      selectedVariant: exercise.selectedVariant,
      selectedVariantId: exercise.selectedVariant,
      variantSelectedAt: exercise.variantSelectedAt,
      completedAt: exercise.completedAt,
      skippedAt: exercise.skippedAt,
    });
    exercisesBySession.set(exercise.sessionId, exercises);
  }

  return sessionRows.map((session) => {
    const exercises = (exercisesBySession.get(session.id) ?? [])
      .sort((left, right) => left.position - right.position);
    const completedExercises = exercises.filter(
      (exercise) => exercise.status === "completed",
    ).length;
    const skippedExercises = exercises.filter(
      (exercise) => exercise.status === "skipped",
    ).length;
    const handledExercises = completedExercises + skippedExercises;
    const startedMs = milliseconds(session.startedAt);
    const endedMs = milliseconds(session.endedAt);
    const durationSeconds = startedMs !== null && endedMs !== null && endedMs >= startedMs
      ? Math.floor((endedMs - startedMs) / 1_000)
      : 0;

    return {
      id: session.id,
      sessionId: session.templateId,
      templateId: session.templateId,
      logicalDate: session.logicalDay,
      logicalDay: session.logicalDay,
      status: session.status,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      endedAt: session.endedAt,
      endReason: session.endReason,
      durationSeconds,
      durationMinutes: Math.round(durationSeconds / 60),
      totalExercises: exercises.length,
      completedExercises,
      skippedExercises,
      handledExercises,
      completionPercent: exercises.length
        ? Math.round((handledExercises / exercises.length) * 100)
        : 0,
      exercises,
    };
  });
}
