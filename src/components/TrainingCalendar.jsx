import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarBlank,
  CaretLeft,
  CaretRight,
  CheckCircle,
  Clock,
  MoonStars,
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
  const returnFocusRef = useRef(null);
  const drawerRef = useRef(null);
  const drawerCloseRef = useRef(null);

  const records = useMemo(
    () => normalizeSessionHistory(sessionHistory, logicalDayCutoffHour),
    [sessionHistory, logicalDayCutoffHour],
  );

  const recordsByDate = useMemo(() => {
    const grouped = new Map();
    records.forEach((record) => {
      const dayRecords = grouped.get(record.logicalDateKey) ?? [];
      dayRecords.push(record);
      grouped.set(record.logicalDateKey, dayRecords);
    });
    return grouped;
  }, [records]);

  const monthCells = useMemo(
    () => buildMonthCells(monthCursor.getFullYear(), monthCursor.getMonth()),
    [monthCursor],
  );

  const monthPrefix = `${monthCursor.getFullYear()}-${String(monthCursor.getMonth() + 1).padStart(2, "0")}`;
  const monthRecords = records.filter((record) => record.logicalDateKey.startsWith(monthPrefix));
  const completedThisMonth = monthRecords.filter((record) => record.isComplete).length;
  const selectedRecords = selectedDateKey ? recordsByDate.get(selectedDateKey) ?? [] : [];

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

  function moveMonth(offset) {
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

  return (
    <div className="history-calendar-page page-enter">
      <section className="history-calendar-hero" aria-labelledby="training-calendar-title">
        <div className="history-calendar-hero__copy">
          <span className="history-calendar-kicker"><CalendarBlank size={17} weight="fill" /> Training calendar</span>
          <h1 id="training-calendar-title">THE MONTH,<br />REP BY REP.</h1>
          <p>Finished and interrupted sessions live on the day they belong to. Sessions started before {logicalDayCutoffHour} a.m. stay attached to the previous training day.</p>
        </div>
        <div className="history-calendar-hero__score" aria-label={`${monthRecords.length} workouts in ${monthLabel}`}>
          <span>{monthLabel}</span>
          <strong>{monthRecords.length}</strong>
          <small>{monthRecords.length === 1 ? "workout logged" : "workouts logged"}</small>
          <div><CheckCircle size={18} weight="fill" /> {completedThisMonth} completed</div>
        </div>
      </section>

      <section className="history-calendar-card" aria-labelledby="calendar-month-title">
        <header className="history-calendar-toolbar">
          <div>
            <span className="history-calendar-kicker">Month view</span>
            <h2 id="calendar-month-title">{monthLabel}</h2>
          </div>
          <div className="history-calendar-controls">
            <button type="button" onClick={() => moveMonth(-1)} aria-label="Show previous month">
              <CaretLeft size={19} weight="bold" />
            </button>
            <button className="history-calendar-today" type="button" onClick={goToToday}>Today</button>
            <button type="button" onClick={() => moveMonth(1)} aria-label="Show next month">
              <CaretRight size={19} weight="bold" />
            </button>
          </div>
        </header>

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

            if (!dayRecords.length) {
              return (
                <div
                  className={`history-calendar-day ${cell.isCurrentMonth ? "" : "is-outside"} ${cell.dateKey === todayKey ? "is-today" : ""}`}
                  key={cell.dateKey}
                  aria-label={dayAriaLabel(cell, dayRecords)}
                >
                  {content}
                </div>
              );
            }

            return (
              <button
                type="button"
                className={`history-calendar-day has-session ${cell.isCurrentMonth ? "" : "is-outside"} ${cell.dateKey === todayKey ? "is-today" : ""}`}
                key={cell.dateKey}
                aria-label={dayAriaLabel(cell, dayRecords)}
                onClick={(event) => openDay(event, cell.dateKey)}
              >
                {content}
              </button>
            );
          })}
        </div>

        {!monthRecords.length && (
          <div className="history-calendar-empty" role="status">
            <CalendarBlank size={24} />
            <div><strong>No sessions in this month.</strong><span>Finished workouts will appear here automatically.</span></div>
          </div>
        )}

        <div className="history-calendar-rollover">
          <MoonStars size={19} weight="fill" />
          <span><strong>Late-night rule:</strong> a session started before {logicalDayCutoffHour} a.m. belongs to the previous calendar square.</span>
        </div>
      </section>

      {selectedDateKey && (
        <div className="history-calendar-drawer-backdrop" role="presentation" onMouseDown={() => setSelectedDateKey(null)}>
          <section
            ref={drawerRef}
            className="history-calendar-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-calendar-drawer-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span className="history-calendar-kicker">Training day</span>
                <h2 id="history-calendar-drawer-title">{formatFullDate(selectedDateKey)}</h2>
              </div>
              <button ref={drawerCloseRef} type="button" onClick={() => setSelectedDateKey(null)} aria-label="Close training-day details">
                <X size={21} />
              </button>
            </header>

            <div className="history-calendar-drawer__records">
              {selectedRecords.map((record) => {
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
                    onClick={() => onRecordSelect(record)}
                  >
                    {content}
                  </button>
                ) : (
                  <article className={`history-calendar-record ${record.isComplete ? "" : "is-incomplete"}`} key={record.recordKey}>
                    {content}
                  </article>
                );
              })}
            </div>

            <p className="history-calendar-drawer__note">The calendar reports completion and time only. It does not infer load, rep, or strength improvement.</p>
          </section>
        </div>
      )}
    </div>
  );
}
