export function upsertJournalEntry(entries, nextEntry) {
  const currentEntries = Array.isArray(entries) ? entries : [];
  if (!nextEntry?.id) return currentEntries;
  return [nextEntry, ...currentEntries.filter((entry) => entry?.id !== nextEntry.id)];
}

export function historyEntryFromSession(session) {
  if (!session?.id) return session;

  const exercises = (Array.isArray(session.exercises) ? session.exercises : []).map((exercise) => {
    const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
    const totalSets = sets.length || Number(exercise.expectedSets) || 0;
    const completedSets = sets.filter((set) => Boolean(set?.completedAt)).length;
    return {
      ...exercise,
      totalSets,
      completedSets,
      muscleExposure: exercise.muscleExposure
        ?? exercise.exerciseSnapshot?.muscleExposure
        ?? null,
    };
  });
  const completedExercises = exercises.filter((exercise) => exercise.status === "completed").length;
  const skippedExercises = exercises.filter((exercise) => exercise.status === "skipped").length;
  const handledExercises = completedExercises + skippedExercises;
  const startedMs = new Date(session.startedAt).getTime();
  const endedMs = new Date(session.endedAt ?? session.completedAt).getTime();
  const durationSeconds = Number.isFinite(startedMs)
    && Number.isFinite(endedMs)
    && endedMs >= startedMs
    ? Math.floor((endedMs - startedMs) / 1_000)
    : 0;

  return {
    ...session,
    sessionId: session.templateId,
    logicalDate: session.logicalDay,
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
}

export function reconcileClosedWorkout(state, session) {
  if (!state || !session?.id) return state;

  const wasActive = state.activeSession?.id === session.id;
  const occupiedLogicalDay = state.logicalDaySession?.id === session.id
    || state.logicalDay === session.logicalDay;

  return {
    ...state,
    activeSession: wasActive ? null : state.activeSession,
    logicalDaySession: occupiedLogicalDay ? session : state.logicalDaySession,
    sessionHistory: upsertJournalEntry(state.sessionHistory, historyEntryFromSession(session)),
  };
}
