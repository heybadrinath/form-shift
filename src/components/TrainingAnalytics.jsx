import { useMemo, useState } from "react";
import {
  Barbell,
  ChartBar,
  CheckCircle,
  Clock,
  PencilSimple,
  Plus,
  Scales,
  Timer,
  TrendDown,
  TrendUp,
  X,
} from "@phosphor-icons/react";
import {
  dateFromKey,
  getLogicalNow,
  getWeekRange,
  MAX_BODY_WEIGHT_KG,
  MIN_BODY_WEIGHT_KG,
  normalizeWeightEntries,
  SESSION_IDS,
  summarizeTraining,
  toLocalDateKey,
} from "./historyUtils.js";
import "./TrainingAnalytics.css";

function formatDuration(minutes) {
  if (!minutes) return "0 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} h ${remainder} min` : `${hours} h`;
}

function formatShortDate(dateKey, includeYear = false) {
  const date = dateFromKey(dateKey);
  if (!date) return dateKey;
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: includeYear ? "numeric" : undefined,
  }).format(date);
}

function sessionStatus(record) {
  return record.isComplete ? "Complete" : `${record.completionPercent}% handled`;
}

function weightChartLabel(entries) {
  if (!entries.length) return "No weight entries yet.";
  if (entries.length === 1) return `One weight entry: ${entries[0].weightKg.toFixed(1)} kilograms.`;
  const first = entries[0];
  const last = entries.at(-1);
  const change = last.weightKg - first.weightKg;
  const direction = change === 0 ? "unchanged" : change > 0 ? `up ${Math.abs(change).toFixed(1)}` : `down ${Math.abs(change).toFixed(1)}`;
  return `${entries.length} weight entries from ${formatShortDate(first.dateKey, true)} to ${formatShortDate(last.dateKey, true)}. Weight is ${direction} kilograms across the shown entries.`;
}

