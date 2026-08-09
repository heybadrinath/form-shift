export const SESSION_IDS = ["A", "B", "C", "D", "E"];

export const LOGICAL_DAY_TIME_ZONE = "Asia/Kolkata";
export const MIN_BODY_WEIGHT_KG = 20;
export const MAX_BODY_WEIGHT_KG = 500;

export const SESSION_TONES = {
  A: "coral",
  B: "aqua",
  C: "violet",
  D: "butter",
  E: "sage",
};

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function finiteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isDateKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const logicalClockFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: LOGICAL_DAY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function logicalDateKeyFromInstant(value, cutoffHour = 4) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = Object.fromEntries(
    logicalClockFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  const cutoff = finiteNumber(cutoffHour);
  const shiftedClock = new Date(Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour - (cutoff === null ? 4 : clamp(Math.trunc(cutoff), 0, 23)),
    parts.minute,
    parts.second,
  ));
  return shiftedClock.toISOString().slice(0, 10);
}

export function toLocalDateKey(value) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateFromKey(dateKey) {
  if (!isDateKey(dateKey)) return null;
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function getLogicalDateKey(record, cutoffHour = 4) {
  if (!record) return null;

  if (isDateKey(record.logicalDay)) return record.logicalDay;
  if (isDateKey(record.logicalDate)) return record.logicalDate;
  if (isDateKey(record.workoutDate)) return record.workoutDate;

  const source =
    record.startedAt ??
    record.completedAt ??
    record.endedAt ??
    record.finishedAt ??
    record.date;

  if (isDateKey(source)) return source;
  return logicalDateKeyFromInstant(source, cutoffHour);
}

export function getSessionId(record) {
  const candidates = [
    record?.templateId,
    record?.sessionId,
    record?.sessionLetter,
    record?.session?.templateId,
    record?.session?.id,
  ];
  for (const candidate of candidates) {
    const sessionId = typeof candidate === "string" ? candidate.trim().toUpperCase() : "";
    if (SESSION_IDS.includes(sessionId)) return sessionId;
  }
  return null;
}

export function getCompletionPercent(record) {
  const explicit = finiteNumber(record?.completionPercent ?? record?.progressPercent);
  if (explicit !== null) return Math.round(clamp(explicit, 0, 100));

  const progress = finiteNumber(record?.progress);
  if (progress !== null) {
    return Math.round(clamp(progress <= 1 ? progress * 100 : progress, 0, 100));
  }

  const handled = finiteNumber(record?.handledExercises ?? record?.handledCount);
  const total = finiteNumber(record?.totalExercises ?? record?.exerciseCount);
  if (handled !== null && total !== null && total > 0) {
    return Math.round(clamp((handled / total) * 100, 0, 100));
  }

  const completed = finiteNumber(record?.completedExercises ?? record?.completedCount);
  if (completed !== null && total !== null && total > 0) {
    return Math.round(clamp((completed / total) * 100, 0, 100));
  }

  if (record?.completed === true) return 100;
  const status = String(record?.status ?? "").toLowerCase();
  if (["completed", "complete", "done", "finished"].includes(status)) return 100;
  return 0;
}

export function isSessionComplete(record) {
  const status = String(record?.status ?? "").toLowerCase();
  if (["incomplete", "abandoned", "stopped", "cancelled", "canceled", "active", "pending", "in_progress"].includes(status)) return false;
  if (["completed", "complete", "done", "finished"].includes(status)) return true;
  if (typeof record?.completed === "boolean") return record.completed;
  return getCompletionPercent(record) >= 100;
}

export function getDurationMinutes(record) {
  const minutes = finiteNumber(record?.durationMinutes);
  if (minutes !== null) return Math.max(0, Math.round(minutes));

  const seconds = finiteNumber(record?.durationSeconds ?? record?.elapsedSeconds);
  if (seconds !== null) return Math.max(0, Math.round(seconds / 60));

  if (record?.startedAt && (record?.completedAt || record?.endedAt || record?.finishedAt)) {
    const start = new Date(record.startedAt);
    const end = new Date(record.completedAt ?? record.endedAt ?? record.finishedAt);
    const elapsed = end.getTime() - start.getTime();
    if (Number.isFinite(elapsed) && elapsed >= 0) return Math.round(elapsed / 60000);
  }

  return 0;
}

export function normalizeSessionHistory(records = [], cutoffHour = 4) {
  if (!Array.isArray(records)) return [];

  return records
    .map((record, index) => {
      const logicalDateKey = getLogicalDateKey(record, cutoffHour);
      if (!logicalDateKey) return null;

      return {
        ...record,
        recordKey: record.id ?? `${logicalDateKey}-${getSessionId(record) ?? "session"}-${index}`,
        logicalDateKey,
        sessionId: getSessionId(record) ?? "?",
        completionPercent: getCompletionPercent(record),
        durationMinutes: getDurationMinutes(record),
        isComplete: isSessionComplete(record),
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const leftTime = new Date(left.completedAt ?? left.endedAt ?? left.startedAt ?? `${left.logicalDateKey}T12:00:00`).getTime();
      const rightTime = new Date(right.completedAt ?? right.endedAt ?? right.startedAt ?? `${right.logicalDateKey}T12:00:00`).getTime();
      return rightTime - leftTime;
    });
}

export function buildMonthCells(year, monthIndex) {
  const firstOfMonth = new Date(year, monthIndex, 1, 12, 0, 0, 0);
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(year, monthIndex, 1 - mondayOffset, 12, 0, 0, 0);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return {
      date,
      dateKey: toLocalDateKey(date),
      dayNumber: date.getDate(),
      isCurrentMonth: date.getMonth() === monthIndex,
    };
  });
}

