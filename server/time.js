export const LOGICAL_DAY_TIME_ZONE = "Asia/Kolkata";
export const LOGICAL_DAY_START_HOUR = 4;

const kolkataFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: LOGICAL_DAY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function toValidDate(value, fieldName = "timestamp") {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`${fieldName} must be a valid date or ISO timestamp.`);
  }
  return date;
}

export function getLogicalDay(value = new Date()) {
  const date = toValidDate(value);
  const parts = Object.fromEntries(
    kolkataFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  const shiftedLocalClock = new Date(Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour - LOGICAL_DAY_START_HOUR,
    parts.minute,
    parts.second,
  ));

  return shiftedLocalClock.toISOString().slice(0, 10);
}

export function getNextLogicalDayStart(value = new Date()) {
  const date = toValidDate(value);
  const logicalDay = getLogicalDay(date);
  const currentBoundary = toValidDate(
    `${logicalDay}T${String(LOGICAL_DAY_START_HOUR).padStart(2, "0")}:00:00+05:30`,
    "logical day boundary",
  );
  return new Date(currentBoundary.getTime() + 24 * 60 * 60 * 1000);
}

export function secondsUntilNextLogicalDay(value = new Date()) {
  const date = toValidDate(value);
  const nowSeconds = Math.floor(date.getTime() / 1000);
  const boundarySeconds = Math.floor(getNextLogicalDayStart(date).getTime() / 1000);
  return Math.max(1, boundarySeconds - nowSeconds);
}

export function resolveLogicalDateMeasurement(dateKey, now = new Date()) {
  if (typeof dateKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new TypeError("dateKey must use YYYY-MM-DD.");
  }

  const current = toValidDate(now, "now");
  const midday = toValidDate(`${dateKey}T12:00:00+05:30`, "dateKey");
  if (getLogicalDay(midday) !== dateKey) {
    throw new TypeError("dateKey must contain a real calendar date.");
  }

  return getLogicalDay(current) === dateKey ? current : midday;
}
