import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  ne,
  sql,
} from "drizzle-orm";
import { AppError } from "../errors.js";
import {
  assertAllowedVariant,
  assertSessionCanFinish,
  assertSessionIsActive,
} from "../domain/session-invariants.js";
import { buildWorkoutHistory } from "../domain/workout-history.js";
import {
  weightEntries,
  workoutExercises,
  workoutSessions,
  workoutSets,
} from "./schema.js";

const OWNER_KEY = "owner";

function nestedCode(error) {
  return error?.code ?? error?.cause?.code ?? error?.cause?.cause?.code;
}

function mentions(error, value) {
  return [error?.constraint, error?.message, error?.cause?.message]
    .filter(Boolean)
    .some((message) => String(message).includes(value));
}

function translateStartError(error) {
  if (nestedCode(error) !== "23505") return null;
  if (mentions(error, "workout_sessions_one_active_unique")) {
    return new AppError(
      "active_session_exists",
      "Finish or end the active workout before starting another one.",
      409,
    );
  }
  if (mentions(error, "workout_sessions_one_per_logical_day_unique")) {
    return new AppError(
      "logical_day_already_used",
      "A workout has already been started in the current 4 AM logical day.",
      409,
    );
  }
  return new AppError(
    "session_start_conflict",
    "The workout could not be started because its day or active-session slot is already used.",
    409,
  );
}

function normalizeWeight(row) {
  return row ? { ...row, weightKg: Number(row.weightKg) } : row;
}

