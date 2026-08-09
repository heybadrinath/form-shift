import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowsOut,
  Barbell,
  Check,
  CheckCircle,
  Clock,
  Info,
  SkipForward,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { guideForExercise } from "../exerciseLibrary.js";
import { InlineSpinner } from "./InlineSpinner.jsx";
import "./session-runner.css";

function formatElapsed(startedAt, now) {
  const milliseconds = Math.max(0, now - new Date(startedAt).getTime());
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function exerciseState(record, exercise) {
  const progress = record?.exercises?.find((item) => item.exerciseId === exercise.id);
  const completedSets = new Set(
    (progress?.sets ?? [])
      .filter((set) => Boolean(set.completedAt))
      .map((set) => Number(set.setNumber)),
  );

  return {
    completedSets,
    completedAt: progress?.completedAt ?? null,
    skippedAt: progress?.skippedAt ?? null,
    selectedVariantId: progress?.selectedVariantId ?? progress?.selectedVariant ?? null,
  };
}

function nextOpenIndex(session, record, currentIndex, handledExerciseId = null) {
  const candidates = session.exercises
    .map((exercise, index) => ({
      exercise,
      index,
      state: exerciseState(record, exercise),
    }))
    .filter(({ exercise }) => exercise.id !== handledExerciseId)
    .filter(({ state }) => !state.completedAt && !state.skippedAt);
  return candidates.find(({ index }) => index > currentIndex)?.index
    ?? candidates[0]?.index
    ?? currentIndex;
}

export function SessionRunner({
  session,
  record,
  mutationKey,
  error,
  onBack,
  onToggleSet,
  onSelectVariant,
  onSkipExercise,
  onFinish,
  onEndIncomplete,
}) {
  const [currentIndex, setCurrentIndex] = useState(() => nextOpenIndex(session, record, -1));
  const [now, setNow] = useState(Date.now());
  const [expandedImage, setExpandedImage] = useState(false);
  const [showFinish, setShowFinish] = useState(false);
  const [showEndIncomplete, setShowEndIncomplete] = useState(false);
  const [weight, setWeight] = useState("");
  const busy = Boolean(mutationKey);
  const skipBusy = mutationKey === `skip:${session.exercises[currentIndex].id}`;
  const finishBusy = mutationKey === "finish";
  const endIncompleteBusy = mutationKey === "end-incomplete";

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      setExpandedImage(false);
      if (busy) return;
      setShowFinish(false);
      setShowEndIncomplete(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [busy]);

  const currentExercise = session.exercises[currentIndex];
  const currentState = exerciseState(record, currentExercise);
  const guide = guideForExercise(currentExercise);
  const selectedVariant = guide.variants.find((variant) => variant.id === currentState.selectedVariantId)
    ?? guide.variants[0];

  const handledCount = useMemo(
    () => session.exercises.filter((exercise) => {
      const state = exerciseState(record, exercise);
      return Boolean(state.completedAt || state.skippedAt);
    }).length,
    [record, session.exercises],
  );
  const skippedCount = session.exercises.filter((exercise) => exerciseState(record, exercise).skippedAt).length;
  const progress = Math.round((handledCount / session.exercises.length) * 100);
  const allHandled = handledCount === session.exercises.length;

  async function toggleSet(setNumber) {
    const wasCompleted = currentState.completedSets.has(setNumber);
    const started = await onToggleSet(currentExercise.id, setNumber, !wasCompleted);
    if (!started) return;
    if (!wasCompleted && currentState.completedSets.size + 1 >= currentExercise.sets) {
      window.setTimeout(() => setCurrentIndex((index) => (
        nextOpenIndex(session, record, index, currentExercise.id)
      )), 280);
    }
  }

  async function skipCurrent() {
    const wasSkipped = Boolean(currentState.skippedAt);
    const started = await onSkipExercise(currentExercise.id);
    if (!started) return;
    if (!wasSkipped) {
      setCurrentIndex((index) => nextOpenIndex(session, record, index, currentExercise.id));
    }
  }

  async function finishSession() {
    const parsed = weight.trim() === "" ? null : Number(weight);
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 30 || parsed > 250)) return;
    const started = await onFinish(parsed);
    if (!started) return;
    setShowFinish(false);
  }

  return (
    <div className="session-v2 page-enter">
      <header className="session-v2__topbar">
        <button className="session-v2__icon-button" onClick={onBack} aria-label="Leave session open and go back">
          <ArrowLeft size={21} />
        </button>
        <div className="session-v2__identity">
          <span>Session {session.id} · active</span>
          <strong>{session.shortTitle}</strong>
        </div>
        <div className="session-v2__clock" aria-label="Elapsed session time">
          <Clock size={17} weight="fill" />
          <span>{formatElapsed(record.startedAt, now)}</span>
        </div>
      </header>

      <section className="session-v2__progress" aria-label={`${progress}% of workout handled`}>
        <div>
          <span>{handledCount} of {session.exercises.length} exercises</span>
          <strong>{progress}%</strong>
        </div>
        <div className="session-v2__progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress}>
          <span className={`tone-bg-${session.tone}`} style={{ width: `${progress}%` }} />
        </div>
      </section>

      {error && (
        <div className="session-v2__error" role="alert">
          <WarningCircle size={20} weight="fill" />
          <span>{error}</span>
        </div>
      )}

      <div className="session-v2__layout">
        <article className={`session-v2__exercise tone-bg-${session.tone}`}>
          <div className="session-v2__visual">
            <button onClick={() => setExpandedImage(true)} aria-label={`Expand ${selectedVariant.label} instructions`}>
              <img
                src={selectedVariant.image}
                alt={`Four-step illustration for the ${selectedVariant.label.toLowerCase()} version of ${guide.label}`}
                onError={(event) => {
                  event.currentTarget.src = session.image;
                }}
              />
              <span><ArrowsOut size={18} /> Tap to inspect form</span>
            </button>
          </div>

          <div className="session-v2__body">
            <div className="session-v2__eyebrow">
              <span>{String(currentIndex + 1).padStart(2, "0")} / {String(session.exercises.length).padStart(2, "0")}</span>
              <span>{currentExercise.sets === 1 ? "1 block" : `${currentExercise.sets} sets`}</span>
              <span>{currentExercise.reps}</span>
            </div>

            <h1>
              {guide.variants.length > 1
                ? `${guide.label} · ${selectedVariant.label}`
                : currentExercise.name}
            </h1>
            <p className="session-v2__effort">{currentExercise.effort} · rest about {currentExercise.rest || 0}s when needed</p>

            {guide.variants.length > 1 && (
              <div className="session-v2__variants" aria-label="Exercise version">
                <span>Choose your setup</span>
                <div>
                  {guide.variants.map((variant) => {
                    const variantBusy = mutationKey === `variant:${currentExercise.id}:${variant.id}`;
                    const variantDisabled = busy || Boolean(currentState.completedAt);
                    return (
                      <button
                        key={variant.id}
                        className={selectedVariant.id === variant.id ? "is-selected" : ""}
                        onClick={() => onSelectVariant(currentExercise.id, variant.id)}
                        aria-pressed={selectedVariant.id === variant.id}
                        aria-disabled={variantDisabled}
                        aria-busy={variantBusy}
                        disabled={variantDisabled}
                      >
                        {variantBusy ? <InlineSpinner size="sm" /> : null}
                        {variantBusy ? `Selecting ${variant.label}…` : variant.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="session-v2__equipment">
              <Barbell size={18} weight="fill" />
              <span>{selectedVariant.equipment}</span>
            </div>

            <div className="session-v2__sets" aria-label="Complete working sets">
              {Array.from({ length: currentExercise.sets }, (_, index) => {
                const setNumber = index + 1;
                const completed = currentState.completedSets.has(setNumber);
                const thisSetBusy = mutationKey === `set:${currentExercise.id}:${setNumber}`;
                return (
                  <button
                    key={setNumber}
                    className={completed ? "is-complete" : ""}
                    onClick={() => toggleSet(setNumber)}
                    disabled={busy || Boolean(currentState.skippedAt)}
                    aria-disabled={busy || Boolean(currentState.skippedAt)}
                    aria-busy={thisSetBusy}
                    aria-pressed={completed}
                  >
                    <span>{thisSetBusy ? <InlineSpinner size="sm" /> : completed ? <Check size={20} weight="bold" /> : setNumber}</span>
                    <strong>{currentExercise.sets === 1 ? "Complete block" : `Set ${setNumber}`}</strong>
                    <small>{thisSetBusy ? "Saving…" : completed ? "Recorded" : "Tap when done"}</small>
                  </button>
                );
              })}
            </div>

            <div className="session-v2__instructions">
              <div className="session-v2__instructions-title">
                <Info size={19} weight="fill" />
                <span>How to do this version</span>
              </div>
              <ol>
                {selectedVariant.steps.map((step) => <li key={step}>{step}</li>)}
              </ol>
              <div className="session-v2__avoid">
                <WarningCircle size={19} weight="fill" />
                <span>{selectedVariant.avoid ?? currentExercise.caution}</span>
              </div>
            </div>

            <button
              className="session-v2__skip"
              onClick={skipCurrent}
              disabled={busy || Boolean(currentState.completedAt)}
              aria-disabled={busy || Boolean(currentState.completedAt)}
              aria-busy={skipBusy}
            >
              {skipBusy ? <InlineSpinner /> : <SkipForward size={18} />}
              {skipBusy
                ? currentState.skippedAt ? "Restoring exercise…" : "Skipping exercise…"
                : currentState.skippedAt ? "Restore this exercise" : "Skip for pain, time or equipment"}
            </button>
          </div>
        </article>

        <aside className="session-v2__runway">
          <div className="session-v2__runway-heading">
            <div>
              <span>Workout runway</span>
              <h2>WHAT'S NEXT</h2>
            </div>
            <span>{session.exercises.length} total</span>
          </div>

          <div className="session-v2__runway-list">
            {session.exercises.map((exercise, index) => {
              const state = exerciseState(record, exercise);
              const handled = Boolean(state.completedAt || state.skippedAt);
              return (
                <button
                  key={exercise.id}
                  className={`${index === currentIndex ? "is-current" : ""} ${handled ? "is-handled" : ""}`}
                  onClick={() => setCurrentIndex(index)}
                  aria-current={index === currentIndex ? "step" : undefined}
                >
                  <span className="session-v2__runway-number">
                    {state.completedAt ? <Check size={16} weight="bold" /> : String(index + 1).padStart(2, "0")}
                  </span>
                  <span>
                    <strong>{exercise.name}</strong>
                    <small>{state.skippedAt ? "Skipped" : state.completedAt ? "Completed" : `${exercise.sets} ${exercise.sets === 1 ? "block" : "sets"} · ${exercise.reps}`}</small>
                  </span>
                  <ArrowRight size={16} />
                </button>
              );
            })}
          </div>

          <button className="session-v2__finish" onClick={() => setShowFinish(true)} disabled={!allHandled || busy}>
            <CheckCircle size={21} weight="fill" />
            {allHandled ? `Complete Session ${session.id}` : `${session.exercises.length - handledCount} exercises remaining`}
          </button>
          <button className="session-v2__end-incomplete" onClick={() => setShowEndIncomplete(true)} disabled={busy}>
            End this workout incomplete
          </button>
        </aside>
      </div>

      {expandedImage && (
        <div className="session-v2__modal-backdrop" role="presentation" onMouseDown={() => setExpandedImage(false)}>
          <section className="session-v2__image-modal" role="dialog" aria-modal="true" aria-label={`${guide.label} visual guide`} onMouseDown={(event) => event.stopPropagation()}>
            <button onClick={() => setExpandedImage(false)} aria-label="Close visual guide"><X size={22} /></button>
            <img src={selectedVariant.image} alt={`Expanded four-step illustration for ${guide.label}, ${selectedVariant.label} version`} />
            <div>
              <span>{selectedVariant.label} setup</span>
              <strong>{guide.label}</strong>
              <small>{selectedVariant.equipment}</small>
            </div>
          </section>
        </div>
      )}

      {showFinish && (
        <div className="session-v2__modal-backdrop" role="presentation" onMouseDown={() => { if (!busy) setShowFinish(false); }}>
          <section className="session-v2__finish-modal" role="dialog" aria-modal="true" aria-labelledby="finish-session-title" aria-busy={finishBusy} onMouseDown={(event) => event.stopPropagation()}>
            <button className="session-v2__modal-close" onClick={() => setShowFinish(false)} disabled={busy} aria-disabled={busy} aria-label="Close"><X size={20} /></button>
            <CheckCircle size={38} weight="fill" />
            <span>Session {session.id} · {handledCount - skippedCount} completed · {skippedCount} skipped</span>
            <h2 id="finish-session-title">SAVE THIS WORKOUT</h2>
            <p>Your start time, finish time and set checkmarks will stay in your history.</p>
            <label>
              <span>Weight today <small>optional</small></span>
              <div><input inputMode="decimal" value={weight} onChange={(event) => setWeight(event.target.value)} disabled={busy} aria-disabled={busy} placeholder="73.5" /><strong>kg</strong></div>
            </label>
            <button className="primary-action dark-action" onClick={finishSession} disabled={busy} aria-disabled={busy} aria-busy={finishBusy}>
              {finishBusy ? <InlineSpinner /> : <CheckCircle size={20} weight="fill" />}
              {finishBusy ? "Saving workout…" : "Save completed workout"}
            </button>
          </section>
        </div>
      )}

      {showEndIncomplete && (
        <div className="session-v2__modal-backdrop" role="presentation" onMouseDown={() => { if (!busy) setShowEndIncomplete(false); }}>
          <section className="session-v2__finish-modal" role="dialog" aria-modal="true" aria-labelledby="end-incomplete-title" aria-busy={endIncompleteBusy} onMouseDown={(event) => event.stopPropagation()}>
            <button className="session-v2__modal-close" onClick={() => setShowEndIncomplete(false)} disabled={busy} aria-disabled={busy} aria-label="Close"><X size={20} /></button>
            <WarningCircle size={38} weight="fill" />
            <span>Your checked sets will remain in history</span>
            <h2 id="end-incomplete-title">END INCOMPLETE?</h2>
            <p>This closes the active workout. It still counts as today's one workout session.</p>
            <button className="primary-action dark-action" onClick={onEndIncomplete} disabled={busy} aria-disabled={busy} aria-busy={endIncompleteBusy}>
              {endIncompleteBusy ? <InlineSpinner /> : null}
              {endIncompleteBusy ? "Ending workout…" : "End and save as incomplete"}
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