export function getLogicalNow(now = new Date(), cutoffHour = 4) {
  const logicalDateKey = logicalDateKeyFromInstant(now, cutoffHour)
    ?? logicalDateKeyFromInstant(new Date(), cutoffHour);
  return dateFromKey(logicalDateKey) ?? new Date();
}

export function getWeekRange(now = new Date(), cutoffHour = 4) {
  const logicalNow = getLogicalNow(now, cutoffHour);
  logicalNow.setHours(12, 0, 0, 0);
  const mondayOffset = (logicalNow.getDay() + 6) % 7;
  const start = new Date(logicalNow);
  start.setDate(logicalNow.getDate() - mondayOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { startKey: toLocalDateKey(start), endKey: toLocalDateKey(end) };
}

export function summarizeTraining(records = [], now = new Date(), cutoffHour = 4) {
  const normalized = normalizeSessionHistory(records, cutoffHour);
  const { startKey, endKey } = getWeekRange(now, cutoffHour);
  const thisWeek = normalized.filter(
    (record) => record.logicalDateKey >= startKey && record.logicalDateKey < endKey,
  );
  const sessionMix = Object.fromEntries(SESSION_IDS.map((sessionId) => [sessionId, 0]));

  normalized.forEach((record) => {
    if (SESSION_IDS.includes(record.sessionId)) sessionMix[record.sessionId] += 1;
  });

  const durationMinutes = thisWeek.reduce((sum, record) => sum + record.durationMinutes, 0);
  const averageCompletion = thisWeek.length
    ? Math.round(thisWeek.reduce((sum, record) => sum + record.completionPercent, 0) / thisWeek.length)
    : 0;

  return {
    normalized,
    thisWeek,
    weeklyFrequency: thisWeek.length,
    durationMinutes,
    averageCompletion,
    sessionMix,
    recent: normalized.slice(0, 6),
  };
}

export function normalizeWeightEntries(entries = [], cutoffHour = 4) {
  if (!Array.isArray(entries)) return [];

  return entries
    .map((entry, index) => {
      const weightKg = finiteNumber(entry?.weightKg ?? entry?.weight ?? entry?.value);
      const explicitDateKey = [entry?.logicalDay, entry?.logicalDate, entry?.date].find(isDateKey);
      const dateKey = explicitDateKey ?? getLogicalDateKey(
        { completedAt: entry?.measuredAt ?? entry?.createdAt },
        cutoffHour,
      );
      if (weightKg === null || !dateKey) return null;
      return {
        ...entry,
        entryKey: entry.id ?? `${dateKey}-${index}`,
        dateKey,
        weightKg,
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const dateOrder = left.dateKey.localeCompare(right.dateKey);
      if (dateOrder !== 0) return dateOrder;
      const leftTime = new Date(left.measuredAt ?? left.createdAt ?? `${left.dateKey}T12:00:00+05:30`).getTime();
      const rightTime = new Date(right.measuredAt ?? right.createdAt ?? `${right.dateKey}T12:00:00+05:30`).getTime();
      return (Number.isFinite(leftTime) ? leftTime : 0) - (Number.isFinite(rightTime) ? rightTime : 0);
    });
}
