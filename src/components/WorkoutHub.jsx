import {
  ArrowRight,
  Barbell,
  CheckCircle,
  ClockCountdown,
  Lightning,
  Play,
  ShieldCheck,
  Target,
  WarningCircle,
} from "@phosphor-icons/react";
import { sessions } from "../data.js";
import { InlineSpinner } from "./InlineSpinner.jsx";

const weeklyModes = [
  { days: "3 days", sequence: "A · B · C", detail: "Foundation only" },
  { days: "4 days", sequence: "A · B · C · D", detail: "D needs 48 h after C" },
  { days: "5 days", sequence: "A · B · C · E · D", detail: "E stays easy" },
];

export function WorkoutHub({
  selectedSessionId,
  activeSession,
  logicalDaySession,
  busy,
  startBusy,
  error,
  onSelectSession,
  onStartSession,
  onContinueSession,
}) {
  const selected = sessions.find((session) => session.id === selectedSessionId) ?? sessions[0];
  const totalSets = selected.exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
  const dayAlreadyUsed = Boolean(logicalDaySession && !activeSession);
  const startsWorkout = !activeSession && !dayAlreadyUsed;
  const primaryDisabled = dayAlreadyUsed || (startsWorkout && busy);

  const primaryLabel = activeSession
    ? `Continue Session ${activeSession.templateId}`
    : dayAlreadyUsed
      ? "Today's workout is logged"
      : `Start Session ${selected.id}`;

  function primaryAction() {
    if (activeSession) return onContinueSession();
    if (!dayAlreadyUsed) return onStartSession(selected.id);
    return undefined;
  }

  return (
    <div className="workout-page page-enter">
      <section className={`workout-hero tone-bg-${selected.tone}`}>
        <div className="hero-copy">
          <div className="eyebrow dark-ink">
            <Target size={18} weight="fill" />
            Selected workout · Session {selected.id}
          </div>
          <h1>FOLLOW THE ORDER.<br />OWN THE REPS.</h1>
          <p>{selected.summary}</p>
          <div className="hero-actions">
            <button
              className="primary-action dark-action"
              onClick={primaryAction}
              disabled={primaryDisabled}
              aria-disabled={primaryDisabled}
              aria-busy={startBusy}
            >
              {startBusy ? <InlineSpinner /> : <Play size={20} weight="fill" />}
              {startBusy ? "Starting session…" : primaryLabel}
            </button>
            <a className="text-action" href="#exercise-index">
              Preview exercises <ArrowRight size={18} />
            </a>
          </div>
          {error && <div className="workout-start-error" role="alert"><WarningCircle size={18} weight="fill" /> {error}</div>}
          <div className="hero-stats" aria-label="Selected workout overview">
            <div>
              <strong>{selected.exercises.length}</strong>
              <span>movements</span>
            </div>
            <div>
              <strong>{totalSets}</strong>
              <span>working sets</span>
            </div>
            <div>
              <strong>{selected.duration}</strong>
              <span>including cardio</span>
            </div>
          </div>
        </div>
        <div className="hero-image-wrap">
          <img src={selected.image} alt="Illustrated examples of exercises in the selected workout" />
          <div className="image-caption">
            <span>Visual overview</span>
            <strong>Written cues decide your form</strong>
          </div>
        </div>
      </section>

      <section className="session-picker" aria-labelledby="session-picker-title">
        <div className="section-heading-row">
          <div>
            <span className="section-kicker">Choose your session</span>
            <h2 id="session-picker-title">THE FIVE-SESSION SYSTEM</h2>
          </div>
          <p>A, B and C are the foundation. D and E are earned with recovery—not squeezed in.</p>
        </div>

        <div className="session-card-grid">
          {sessions.map((session) => (
            <button
              className={`session-card tone-bg-${session.tone} ${selected.id === session.id ? "is-selected" : ""}`}
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              aria-pressed={selected.id === session.id}
            >
              <span className="session-letter">{session.id}</span>
              <span className="session-card-copy">
                <small>{session.subtitle}</small>
                <strong>{session.shortTitle}</strong>
                <span>{session.exercises.length} movements · {session.duration}</span>
              </span>
              <span className="round-arrow"><ArrowRight size={18} /></span>
            </button>
          ))}
        </div>
      </section>

      <section className="workout-mosaic" id="exercise-index">
        <article className="index-panel dark-panel">
          <div className="panel-title-row">
            <div>
              <span className="section-kicker light-kicker">Session {selected.id}</span>
              <h2>EXERCISE INDEX</h2>
            </div>
            <button
              className="compact-start"
              onClick={primaryAction}
              disabled={primaryDisabled}
              aria-disabled={primaryDisabled}
              aria-busy={startBusy}
            >
              {startBusy ? <InlineSpinner size="sm" /> : <Play size={18} weight="fill" />}
              {startBusy ? "Starting…" : activeSession ? "Continue" : dayAlreadyUsed ? "Logged" : "Start"}
            </button>
          </div>
          <div className="exercise-index-list">
            {selected.exercises.map((exercise, index) => (
              <div className="exercise-index-row" key={exercise.id}>
                <span className="index-number">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{exercise.name}</strong>
                  <span>{exercise.sets === 1 ? "1 block" : `${exercise.sets} sets`} · {exercise.reps}</span>
                </div>
                <span className="rest-label">{exercise.rest > 0 ? `${exercise.rest}s rest` : "continuous"}</span>
              </div>
            ))}
          </div>
        </article>

        <aside className="side-stack">
          <article className="info-card tone-bg-butter">
            <div className="card-icon"><ClockCountdown size={24} weight="fill" /></div>
            <span className="section-kicker">Bad week?</span>
            <h3>KEEP A → B → C</h3>
            <p>If a visit is missed, continue with the next letter. Never stack missed sessions or add punishment sets.</p>
          </article>

          <article className="info-card tone-bg-aqua">
            <div className="card-icon"><ShieldCheck size={24} weight="fill" /></div>
            <span className="section-kicker">Effort rule</span>
            <h3>LEAVE 2–4 CLEAN REPS</h3>
            <p>Failure is not required. Pain changes the exercise; ordinary muscle effort does not.</p>
          </article>

          <article className="info-card tone-bg-sage">
            <div className="card-icon"><WarningCircle size={24} weight="fill" /></div>
            <span className="section-kicker">Running gate</span>
            <h3>SHIN PAIN MEANS WALK</h3>
            <p>Run only after normal walking and a brisk 30-minute walk are pain-free. Restart with short walk-run intervals; seek assessment for focal bone tenderness, swelling, limping or rest/night pain.</p>
          </article>
        </aside>
      </section>

      <section className="weekly-modes" aria-labelledby="weekly-title">
        <div className="mode-intro">
          <div className="card-icon light-icon"><Barbell size={25} weight="fill" /></div>
          <span className="section-kicker light-kicker">Attendance adapts</span>
          <h2 id="weekly-title">ONE PLAN.<br />THREE WEEK TYPES.</h2>
          <p>Your muscles do not disappear because a week became busy. The sequence stays intact.</p>
        </div>
        <div className="mode-list">
          {weeklyModes.map((mode) => (
            <div className="mode-row" key={mode.days}>
              <div className="mode-check"><CheckCircle size={22} weight="fill" /></div>
              <div>
                <strong>{mode.days}</strong>
                <span>{mode.detail}</span>
              </div>
              <code>{mode.sequence}</code>
            </div>
          ))}
        </div>
        <div className="mode-badge">
          <Lightning size={22} weight="fill" />
          Week 1–2: A, B and C only. Easy E is optional.
        </div>
      </section>
    </div>
  );
}
