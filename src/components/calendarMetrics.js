function nonNegativeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function weekdayFromDateKey(dateKey) {
  if (typeof dateKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const [year, month, day] = dateKey.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(value.getTime()) ? null : WEEKDAY_LABELS[value.getUTCDay()];
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export function filterCalendarRecords(records = [], filters = {}) {
  const safeRecords = Array.isArray(records) ? records : [];
  const status = ["complete", "incomplete"].includes(filters.status)
    ? filters.status
    : "all";
  const sessionId = typeof filters.sessionId === "string"
    ? filters.sessionId.trim().toUpperCase()
    : "ALL";

  return safeRecords.filter((record) => {
    if (status === "complete" && !record?.isComplete) return false;
    if (status === "incomplete" && record?.isComplete) return false;
    if (sessionId !== "ALL" && record?.sessionId !== sessionId) return false;
    return true;
  });
}

export function summarizeCalendarPatterns(records = []) {
  const safeRecords = Array.isArray(records) ? records : [];
  const activeDays = new Set(
    safeRecords.map((record) => record?.logicalDateKey).filter(Boolean),
  ).size;
  const recordedDurations = safeRecords
    .map((record) => Math.round(nonNegativeNumber(record?.durationMinutes)))
    .filter((duration) => duration > 0);
  const sessionCounts = new Map();
  const weekdayCounts = new Map();

  for (const record of safeRecords) {
    if (record?.sessionId) {
      sessionCounts.set(record.sessionId, (sessionCounts.get(record.sessionId) ?? 0) + 1);
    }
    const weekday = weekdayFromDateKey(record?.logicalDateKey);
    if (weekday) weekdayCounts.set(weekday, (weekdayCounts.get(weekday) ?? 0) + 1);
  }

  function uniqueLeader(counts) {
    if (!counts.size) return { label: null, count: 0, isTied: false };
    const maximum = Math.max(...counts.values());
    const leaders = [...counts.entries()]
      .filter(([, count]) => count === maximum)
      .map(([label]) => label);
    return {
      label: leaders.length === 1 ? leaders[0] : null,
      count: maximum,
      isTied: leaders.length > 1,
    };
  }

  return {
    activeDays,
    typicalMinutes: median(recordedDurations),
    recordedDurationCount: recordedDurations.length,
    leadingSession: uniqueLeader(sessionCounts),
    leadingWeekday: uniqueLeader(weekdayCounts),
  };
}

export function summarizeCalendarRecords(records = []) {
  const safeRecords = Array.isArray(records) ? records : [];
  const sessions = safeRecords.length;
  const completed = safeRecords.filter((record) => record?.isComplete).length;
  const incomplete = sessions - completed;
  const trainingMinutes = Math.round(
    safeRecords.reduce((sum, record) => sum + nonNegativeNumber(record?.durationMinutes), 0),
  );
  const averageHandled = sessions
    ? Math.round(
      safeRecords.reduce(
        (sum, record) => sum + Math.min(100, nonNegativeNumber(record?.completionPercent)),
        0,
      ) / sessions,
    )
    : 0;

  return {
    sessions,
    completed,
    incomplete,
    trainingMinutes,
    averageHandled,
    finishRate: sessions ? Math.round((completed / sessions) * 100) : 0,
  };
}

export function summarizeCalendarMonth(records = [], monthPrefix = "") {
  const monthRecords = Array.isArray(records)
    ? records.filter((record) => record?.logicalDateKey?.startsWith(monthPrefix))
    : [];
  return {
    records: monthRecords,
    ...summarizeCalendarRecords(monthRecords),
  };
}

export function buildMonthWeekActivity(monthCells = [], monthRecords = []) {
  if (!Array.isArray(monthCells) || !Array.isArray(monthRecords)) return [];

  return Array.from({ length: Math.ceil(monthCells.length / 7) }, (_, index) => {
    const cells = monthCells.slice(index * 7, index * 7 + 7);
    const currentMonthCells = cells.filter((cell) => cell?.isCurrentMonth);
    if (!currentMonthCells.length) return null;

    const startCell = currentMonthCells[0];
    const endCell = currentMonthCells.at(-1);
    const records = monthRecords
      .filter(
        (record) => record.logicalDateKey >= startCell.dateKey
          && record.logicalDateKey <= endCell.dateKey,
      )
      .sort((left, right) => left.logicalDateKey.localeCompare(right.logicalDateKey));

    return {
      id: `${startCell.dateKey}-${endCell.dateKey}`,
      index,
      label: `Week ${index + 1}`,
      shortLabel: `W${index + 1}`,
      startDateKey: startCell.dateKey,
      endDateKey: endCell.dateKey,
      startDay: startCell.dayNumber,
      endDay: endCell.dayNumber,
      records,
      sessionIds: records.map((record) => record.sessionId),
      ...summarizeCalendarRecords(records),
    };
  }).filter(Boolean);
}