export function TrainingAnalytics({
  sessionHistory = [],
  weightEntries = [],
  onAddWeight,
  onEditWeight,
  logicalDayCutoffHour = 4,
}) {
  const todayKey = toLocalDateKey(getLogicalNow(new Date(), logicalDayCutoffHour));
  const [weightDate, setWeightDate] = useState(todayKey);
  const [weightValue, setWeightValue] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [formMessage, setFormMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const summary = useMemo(
    () => summarizeTraining(sessionHistory, new Date(), logicalDayCutoffHour),
    [sessionHistory, logicalDayCutoffHour],
  );
  const weights = useMemo(
    () => normalizeWeightEntries(weightEntries, logicalDayCutoffHour),
    [weightEntries, logicalDayCutoffHour],
  );
  const chartWeights = weights.slice(-10);

  const mixTotal = Object.values(summary.sessionMix).reduce((sum, count) => sum + count, 0);
  const mixMaximum = Math.max(1, ...Object.values(summary.sessionMix));
  const latestWeight = weights.at(-1);
  const firstChartWeight = chartWeights[0];
  const chartChange = latestWeight && firstChartWeight ? latestWeight.weightKg - firstChartWeight.weightKg : 0;
  const chartMinimum = chartWeights.length ? Math.min(...chartWeights.map((entry) => entry.weightKg)) : 0;
  const chartMaximum = chartWeights.length ? Math.max(...chartWeights.map((entry) => entry.weightKg)) : 0;
  const chartRange = Math.max(1, chartMaximum - chartMinimum);
  const { startKey } = getWeekRange(new Date(), logicalDayCutoffHour);
  const weekStart = dateFromKey(startKey);
  const weeklyCounts = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    const dateKey = toLocalDateKey(date);
    return {
      dateKey,
      label: new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date).slice(0, 2),
      count: summary.thisWeek.filter((record) => record.logicalDateKey === dateKey).length,
    };
  });

  function resetWeightForm() {
    setEditingId(null);
    setWeightDate(todayKey);
    setWeightValue("");
    setFormMessage("");
  }

  function editWeight(entry) {
    setEditingId(entry.entryKey);
    setWeightDate(entry.dateKey);
    setWeightValue(entry.weightKg.toFixed(1));
    setFormMessage("");
  }

  async function submitWeight(event) {
    event.preventDefault();
    const parsedWeight = Number(weightValue);
    if (!weightDate || !Number.isFinite(parsedWeight) || parsedWeight < MIN_BODY_WEIGHT_KG || parsedWeight > MAX_BODY_WEIGHT_KG) {
      setFormMessage(`Enter a date and a body weight between ${MIN_BODY_WEIGHT_KG} and ${MAX_BODY_WEIGHT_KG} kg.`);
      return;
    }

    const handler = editingId ? onEditWeight : onAddWeight;
    if (typeof handler !== "function") {
      setFormMessage("Weight editing is not connected on this screen yet.");
      return;
    }

    setSubmitting(true);
    setFormMessage("");
    try {
      if (editingId) {
        await handler(editingId, { date: weightDate, weightKg: parsedWeight });
      } else {
        await handler({ date: weightDate, weightKg: parsedWeight });
      }
      resetWeightForm();
    } catch {
      setFormMessage("The entry was not updated. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="training-analytics-page page-enter">
      <section className="training-analytics-hero" aria-labelledby="training-analytics-title">
        <div>
          <span className="training-analytics-kicker"><ChartBar size={17} weight="fill" /> Training signals</span>
          <h1 id="training-analytics-title">SHOW THE WORK.<br />SKIP THE HYPE.</h1>
          <p>Frequency, time and completion describe what happened. They do not pretend that untracked loads or reps improved.</p>
        </div>
        <div className="training-analytics-week">
          <div className="training-analytics-week__heading">
            <span>This week</span>
            <strong>{summary.weeklyFrequency} sessions</strong>
          </div>
          <div className="training-analytics-week__days" aria-label="Workout frequency by day this week">
            {weeklyCounts.map((day) => (
              <div className={day.count ? "has-workout" : ""} key={day.dateKey}>
                <span>{day.label}</span>
                <strong>{day.count || "·"}</strong>
              </div>
            ))}
          </div>
          <small>Training days roll over at {logicalDayCutoffHour} a.m.</small>
        </div>
      </section>

      <section className="training-analytics-metrics" aria-label="This week's training summary">
        <article className="training-analytics-metric tone-bg-coral">
          <Barbell size={25} weight="fill" />
          <span>Weekly frequency</span>
          <strong>{summary.weeklyFrequency}</strong>
          <small>{summary.weeklyFrequency === 1 ? "session" : "sessions"} since Monday</small>
        </article>
        <article className="training-analytics-metric tone-bg-butter">
          <Timer size={25} weight="fill" />
          <span>Training duration</span>
          <strong>{summary.durationMinutes}</strong>
          <small>minutes recorded this week</small>
        </article>
        <article className="training-analytics-metric tone-bg-aqua">
          <CheckCircle size={25} weight="fill" />
          <span>Average completion</span>
          <strong>{summary.averageCompletion}%</strong>
          <small>across this week's sessions</small>
        </article>
      </section>

      <div className="training-analytics-mosaic">
        <section className="training-analytics-panel training-analytics-weight-panel" aria-labelledby="weight-trend-title">
          <header className="training-analytics-panel__header">
            <div>
              <span className="training-analytics-kicker">Body-weight log</span>
              <h2 id="weight-trend-title">WEIGHT TREND</h2>
            </div>
            {latestWeight ? (
              <div className="training-analytics-latest-weight">
                <Scales size={18} weight="fill" />
                <span><strong>{latestWeight.weightKg.toFixed(1)}</strong> kg</span>
              </div>
            ) : null}
          </header>

          {chartWeights.length ? (
            <>
              <div className="training-analytics-weight-summary">
                <span>Last {chartWeights.length} entries</span>
                <strong className={chartChange < 0 ? "is-down" : chartChange > 0 ? "is-up" : ""}>
                  {chartChange < 0 ? <TrendDown size={19} weight="bold" /> : <TrendUp size={19} weight="bold" />}
                  {chartChange > 0 ? "+" : ""}{chartChange.toFixed(1)} kg
                </strong>
              </div>
              <div className="training-analytics-weight-chart" role="group" aria-label={weightChartLabel(chartWeights)}>
                <span className="training-analytics-scale-max">{chartMaximum.toFixed(1)}</span>
                <div
                  className="training-analytics-weight-bars"
                  style={{ "--weight-entry-count": chartWeights.length }}
                >
                  {chartWeights.map((entry) => {
                    const height = 18 + ((entry.weightKg - chartMinimum) / chartRange) * 72;
                    return (
                      <button
                        type="button"
                        className="training-analytics-weight-bar"
                        style={{ "--weight-height": `${height}%` }}
                        key={entry.entryKey}
                        onClick={() => editWeight(entry)}
                        disabled={submitting}
                        aria-label={`${entry.weightKg.toFixed(1)} kilograms on ${formatShortDate(entry.dateKey, true)}. Edit entry.`}
                      >
                        <i aria-hidden="true" />
                        <span>{formatShortDate(entry.dateKey)}</span>
                      </button>
                    );
                  })}
                </div>
                <span className="training-analytics-scale-min">{chartMinimum.toFixed(1)}</span>
              </div>
            </>
          ) : (
            <div className="training-analytics-empty">
              <Scales size={26} />
              <div><strong>No weight entries yet.</strong><span>Add an occasional morning measurement to reveal the trend.</span></div>
            </div>
          )}

          <form className="training-analytics-weight-form" onSubmit={submitWeight} aria-busy={submitting}>
            <div className="training-analytics-weight-form__title">
              <span>{editingId ? "Edit measurement" : "Add measurement"}</span>
              {editingId && <button type="button" onClick={resetWeightForm} disabled={submitting} aria-label="Cancel editing weight"><X size={16} /></button>}
            </div>
            <label>
              <span>Date</span>
              <input
                type="date"
                value={weightDate}
                max={todayKey}
                onChange={(event) => setWeightDate(event.target.value)}
                aria-describedby="training-weight-form-message"
                disabled={submitting}
                required
              />
            </label>
            <label>
              <span>Weight</span>
              <span className="training-analytics-weight-input">
                <input
                  type="number"
                  inputMode="decimal"
                  min={MIN_BODY_WEIGHT_KG}
                  max={MAX_BODY_WEIGHT_KG}
                  step="0.1"
                  placeholder="73.5"
                  value={weightValue}
                  onChange={(event) => setWeightValue(event.target.value)}
                  aria-describedby="training-weight-form-message"
                  disabled={submitting}
                  required
                />
                <b>kg</b>
              </span>
            </label>
            <button className="training-analytics-save-weight" type="submit" disabled={submitting}>
              {editingId ? <PencilSimple size={18} weight="bold" /> : <Plus size={18} weight="bold" />}
              {submitting ? "Saving…" : editingId ? "Save change" : "Add weight"}
            </button>
            <p id="training-weight-form-message" className="training-analytics-form-message" aria-live="polite">{formMessage}</p>
          </form>

          {weights.length > 0 && (
            <div className="training-analytics-weight-list" aria-label="Recent weight measurements">
              {weights.slice(-4).reverse().map((entry) => (
                <button type="button" key={entry.entryKey} onClick={() => editWeight(entry)} disabled={submitting}>
                  <span>{formatShortDate(entry.dateKey, true)}</span>
                  <strong>{entry.weightKg.toFixed(1)} kg</strong>
                  <PencilSimple size={16} aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="training-analytics-panel training-analytics-mix-panel" aria-labelledby="session-mix-title">
          <header className="training-analytics-panel__header">
            <div>
              <span className="training-analytics-kicker">All logged workouts</span>
              <h2 id="session-mix-title">SESSION MIX</h2>
            </div>
            <span className="training-analytics-total">{mixTotal} total</span>
          </header>
          {mixTotal ? (
            <div className="training-analytics-mix-list">
              {SESSION_IDS.map((sessionId) => {
                const count = summary.sessionMix[sessionId];
                const width = count ? Math.max(12, (count / mixMaximum) * 100) : 0;
                return (
                  <div className="training-analytics-mix-row" key={sessionId}>
                    <span className={`training-analytics-session-letter history-session-${sessionId.toLowerCase()}`}>{sessionId}</span>
                    <div>
                      <span><strong>Session {sessionId}</strong><small>{count} logged</small></span>
                      <div className="training-analytics-mix-track" aria-label={`Session ${sessionId}: ${count} workouts`}>
                        <i className={`history-session-${sessionId.toLowerCase()}`} style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="training-analytics-empty is-dark">
              <Barbell size={26} />
              <div><strong>No workout mix yet.</strong><span>Complete a session to populate this panel.</span></div>
            </div>
          )}
          <p className="training-analytics-method-note">This shows what you chose—not whether one session is better than another.</p>
        </section>

        <section className="training-analytics-panel training-analytics-recent-panel" aria-labelledby="recent-training-title">
          <header className="training-analytics-panel__header">
            <div>
              <span className="training-analytics-kicker">Newest first</span>
              <h2 id="recent-training-title">RECENT HISTORY</h2>
            </div>
            <Clock size={24} weight="fill" />
          </header>
          {summary.recent.length ? (
            <div className="training-analytics-recent-list">
              {summary.recent.map((record) => (
                <article className={record.isComplete ? "" : "is-incomplete"} key={record.recordKey}>
                  <span className={`training-analytics-session-letter history-session-${record.sessionId.toLowerCase()}`}>{record.sessionId}</span>
                  <div>
                    <strong>Session {record.sessionId}</strong>
                    <span>{formatShortDate(record.logicalDateKey, true)} · {formatDuration(record.durationMinutes)}</span>
                  </div>
                  <small>{sessionStatus(record)}</small>
                </article>
              ))}
            </div>
          ) : (
            <div className="training-analytics-empty">
              <Clock size={26} />
              <div><strong>No session history yet.</strong><span>Your first finished or interrupted workout will appear here.</span></div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
