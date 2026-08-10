import { config } from "dotenv";
import { count, sql } from "drizzle-orm";
import { getDatabase } from "../server/db/client.js";
import {
  weightEntries,
  workoutExercises,
  workoutSessions,
  workoutSets,
} from "../server/db/schema.js";
import {
  assertJournalIsEmpty,
  databaseTarget,
  normalizeJournalCounts,
  resetIsConfirmed,
} from "../server/domain/journal-reset.js";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const target = databaseTarget(process.env.DATABASE_URL);
const confirmed = resetIsConfirmed(process.argv.slice(2), target.database);
const db = getDatabase();

function countQuery(table) {
  return db.select({ value: count() }).from(table);
}

function countValue(result) {
  return Number(result?.[0]?.value ?? 0);
}

function printCounts(label, counts) {
  console.log(
    `${label}: ${counts.sessions} sessions, ${counts.exercises} exercises, `
    + `${counts.sets} sets, ${counts.weights} weights.`,
  );
}

console.log(`Target: ${target.host}/${target.database}`);

if (!confirmed) {
  const [sessions, exercises, sets, weights] = await db.batch([
    countQuery(workoutSessions),
    countQuery(workoutExercises),
    countQuery(workoutSets),
    countQuery(weightEntries),
  ]);
  const before = normalizeJournalCounts({
    sessions: countValue(sessions),
    exercises: countValue(exercises),
    sets: countValue(sets),
    weights: countValue(weights),
  });
  printCounts("Current journal", before);
  console.log(
    `Dry run only. To permanently clear this journal, rerun with `
    + `--confirm-reset-owner-journal=${target.database}`,
  );
  process.exit(0);
}

const results = await db.batch([
  db.execute(sql`
    LOCK TABLE workout_sessions, workout_exercises, workout_sets, weight_entries
    IN ACCESS EXCLUSIVE MODE
  `),
  countQuery(workoutSessions),
  countQuery(workoutExercises),
  countQuery(workoutSets),
  countQuery(weightEntries),
  db.delete(workoutSessions).returning({ id: workoutSessions.id }),
  db.delete(weightEntries).returning({ id: weightEntries.id }),
  db.execute(sql`
    DO $journal_reset$
    BEGIN
      IF EXISTS (SELECT 1 FROM workout_sessions)
        OR EXISTS (SELECT 1 FROM workout_exercises)
        OR EXISTS (SELECT 1 FROM workout_sets)
        OR EXISTS (SELECT 1 FROM weight_entries)
      THEN
        RAISE EXCEPTION 'Owner journal reset verification failed.';
      END IF;
    END
    $journal_reset$
  `),
  countQuery(workoutSessions),
  countQuery(workoutExercises),
  countQuery(workoutSets),
  countQuery(weightEntries),
]);

const before = normalizeJournalCounts({
  sessions: countValue(results[1]),
  exercises: countValue(results[2]),
  sets: countValue(results[3]),
  weights: countValue(results[4]),
});
const after = assertJournalIsEmpty({
  sessions: countValue(results[8]),
  exercises: countValue(results[9]),
  sets: countValue(results[10]),
  weights: countValue(results[11]),
});
const removedSessions = results[5].length;
const removedWeights = results[6].length;

if (removedSessions !== before.sessions || removedWeights !== before.weights) {
  throw new Error("The reset completed, but the returned deletion counts did not match the initial counts.");
}

printCounts("Before", before);
console.log(
  `Deleted: ${removedSessions} sessions, ${before.exercises} cascaded exercises, `
  + `${before.sets} cascaded sets, ${removedWeights} weights.`,
);
printCounts("After", after);
console.log("This is a permanent database deletion; the script does not create a recovery copy.");
