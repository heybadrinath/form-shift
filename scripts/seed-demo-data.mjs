import { config } from "dotenv";
import { inArray } from "drizzle-orm";
import { getDatabase } from "../server/db/client.js";
import {
  weightEntries,
  workoutExercises,
  workoutSessions,
  workoutSets,
} from "../server/db/schema.js";
import {
  buildSeedData,
  omitOccupiedWorkoutDays,
  SEEDED_SESSION_IDS,
  SEEDED_WEIGHT_IDS,
} from "../server/seed-data.js";
import { getLogicalDay } from "../server/time.js";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const resetOnly = process.argv.includes("--reset");
const throughToday = process.argv.includes("--through-today");
const supportedArguments = new Set(["--reset", "--through-today"]);
const unknownArguments = process.argv.slice(2).filter((argument) => !supportedArguments.has(argument));
if (unknownArguments.length || (resetOnly && throughToday)) {
  throw new Error("Use either --reset or --through-today, with no other arguments.");
}
const db = getDatabase();

const [removedSessions, removedWeights] = await db.batch([
  db
    .delete(workoutSessions)
    .where(inArray(workoutSessions.id, SEEDED_SESSION_IDS))
    .returning({ id: workoutSessions.id }),
  db
    .delete(weightEntries)
    .where(inArray(weightEntries.id, SEEDED_WEIGHT_IDS))
    .returning({ id: weightEntries.id }),
]);

if (resetOnly) {
  console.log(`Removed ${removedSessions.length} sample sessions and ${removedWeights.length} sample weight entries.`);
  process.exit(0);
}

const existingSessions = await db
  .select({ logicalDay: workoutSessions.logicalDay })
  .from(workoutSessions);

const anchorInstant = throughToday
  ? new Date(Date.now() + 24 * 60 * 60 * 1000)
  : new Date();
const anchorDateKey = getLogicalDay(anchorInstant);
const seedData = omitOccupiedWorkoutDays(
  buildSeedData(anchorDateKey),
  existingSessions.map((session) => session.logicalDay),
);

const insertions = [];
if (seedData.sessions.length) insertions.push(db.insert(workoutSessions).values(seedData.sessions));
if (seedData.exercises.length) insertions.push(db.insert(workoutExercises).values(seedData.exercises));
if (seedData.sets.length) insertions.push(db.insert(workoutSets).values(seedData.sets));
if (seedData.weights.length) insertions.push(db.insert(weightEntries).values(seedData.weights));
if (insertions.length) await db.batch(insertions);

const skippedDays = 25 - seedData.sessions.length;
console.log(`Seeded ${seedData.sessions.length} sample sessions and ${seedData.weights.length} sample weight entries for ${anchorDateKey}.`);
if (throughToday) {
  console.log("Review mode includes the current logical day, so today's workout slot is temporarily occupied.");
}
if (skippedDays) {
  console.log(`Skipped ${skippedDays} workout days that already contained real sessions.`);
}
