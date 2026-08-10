const CONFIRMATION_PREFIX = "--confirm-reset-owner-journal=";

export function databaseTarget(databaseUrl) {
  const parsed = new URL(databaseUrl);
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!database || !parsed.hostname) throw new Error("The database target is incomplete.");
  return { database, host: parsed.hostname };
}

export function resetIsConfirmed(argumentsList, database) {
  if (!Array.isArray(argumentsList) || argumentsList.length === 0) return false;
  const expected = `${CONFIRMATION_PREFIX}${database}`;
  if (argumentsList.length !== 1 || argumentsList[0] !== expected) {
    throw new Error(`Reset refused. Use the exact confirmation flag: ${expected}`);
  }
  return true;
}

export function normalizeJournalCounts(values) {
  const counts = Object.fromEntries(
    ["sessions", "exercises", "sets", "weights"].map((key) => {
      const value = Number(values?.[key]);
      if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error(`Invalid ${key} count returned by the database.`);
      }
      return [key, value];
    }),
  );
  return counts;
}

export function assertJournalIsEmpty(counts) {
  const normalized = normalizeJournalCounts(counts);
  if (Object.values(normalized).some((value) => value !== 0)) {
    throw new Error("Owner journal reset verification failed.");
  }
  return normalized;
}
