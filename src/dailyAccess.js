const CHENNAI_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const WORKOUT_DAY_START_HOUR = 4;

export function nextChennaiWorkoutBoundaryMs(nowMs = Date.now()) {
  if (!Number.isFinite(nowMs)) throw new TypeError("nowMs must be a finite timestamp.");

  const chennaiClock = new Date(nowMs + CHENNAI_OFFSET_MS);
  let boundaryMs = Date.UTC(
    chennaiClock.getUTCFullYear(),
    chennaiClock.getUTCMonth(),
    chennaiClock.getUTCDate(),
    WORKOUT_DAY_START_HOUR,
  ) - CHENNAI_OFFSET_MS;

  if (boundaryMs <= nowMs) boundaryMs += 24 * 60 * 60 * 1000;
  return boundaryMs;
}
