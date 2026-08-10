import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarBlank,
  CaretLeft,
  CaretRight,
  CheckCircle,
  Clock,
  FunnelSimple,
  MoonStars,
  ArrowCounterClockwise,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import {
  buildMonthCells,
  dateFromKey,
  getLogicalNow,
  normalizeSessionHistory,
  SESSION_IDS,
  toLocalDateKey,
} from "./historyUtils.js";
import {
  buildMonthWeekActivity,
  filterCalendarRecords,
  summarizeCalendarMonth,
  summarizeCalendarPatterns,
  summarizeCalendarRecords,
} from "./calendarMetrics.js";
import "./TrainingCalendar.css";

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatDuration(minutes) {
  if (!minutes) return "Duration not recorded";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} h ${remainder} min` : `${hours} h`;
}

function formatFullDate(dateKey) {
  const date = dateFromKey(dateKey);
  return date
    ? new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date)
    : dateKey;
}

function formatMetricDuration(minutes) {
  if (!minutes) return { value: "0", detail: "minutes logged" };
  if (minutes < 60) return { value: String(minutes), detail: "minutes logged" };
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return {
    value: remainder ? `${hours}h ${remainder}m` : `${hours}h`,
    detail: `${minutes} minutes total`,
  };
}

function formatWeekRange(week) {
  return week.startDay === week.endDay
    ? String(week.startDay)
    : `${week.startDay}–${week.endDay}`;
}

function dayAriaLabel(cell, records) {
  const label = formatFullDate(cell.dateKey);
  if (!records.length) return `${label}, no workout recorded`;
  const details = records
    .map((record) => `Session ${record.sessionId}, ${record.isComplete ? "complete" : `${record.completionPercent}% handled`}`)
    .join("; ");
  return `${label}, ${records.length} ${records.length === 1 ? "workout" : "workouts"}: ${details}`;
}

export function TrainingCalendar({
  sessionHistory = [],
  logicalDayCutoffHour = 4,
  initialMonth,
  onRecordSelect,
}) {
  const logicalToday = getLogicalNow(new Date(), logicalDayCutoffHour);
  const todayKey = toLocalDateKey(logicalToday);
  const [monthCursor, setMonthCursor] = useState(() => {
    const parsed = /^\d{4}-\d{2}$/.test(initialMonth ?? "")
      ? dateFromKey(`${initialMonth}-01`)
      : null;
    const startingDate = parsed ?? getLogicalNow(new Date(), logicalDayCutoffHour);
    return new Date(startingDate.getFullYear(), startingDate.getMonth(), 1, 12, 0, 0, 0);
  });
  const [selectedDateKey, setSelectedDateKey] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [sessionFilter, setSessionFilter] = useState("all");
  const returnFocusRef = useRef(null);
  const drawerRef = useRef(null);
  const drawerCloseRef = useRef(null);

  const records = useMemo(
    () => normalizeSessionHistory(sessionHistory, logicalDayCutoffHour),
    [sessionHistory, logicalDayCutoffHour],
  );

  const visibleRecords = useMemo(
    () => filterCalendarRecords(records, {
      status: statusFilter,
      sessionId: sessionFilter,
    }),
    [records, sessionFilter, statusFilter],
  );

  const recordsByDate = useMemo(() => {
    const grouped = new Map();
    visibleRecords.forEach((record) => {
      const dayRecords = grouped.get(record.logicalDateKey) ?? [];
      dayRecords.push(record);
      grouped.set(record.logicalDateKey, dayRecords);
    });
    return grouped;
  }, [visibleRecords]);

  const monthCells = useMemo(
    () => buildMonthCells(monthCursor.getFullYear(), monthCursor.getMonth()),
    [monthCursor],
  );

  const monthPrefix = `${monthCursor.getFullYear()}-${String(monthCursor.getMonth() + 1).padStart(2, "0")}`;
  const monthSummary = useMemo(
    () => summarizeCalendarMonth(records, monthPrefix),
    [records, monthPrefix],
  );
  const visibleMonthSummary = useMemo(
    () => summarizeCalendarMonth(visibleRecords, monthPrefix),
    [visibleRecords, monthPrefix],
  );
  const monthPatterns = useMemo(
    () => summarizeCalendarPatterns(visibleMonthSummary.records),
    [visibleMonthSummary.records],
  );
  const weekActivity = useMemo(
    () => buildMonthWeekActivity(monthCells, visibleMonthSummary.records),
    [monthCells, visibleMonthSummary.records],
  );
  const maximumWeeklySessions = Math.max(1, ...weekActivity.map((week) => week.sessions));
  const activeWeeks = weekActivity.filter((week) => week.sessions > 0).length;
  const monthDuration = formatMetricDuration(monthSummary.trainingMinutes);
  const selectedRecords = selectedDateKey ? recordsByDate.get(selectedDateKey) ?? [] : [];
  const selectedSummary = summarizeCalendarRecords(selectedRecords);
  const isCurrentMonth = monthPrefix === todayKey.slice(0, 7);
  const canMoveForward = monthPrefix < todayKey.slice(0, 7);
  const hasActiveFilters = statusFilter !== "all" || sessionFilter !== "all";

  const monthLabel = new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(monthCursor);

  useEffect(() => {
    if (!selectedDateKey) return undefined;
    drawerCloseRef.current?.focus();
    const handleDrawerKeys = (event) => {
      if (event.key === "Escape") {
        setSelectedDateKey(null);
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = drawerRef.current?.querySelectorAll(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleDrawerKeys);
    return () => window.removeEventListener("keydown", handleDrawerKeys);
  }, [selectedDateKey]);

  useEffect(() => {
    if (selectedDateKey) return;
    returnFocusRef.current?.focus?.();
    returnFocusRef.current = null;
  }, [selectedDateKey]);

  useEffect(() => {
    if (selectedDateKey && !selectedRecords.length) setSelectedDateKey(null);
  }, [selectedDateKey, selectedRecords.length]);

  function moveMonth(offset) {
    if (offset > 0 && !canMoveForward) return;
    setSelectedDateKey(null);
    setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1, 12, 0, 0, 0));
  }

  function goToToday() {
    const today = getLogicalNow(new Date(), logicalDayCutoffHour);
    setSelectedDateKey(null);
    setMonthCursor(new Date(today.getFullYear(), today.getMonth(), 1, 12, 0, 0, 0));
  }

  function openDay(event, dateKey) {
    returnFocusRef.current = event.currentTarget;
    setSelectedDateKey(dateKey);
  }

  function clearFilters() {
    setStatusFilter("all");
    setSessionFilter("all");
  }

  const typicalVisit = monthPatterns.typicalMinutes
    ? `${monthPatterns.typicalMinutes} min`
    : "Not recorded";
  const leadingSession = monthPatterns.leadingSession.label
    ? `Session ${monthPatterns.leadingSession.label}`
    : monthPatterns.leadingSession.isTied ? "Mixed" : "No sessions";
  const leadingWeekdayDetail = monthPatterns.leadingWeekday.label
    ? `${monthPatterns.leadingWeekday.label} appears most often`
    : monthPatterns.leadingWeekday.isTied ? "No single weekday leads" : "No weekday pattern";

  return (
    <div className="history-calendar-page page-enter">
      <section className="history-calendar-hero" aria-labelledby="training-calendar-title">
        <div className="history-calendar-hero__copy">
          <span className="history-calendar-kicker"><CalendarBlank size={17} weight="fill" /> Training calendar</span>
          <h1 id="training-calendar-title">THE MONTH,<br />REP BY REP.</h1>
          <p>Finished and interrupted sessions live on the day they belong to. Sessions started before {logicalDayCutoffHour} a.m. stay attached to the previous training day.</p>
        </div>
        <div className="history-calendar-hero__score" aria-label={`${monthSummary.sessions} workouts in ${monthLabel}`}>
          <span>{monthLabel}</span>
          <strong>{monthSummary.sessions}</strong>
          <small>{monthSummary.sessions === 1 ? "workout logged" : "workouts logged"}</small>
          <div className="history-calendar-hero__score-footer">
            <span><CheckCircle size={18} weight="fill" /> {monthSummary.completed} finished</span>
            <span>{monthSummary.finishRate}% finish rate</span>
          </div>
        </div>
      </section>

      <section
        className="history-calendar-summary"
        aria-label={`${monthLabel} training summary`}
        key={`summary-${monthPrefix}`}
      >
        <article className="history-calendar-summary-card is-violet">
          <span><CalendarBlank size={17} weight="fill" /> Sessions</span>
          <strong>{monthSummary.sessions}</strong>
          <small>{monthSummary.finishRate}% finish rate</small>
        </article>
        <article className="history-calendar-summary-card is-aqua">
          <span><CheckCircle size={17} weight="fill" /> Completed</span>
          <strong>{monthSummary.completed}</strong>
          <small>{monthSummary.sessions ? `${monthSummary.averageHandled}% handled on average` : "No sessions yet"}</small>
        </article>
        <article className="history-calendar-summary-card is-coral">
          <span><WarningCircle size={17} weight="fill" /> Incomplete</span>
          <strong>{monthSummary.incomplete}</strong>
          <small>{monthSummary.incomplete === 1 ? "session ended early" : "sessions ended early"}</small>
        </article>
        <article className="history-calendar-summary-card is-butter">
          <span><Clock size={17} weight="fill" /> Training time</span>
          <strong>{monthDuration.value}</strong>
          <small>{monthDuration.detail}</small>
        </article>
      </section>

      <section className="history-calendar-card" aria-labelledby="calendar-month-title">
        <header className="history-calendar-toolbar">
          <div>
            <span className="history-calendar-kicker">Month view</span>
            <h2 id="calendar-month-title" aria-live="polite">{monthLabel}</h2>
          </div>
          <div className="history-calendar-controls">
            <button type="button" onClick={() => moveMonth(-1)} aria-label="Show previous month">
              <CaretLeft size={19} weight="bold" />
            </button>
            <button
              className="history-calendar-today"
              type="button"
              onClick={goToToday}
              disabled={isCurrentMonth}
              aria-label={isCurrentMonth ? "Showing current month" : "Jump to current month"}
            >
              {isCurrentMonth ? "Current" : "Go current"}
            </button>
            <button
              type="button"
              onClick={() => moveMonth(1)}
              aria-label={canMoveForward ? "Show next month" : "Current month is the latest available month"}
              disabled={!canMoveForward}
            >
              <CaretRight size={19} weight="bold" />
            </button>
          </div>
        </header>

        <div className="history-calendar-month-stage" key={monthPrefix}>
          <section className="history-calendar-query" aria-labelledby={`calendar-filter-title-${monthPrefix}`}>
            <div className="history-calendar-query__heading">
              <div>
                <span className="history-calendar-kicker"><FunnelSimple size={15} weight="fill" /> Narrow the log</span>
                <h3 id={`calendar-filter-title-${monthPrefix}`}>What do you need to find?</h3>
              </div>
              <p aria-live="polite">
                <strong>{visibleMonthSummary.sessions}</strong> of {monthSummary.sessions} {monthSummary.sessions === 1 ? "session" : "sessions"} shown
              </p>
            </div>

            <div className="history-calendar-query__controls">
              <div className="history-calendar-status-filter" role="group" aria-label="Filter sessions by completion status">
                {[
                  ["all", "All"],
                  ["complete", "Finished"],
                  ["incomplete", "Ended early"],
                ].map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    className={statusFilter === value ? "is-active" : ""}
                    aria-pressed={statusFilter === value}
                    onClick={() => setStatusFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <label className="history-calendar-session-filter">
                <span>Session</span>
                <select value={sessionFilter} onChange={(event) => setSessionFilter(event.target.value)}>
                  <option value="all">Any session</option>
                  {SESSION_IDS.map((sessionId) => (
                    <option value={sessionId} key={sessionId}>Session {sessionId}</option>
                  ))}
                </select>
              </label>

              <button
                className="history-calendar-clear-filters"
                type="button"
                onClick={clearFilters}
                disabled={!hasActiveFilters}
              >
                <ArrowCounterClockwise size={17} weight="bold" />
                Clear
              </button>
            </div>
          </section>

          <section className="history-calendar-readout" aria-label={`${monthLabel} patterns from the shown sessions`}>
            <div>
              <span>Training days</span>
              <strong>{monthPatterns.activeDays}</strong>
              <small>unique dates with a shown session</small>
            </div>
            <div>
              <span>Typical visit</span>
              <strong>{typicalVisit}</strong>
              <small>{monthPatterns.recordedDurationCount ? "median recorded duration" : "duration unavailable"}</small>
            </div>
            <div>
              <span>Most logged</span>
              <strong>{leadingSession}</strong>
              <small>{leadingWeekdayDetail}</small>
            </div>
          </section>

          <section className="history-calendar-activity" aria-labelledby={`calendar-activity-title-${monthPrefix}`}>
            <header>
              <div>
                <span className="history-calendar-kicker">Training pulse</span>
                <h3 id={`calendar-activity-title-${monthPrefix}`}>Weekly activity</h3>
              </div>
              <span>{activeWeeks}/{weekActivity.length} weeks with shown sessions</span>
            </header>
            <div
              className="history-calendar-activity__weeks"
              style={{ "--calendar-week-count": weekActivity.length }}
              role="list"
              aria-label={`${monthLabel} weekly training distribution`}
            >
              {weekActivity.map((week) => {
                const barHeight = week.sessions
                  ? 18 + (week.sessions / maximumWeeklySessions) * 82
                  : 0;
                return (
                  <article
                    className={week.sessions ? "has-activity" : ""}
                    key={week.id}
                    role="listitem"
                    aria-label={`${week.label}, days ${formatWeekRange(week)}: ${week.sessions} sessions, ${week.completed} completed, ${week.trainingMinutes} minutes`}
                  >
                    <div className="history-calendar-activity__week-label">
                      <strong>{week.shortLabel}</strong>
                      <span>{formatWeekRange(week)}</span>
                    </div>
                    <div className="history-calendar-activity__track" aria-hidden="true">
                      <i style={{ "--activity-height": `${barHeight}%` }} />
                    </div>
                    <strong className="history-calendar-activity__count">{week.sessions}</strong>
                    <footer>
                      <span aria-hidden="true">
                        {week.sessionIds.slice(0, 4).map((sessionId, index) => (
                          <i className={`history-session-${sessionId.toLowerCase()}`} key={`${week.id}-${sessionId}-${index}`} />
                        ))}
                      </span>
                      <small>{week.trainingMinutes ? `${week.trainingMinutes} min` : "No sessions"}</small>
                    </footer>
                  </article>
                );
              })}
            </div>
          </section>

          <div className="history-calendar-legend" aria-label="Session color key">
            {SESSION_IDS.map((sessionId) => (
              <span key={sessionId}><i className={`history-session-${sessionId.toLowerCase()}`} /> Session {sessionId}</span>
            ))}
            <span><i className="history-session-incomplete" /> Incomplete</span>
          </div>

          <div className="history-calendar-weekdays" aria-hidden="true">
            {weekdayLabels.map((label) => <span key={label}>{label}</span>)}
          </div>

          <div className="history-calendar-grid">
            {monthCells.map((cell) => {
              const dayRecords = recordsByDate.get(cell.dateKey) ?? [];
              const hasIncomplete = dayRecords.some((record) => !record.isComplete);
              const isSelected = selectedDateKey === cell.dateKey;
              const content = (
                <>
                  <span className="history-calendar-day-number">{cell.dayNumber}</span>
                  <span className="history-calendar-session-stack" aria-hidden="true">
                    {dayRecords.slice(0, 3).map((record) => (
                      <i
                        key={record.recordKey}
                        className={`history-session-${record.sessionId.toLowerCase()} ${record.isComplete ? "" : "is-incomplete"}`}
                      >
                        {record.sessionId}
                      </i>
                    ))}
                    {dayRecords.length > 3 && <b>+{dayRecords.length - 3}</b>}
                  </span>
                  {hasIncomplete && <WarningCircle className="history-calendar-warning" size={14} weight="fill" aria-hidden="true" />}
                </>
              );
              const dayClassName = [
                "history-calendar-day",
                cell.isCurrentMonth ? "" : "is-outside",
                cell.dateKey === todayKey ? "is-today" : "",
                isSelected ? "is-selected" : "",
              ].filter(Boolean).join(" ");

              if (!dayRecords.length) {
                return (
                  <div
                    className={dayClassName}
                    key={cell.dateKey}
                    aria-label={dayAriaLabel(cell, dayRecords)}
                    aria-current={cell.dateKey === todayKey ? "date" : undefined}
                  >
                    {content}
                  </div>
                );
              }

              return (
                <button
                  type="button"
                  className={`${dayClassName} has-session`}
                  key={cell.dateKey}
                  aria-label={`${dayAriaLabel(cell, dayRecords)}. Open details.`}
                  aria-current={cell.dateKey === todayKey ? "date" : undefined}
                  aria-expanded={isSelected}
                  aria-controls="history-calendar-day-drawer"
                  onClick={(event) => openDay(event, cell.dateKey)}
                >
                  {content}
                </button>
              );
            })}
          </div>

          {!monthSummary.sessions && (
            <div className="history-calendar-empty" role="status">
              <CalendarBlank size={24} />
              <div><strong>No sessions in this month.</strong><span>Finished or ended workouts will appear here automatically.</span></div>
            </div>
          )}

          {monthSummary.sessions > 0 && !visibleMonthSummary.sessions && (
            <div className="history-calendar-empty is-filtered" role="status">
              <FunnelSimple size={24} />
              <div><strong>No sessions match these filters.</strong><span>Change a filter or show the full month again.</span></div>
              <button type="button" onClick={clearFilters}>Show all</button>
            </div>
          )}

          <div className="history-calendar-rollover">
            <MoonStars size={19} weight="fill" />
            <span><strong>Late-night rule:</strong> a session started before {logicalDayCutoffHour} a.m. belongs to the previous calendar square.</span>
          </div>
        </div>
      </section>

      {selectedDateKey && (
        <div className="history-calendar-drawer-backdrop" role="presentation" onMouseDown={() => setSelectedDateKey(null)}>
          <section
            id="history-calendar-day-drawer"
            ref={drawerRef}
            className="history-calendar-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-calendar-drawer-title"
            aria-describedby="history-calendar-drawer-note"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span className="history-calendar-kicker">Training day · {selectedSummary.sessions} {selectedSummary.sessions === 1 ? "session" : "sessions"}</span>
                <h2 id="history-calendar-drawer-title">{formatFullDate(selectedDateKey)}</h2>
              </div>
              <button ref={drawerCloseRef} type="button" onClick={() => setSelectedDateKey(null)} aria-label="Close training-day details">
                <X size={21} />
              </button>
            </header>

            <div className="history-calendar-drawer__summary" aria-label="Selected day summary">
              <span><strong>{selectedSummary.completed}</strong><small>finished</small></span>
              <span><strong>{selectedSummary.averageHandled}%</strong><small>handled</small></span>
              <span><strong>{selectedSummary.trainingMinutes}</strong><small>minutes</small></span>
            </div>

            <div className="history-calendar-drawer__records">
              {selectedRecords.map((record, index) => {
                const content = (
                  <>
                    <span className={`history-calendar-record__letter history-session-${record.sessionId.toLowerCase()}`}>{record.sessionId}</span>
                    <span className="history-calendar-record__copy">
                      <small>{record.isComplete ? "Completed" : "Incomplete session"}</small>
                      <strong>Session {record.sessionId}</strong>
                      <span><Clock size={15} /> {formatDuration(record.durationMinutes)}</span>
                    </span>
                    <span className="history-calendar-record__completion">
                      <strong>{record.completionPercent}%</strong>
                      <small>handled</small>
                    </span>
                  </>
                );

                return onRecordSelect ? (
                  <button
                    type="button"
                    className={`history-calendar-record ${record.isComplete ? "" : "is-incomplete"}`}
                    key={record.recordKey}
                    style={{ "--record-order": Math.min(index, 5) }}
                    onClick={() => onRecordSelect(record)}
                    aria-label={`Open Session ${record.sessionId} from ${formatFullDate(record.logicalDateKey)}`}
                  >
                    {content}
                  </button>
                ) : (
                  <article
                    className={`history-calendar-record ${record.isComplete ? "" : "is-incomplete"}`}
                    key={record.recordKey}
                    style={{ "--record-order": Math.min(index, 5) }}
                  >
                    {content}
                  </article>
                );
              })}
            </div>

            <p id="history-calendar-drawer-note" className="history-calendar-drawer__note">The calendar reports completion and time only. It does not infer load, rep, or strength improvement.</p>
          </section>
        </div>
      )}
    </div>
  );
}
