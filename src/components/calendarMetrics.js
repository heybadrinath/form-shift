function nonNegativeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
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