export function createWorkoutRepository(db) {
  async function getWorkout(sessionId) {
    const [session] = await db
      .select()
      .from(workoutSessions)
      .where(and(
        eq(workoutSessions.id, sessionId),
        eq(workoutSessions.ownerKey, OWNER_KEY),
      ))
      .limit(1);

    if (!session) return null;

    const [exercises, sets] = await Promise.all([
      db
        .select()
        .from(workoutExercises)
        .where(eq(workoutExercises.sessionId, sessionId))
        .orderBy(asc(workoutExercises.position)),
      db
        .select()
        .from(workoutSets)
        .where(eq(workoutSets.sessionId, sessionId))
        .orderBy(asc(workoutSets.exerciseId), asc(workoutSets.setNumber)),
    ]);

    const setsByExercise = new Map();
    for (const set of sets) {
      const rows = setsByExercise.get(set.exerciseId) ?? [];
      rows.push(set);
      setsByExercise.set(set.exerciseId, rows);
    }

    return {
      ...session,
      exercises: exercises.map((exercise) => ({
        ...exercise,
        selectedVariantId: exercise.selectedVariant,
        sets: setsByExercise.get(exercise.exerciseId) ?? [],
      })),
    };
  }

  async function findSessionSummary(where) {
    const [session] = await db
      .select({
        id: workoutSessions.id,
        templateId: workoutSessions.templateId,
        logicalDay: workoutSessions.logicalDay,
        status: workoutSessions.status,
        startedAt: workoutSessions.startedAt,
        endedAt: workoutSessions.endedAt,
      })
      .from(workoutSessions)
      .where(where)
      .limit(1);
    return session ?? null;
  }

  async function getBootstrapState(logicalDay, weightLimit = 30, historyLimit = 120) {
    const [activeSummary, logicalDaySummary, weights, sessionHistory] = await Promise.all([
      findSessionSummary(and(
        eq(workoutSessions.ownerKey, OWNER_KEY),
        eq(workoutSessions.status, "active"),
      )),
      findSessionSummary(and(
        eq(workoutSessions.ownerKey, OWNER_KEY),
        eq(workoutSessions.logicalDay, logicalDay),
      )),
      getWeightHistory(weightLimit),
      getWorkoutHistory(historyLimit),
    ]);

    const activeSession = activeSummary ? await getWorkout(activeSummary.id) : null;
    const logicalDaySession = logicalDaySummary
      ? (logicalDaySummary.id === activeSummary?.id
        ? activeSession
        : await getWorkout(logicalDaySummary.id))
      : null;

    return { activeSession, logicalDaySession, sessionHistory, weights };
  }

  async function startWorkout({ templateSnapshot, logicalDay, startedAt, variantSelections = {} }) {
    const sessionId = randomUUID();
    const exercises = templateSnapshot.exercises.map((exercise, position) => {
      const selectedVariant = variantSelections[exercise.id] ?? null;
      if (selectedVariant !== null) {
        assertAllowedVariant({ exerciseSnapshot: exercise }, selectedVariant);
      }
      return {
        sessionId,
        exerciseId: exercise.id,
        position,
        expectedSets: exercise.sets,
        exerciseSnapshot: exercise,
        selectedVariant,
        variantSelectedAt: selectedVariant ? startedAt : null,
        status: "pending",
        createdAt: startedAt,
        updatedAt: startedAt,
      };
    });
    const sets = exercises.flatMap((exercise) => Array.from(
      { length: exercise.expectedSets },
      (_, index) => ({
        sessionId,
        exerciseId: exercise.exerciseId,
        setNumber: index + 1,
        createdAt: startedAt,
        updatedAt: startedAt,
      }),
    ));

    try {
      await db.batch([
        db.insert(workoutSessions).values({
          id: sessionId,
          ownerKey: OWNER_KEY,
          templateId: templateSnapshot.id,
          templateSnapshot,
          logicalDay,
          status: "active",
          startedAt,
          createdAt: startedAt,
          updatedAt: startedAt,
        }),
        db.insert(workoutExercises).values(exercises),
        db.insert(workoutSets).values(sets),
      ]);
    } catch (error) {
      const translated = translateStartError(error);
      if (translated) throw translated;
      throw error;
    }

    return getWorkout(sessionId);
  }

  async function toggleSet({ sessionId, exerciseId, setNumber, completed }) {
    const [, updatedSets, updatedExercises] = await db.batch([
      db.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${sessionId}, 0))`),
      db
        .update(workoutSets)
        .set({
          completedAt: completed
            ? sql`COALESCE(${workoutSets.completedAt}, now())`
            : null,
          updatedAt: sql`now()`,
        })
        .where(and(
          eq(workoutSets.sessionId, sessionId),
          eq(workoutSets.exerciseId, exerciseId),
          eq(workoutSets.setNumber, setNumber),
          sql`EXISTS (
            SELECT 1 FROM ${workoutSessions}
            WHERE ${workoutSessions.id} = ${sessionId}
              AND ${workoutSessions.ownerKey} = ${OWNER_KEY}
              AND ${workoutSessions.status} = 'active'
          )`,
          sql`EXISTS (
            SELECT 1 FROM ${workoutExercises}
            WHERE ${workoutExercises.sessionId} = ${sessionId}
              AND ${workoutExercises.exerciseId} = ${exerciseId}
              AND ${workoutExercises.status} <> 'skipped'
          )`,
        ))
        .returning(),
      db
        .update(workoutExercises)
        .set({
          status: sql`CASE
            WHEN NOT EXISTS (
              SELECT 1 FROM ${workoutSets}
              WHERE ${workoutSets.sessionId} = ${sessionId}
                AND ${workoutSets.exerciseId} = ${exerciseId}
                AND ${workoutSets.completedAt} IS NULL
            ) THEN 'completed'::workout_exercise_status
            ELSE 'pending'::workout_exercise_status
          END`,
          completedAt: sql`CASE
            WHEN NOT EXISTS (
              SELECT 1 FROM ${workoutSets}
              WHERE ${workoutSets.sessionId} = ${sessionId}
                AND ${workoutSets.exerciseId} = ${exerciseId}
                AND ${workoutSets.completedAt} IS NULL
            ) THEN COALESCE(${workoutExercises.completedAt}, now())
            ELSE NULL
          END`,
          skippedAt: null,
          updatedAt: sql`now()`,
        })
        .where(and(
          eq(workoutExercises.sessionId, sessionId),
          eq(workoutExercises.exerciseId, exerciseId),
          sql`EXISTS (
            SELECT 1 FROM ${workoutSessions}
            WHERE ${workoutSessions.id} = ${sessionId}
              AND ${workoutSessions.ownerKey} = ${OWNER_KEY}
              AND ${workoutSessions.status} = 'active'
          )`,
        ))
        .returning(),
    ]);

    if (updatedSets.length === 0) {
      const session = await getWorkout(sessionId);
      assertSessionIsActive(session);
      const exercise = session.exercises.find((item) => item.exerciseId === exerciseId);
      if (exercise?.status === "skipped") {
        throw new AppError(
          "exercise_skipped",
          "Unskip the exercise before changing its sets.",
          409,
        );
      }
      throw new AppError("set_not_found", "Exercise set not found.", 404);
    }

    return {
      set: updatedSets[0],
      exercise: updatedExercises[0],
    };
  }

  async function selectVariant({ sessionId, exerciseId, variant }) {
    const session = await getWorkout(sessionId);
    assertSessionIsActive(session);
    const exercise = session.exercises.find((item) => item.exerciseId === exerciseId);
    if (!exercise) {
      throw new AppError("exercise_not_found", "Exercise not found.", 404);
    }
    assertAllowedVariant(exercise, variant);

    const [updated] = await db
      .update(workoutExercises)
      .set({
        selectedVariant: variant,
        variantSelectedAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(and(
        eq(workoutExercises.sessionId, sessionId),
        eq(workoutExercises.exerciseId, exerciseId),
        sql`EXISTS (
          SELECT 1 FROM ${workoutSessions}
          WHERE ${workoutSessions.id} = ${sessionId}
            AND ${workoutSessions.ownerKey} = ${OWNER_KEY}
            AND ${workoutSessions.status} = 'active'
        )`,
      ))
      .returning();

    if (!updated) {
      throw new AppError(
        "session_not_active",
        "Only the active workout session can be changed.",
        409,
      );
    }
    return {
      ...updated,
      selectedVariantId: updated.selectedVariant,
    };
  }

  async function setExerciseSkipped({ sessionId, exerciseId, skipped }) {
    const [, updatedExercises] = await db.batch([
      db.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${sessionId}, 0))`),
      db
        .update(workoutExercises)
        .set(skipped ? {
          status: "skipped",
          completedAt: null,
          skippedAt: sql`COALESCE(${workoutExercises.skippedAt}, now())`,
          updatedAt: sql`now()`,
        } : {
          status: sql`CASE
            WHEN NOT EXISTS (
              SELECT 1 FROM ${workoutSets}
              WHERE ${workoutSets.sessionId} = ${sessionId}
                AND ${workoutSets.exerciseId} = ${exerciseId}
                AND ${workoutSets.completedAt} IS NULL
            ) THEN 'completed'::workout_exercise_status
            ELSE 'pending'::workout_exercise_status
          END`,
          completedAt: sql`CASE
            WHEN NOT EXISTS (
              SELECT 1 FROM ${workoutSets}
              WHERE ${workoutSets.sessionId} = ${sessionId}
                AND ${workoutSets.exerciseId} = ${exerciseId}
                AND ${workoutSets.completedAt} IS NULL
            ) THEN now()
            ELSE NULL
          END`,
          skippedAt: null,
          updatedAt: sql`now()`,
        })
        .where(and(
          eq(workoutExercises.sessionId, sessionId),
          eq(workoutExercises.exerciseId, exerciseId),
          sql`EXISTS (
            SELECT 1 FROM ${workoutSessions}
            WHERE ${workoutSessions.id} = ${sessionId}
              AND ${workoutSessions.ownerKey} = ${OWNER_KEY}
              AND ${workoutSessions.status} = 'active'
          )`,
        ))
        .returning(),
    ]);

    if (updatedExercises.length === 0) {
      const session = await getWorkout(sessionId);
      assertSessionIsActive(session);
      throw new AppError("exercise_not_found", "Exercise not found.", 404);
    }
    return {
      ...updatedExercises[0],
      selectedVariantId: updatedExercises[0].selectedVariant,
    };
  }

  async function finishWorkout(sessionId) {
    const [updated] = await db
      .update(workoutSessions)
      .set({
        status: "completed",
        completedAt: sql`now()`,
        endedAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(and(
        eq(workoutSessions.id, sessionId),
        eq(workoutSessions.ownerKey, OWNER_KEY),
        eq(workoutSessions.status, "active"),
        sql`EXISTS (
          SELECT 1 FROM ${workoutExercises}
          WHERE ${workoutExercises.sessionId} = ${sessionId}
        )`,
        sql`NOT EXISTS (
          SELECT 1 FROM ${workoutExercises}
          WHERE ${workoutExercises.sessionId} = ${sessionId}
            AND ${workoutExercises.status} NOT IN ('completed', 'skipped')
        )`,
      ))
      .returning();

    if (!updated) {
      const session = await getWorkout(sessionId);
      assertSessionCanFinish(session);
      throw new AppError("session_finish_conflict", "Workout could not be finished.", 409);
    }
    return getWorkout(sessionId);
  }

  async function endIncompleteWorkout(sessionId, reason = null) {
    const [updated] = await db
      .update(workoutSessions)
      .set({
        status: "incomplete",
        completedAt: null,
        endedAt: sql`now()`,
        endReason: reason,
        updatedAt: sql`now()`,
      })
      .where(and(
        eq(workoutSessions.id, sessionId),
        eq(workoutSessions.ownerKey, OWNER_KEY),
        eq(workoutSessions.status, "active"),
      ))
      .returning();

    if (!updated) {
      const session = await getWorkout(sessionId);
      assertSessionIsActive(session);
      throw new AppError("session_end_conflict", "Workout could not be ended.", 409);
    }
    return getWorkout(sessionId);
  }

  async function addWeight({ weightKg, measuredAt, logicalDay }) {
    const [entry] = await db
      .insert(weightEntries)
      .values({
        id: randomUUID(),
        weightKg: weightKg.toFixed(2),
        measuredAt,
        logicalDay,
      })
      .returning();
    return normalizeWeight(entry);
  }

  async function getWeightHistory(limit = 30) {
    const rows = await db
      .select()
      .from(weightEntries)
      .orderBy(desc(weightEntries.measuredAt), desc(weightEntries.createdAt))
      .limit(limit);
    return rows.map(normalizeWeight);
  }

  async function updateWeight({ entryId, weightKg, measuredAt, logicalDay }) {
    const [entry] = await db
      .update(weightEntries)
      .set({
        weightKg: weightKg.toFixed(2),
        measuredAt,
        logicalDay,
        updatedAt: sql`now()`,
      })
      .where(eq(weightEntries.id, entryId))
      .returning();
    if (!entry) {
      throw new AppError("weight_entry_not_found", "Weight entry not found.", 404);
    }
    return normalizeWeight(entry);
  }

  async function deleteWeight(entryId) {
    const [entry] = await db
      .delete(weightEntries)
      .where(eq(weightEntries.id, entryId))
      .returning({ id: weightEntries.id });
    if (!entry) {
      throw new AppError("weight_entry_not_found", "Weight entry not found.", 404);
    }
    return entry;
  }

  async function getWorkoutHistory(limit = 120) {
    const sessionRows = await db
      .select({
        id: workoutSessions.id,
        templateId: workoutSessions.templateId,
        logicalDay: workoutSessions.logicalDay,
        status: workoutSessions.status,
        startedAt: workoutSessions.startedAt,
        completedAt: workoutSessions.completedAt,
        endedAt: workoutSessions.endedAt,
        endReason: workoutSessions.endReason,
      })
      .from(workoutSessions)
      .where(and(
        eq(workoutSessions.ownerKey, OWNER_KEY),
        ne(workoutSessions.status, "active"),
      ))
      .orderBy(desc(workoutSessions.startedAt))
      .limit(limit);
    if (sessionRows.length === 0) return [];

    const sessionIds = sessionRows.map((session) => session.id);
    const [exerciseRows, setRows] = await Promise.all([
      db
        .select()
        .from(workoutExercises)
        .where(inArray(workoutExercises.sessionId, sessionIds))
        .orderBy(asc(workoutExercises.sessionId), asc(workoutExercises.position)),
      db
        .select()
        .from(workoutSets)
        .where(inArray(workoutSets.sessionId, sessionIds)),
    ]);
    return buildWorkoutHistory(sessionRows, exerciseRows, setRows);
  }

  return {
    addWeight,
    deleteWeight,
    endIncompleteWorkout,
    finishWorkout,
    getBootstrapState,
    getWeightHistory,
    getWorkoutHistory,
    getWorkout,
    selectVariant,
    setExerciseSkipped,
    startWorkout,
    toggleSet,
    updateWeight,
  };
}
