import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Barbell, WarningCircle } from "@phosphor-icons/react";
import { appApi, ApiError } from "./api.js";
import { startSingleFlight } from "./asyncActionGate.js";
import { AppChrome } from "./components/AppChrome.jsx";
import { FoodIndex } from "./components/FoodIndex.jsx";
import { GuidePage } from "./components/GuidePage.jsx";
import { OwnerGate } from "./components/OwnerGate.jsx";
import { SessionRunner } from "./components/SessionRunner.jsx";
import { TrainingAnalytics } from "./components/TrainingAnalytics.jsx";
import { TrainingCalendar } from "./components/TrainingCalendar.jsx";
import { WorkoutHub } from "./components/WorkoutHub.jsx";
import { guideForExercise } from "./exerciseLibrary.js";
import { sessions } from "./data.js";
import { nextChennaiWorkoutBoundaryMs } from "./dailyAccess.js";
import {
  mutationSuccessTone,
  mutationStatusLabel,
  playInterfaceTone,
  primeInterfaceAudio,
  readSoundPreference,
  resetInterfaceAudioAfterBackground,
  writeSoundPreference,
} from "./interfaceFeedback.js";
import {
  reconcileClosedWorkout,
  upsertJournalEntry,
} from "./journalReconciliation.js";

const emptyState = {
  activeSession: null,
  logicalDaySession: null,
  sessionHistory: [],
  weights: [],
  logicalDay: null,
};

function readableError(error) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError) return "The app could not reach its server. Check your connection and try again.";
  return "Something went wrong while updating your training data.";
}

function defaultVariants(template) {
  return Object.fromEntries(template.exercises.map((exercise) => [
    exercise.id,
    guideForExercise(exercise).variants[0].id,
  ]));
}

function mergeExercise(activeSession, updatedExercise) {
  return {
    ...activeSession,
    exercises: activeSession.exercises.map((exercise) => (
      exercise.exerciseId === updatedExercise.exerciseId
        ? { ...exercise, ...updatedExercise, sets: updatedExercise.sets ?? exercise.sets }
        : exercise
    )),
  };
}

function mergeSet(activeSession, updatedSet, updatedExercise) {
  return {
    ...activeSession,
    exercises: activeSession.exercises.map((exercise) => {
      if (exercise.exerciseId !== updatedSet.exerciseId) return exercise;
      return {
        ...exercise,
        ...updatedExercise,
        sets: exercise.sets.map((set) => (
          Number(set.setNumber) === Number(updatedSet.setNumber) ? { ...set, ...updatedSet } : set
        )),
      };
    }),
  };
}

export function App() {
  const [page, setPage] = useState("workouts");
  const [selectedSessionId, setSelectedSessionId] = useState("A");
  const [authState, setAuthState] = useState("loading");
  const [appState, setAppState] = useState(emptyState);
  const [mutationKey, setMutationKey] = useState(null);
  const [error, setError] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(readSoundPreference);
  const [syncNotice, setSyncNotice] = useState(null);
  const mutationLockRef = useRef(null);
  const noticeTimerRef = useRef(null);
  const transitionRequestRef = useRef(0);
  const soundEnabledRef = useRef(soundEnabled);

  const transitionTo = useCallback((nextPage) => {
    const requestId = transitionRequestRef.current + 1;
    transitionRequestRef.current = requestId;
    const commit = () => {
      if (transitionRequestRef.current !== requestId) return;
      flushSync(() => setPage(nextPage));
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    };
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!reduceMotion && typeof document.startViewTransition === "function") {
      document.startViewTransition(commit);
      return;
    }
    commit();
  }, []);

  const showSyncNotice = useCallback((status, message, holdMs = null) => {
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    setSyncNotice({ status, message });
    if (holdMs) {
      noticeTimerRef.current = window.setTimeout(() => setSyncNotice(null), holdMs);
    }
  }, []);

  const activeTemplate = useMemo(
    () => sessions.find((session) => session.id === appState.activeSession?.templateId) ?? null,
    [appState.activeSession?.templateId],
  );

  const applyBootstrap = useCallback((payload, { openActive = false } = {}) => {
    if (!payload.authenticated) {
      setAuthState("locked");
      setAppState(emptyState);
      return;
    }

    setAuthState("ready");
    setAppState({
      activeSession: payload.activeSession ?? null,
      logicalDaySession: payload.logicalDaySession ?? null,
      sessionHistory: payload.sessionHistory ?? payload.sessions ?? [],
      weights: payload.weights ?? [],
      logicalDay: payload.logicalDay ?? null,
    });
    if (payload.activeSession && openActive) transitionTo("session");
  }, [transitionTo]);

  const refresh = useCallback(async (options) => {
    const payload = await appApi.bootstrap();
    applyBootstrap(payload, options);
    return payload;
  }, [applyBootstrap]);

  useEffect(() => {
    const controller = new AbortController();
    appApi.bootstrap(controller.signal)
      .then((payload) => applyBootstrap(payload, { openActive: true }))
      .catch((bootstrapError) => {
        if (bootstrapError.name === "AbortError") return;
        setError(readableError(bootstrapError));
        setAuthState("error");
      });
    return () => controller.abort();
  }, [applyBootstrap]);

  useEffect(() => {
    if (authState !== "ready") return undefined;

    const expiresAt = nextChennaiWorkoutBoundaryMs();
    const lockExpiredAccess = () => {
      if (Date.now() < expiresAt) return;
      setAuthState("locked");
      setAppState(emptyState);
      setError("");
      transitionTo("workouts");
    };
    const timer = window.setTimeout(lockExpiredAccess, Math.max(0, expiresAt - Date.now()) + 50);
    const checkWhenVisible = () => {
      if (document.visibilityState === "visible") lockExpiredAccess();
    };

    document.addEventListener("visibilitychange", checkWhenVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", checkWhenVisible);
    };
  }, [authState, transitionTo]);

  useEffect(() => {
    function eligibleControl(target) {
      const control = target.closest?.("button:not(:disabled), a[href]");
      if (!control || control.dataset.sound === "off") return null;
      return control;
    }

    function handleInterfaceIntent(event) {
      if (!eligibleControl(event.target)) return;
      primeInterfaceAudio(soundEnabled);
    }

    function handleInterfaceKeydown(event) {
      if (event.repeat || (event.key !== "Enter" && event.key !== " ")) return;
      handleInterfaceIntent(event);
    }

    function handleInterfaceClick(event) {
      const control = eligibleControl(event.target);
      if (!control) return;
      playInterfaceTone(control.dataset.sound || "tap", soundEnabled);
    }

    document.addEventListener("pointerdown", handleInterfaceIntent, true);
    document.addEventListener("keydown", handleInterfaceKeydown, true);
    document.addEventListener("click", handleInterfaceClick, true);
    return () => {
      document.removeEventListener("pointerdown", handleInterfaceIntent, true);
      document.removeEventListener("keydown", handleInterfaceKeydown, true);
      document.removeEventListener("click", handleInterfaceClick, true);
    };
  }, [soundEnabled]);

  useEffect(() => {
    function handleAudioBackgrounding() {
      if (document.visibilityState !== "visible") resetInterfaceAudioAfterBackground();
    }

    document.addEventListener("visibilitychange", handleAudioBackgrounding);
    window.addEventListener("pagehide", resetInterfaceAudioAfterBackground);
    return () => {
      document.removeEventListener("visibilitychange", handleAudioBackgrounding);
      window.removeEventListener("pagehide", resetInterfaceAudioAfterBackground);
    };
  }, []);

  useEffect(() => () => {
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
  }, []);

  async function runMutation(key, action, { playSuccessSound = true } = {}) {
    const ticket = startSingleFlight(mutationLockRef, key, async () => {
      setMutationKey(key);
      setError("");
      showSyncNotice("saving", mutationStatusLabel(key));
      try {
        const result = await action();
        showSyncNotice("saved", "Saved to your journal", 1500);
        if (playSuccessSound) {
          playInterfaceTone(mutationSuccessTone(key), soundEnabledRef.current);
        }
        return result;
      } catch (mutationError) {
        if (mutationError instanceof ApiError && mutationError.status === 401) {
          setAuthState("locked");
          setAppState(emptyState);
        }
        setError(readableError(mutationError));
        showSyncNotice("error", "Could not save. Try again.", 3200);
        playInterfaceTone("error", soundEnabledRef.current);
        throw mutationError;
      } finally {
        setMutationKey(null);
      }
    });

    if (!ticket.started) {
      await ticket.promise.catch(() => undefined);
      return false;
    }

    await ticket.promise;
    return true;
  }

  async function unlock(pin) {
    try {
      return await runMutation("unlock", async () => {
        await appApi.unlock(pin);
        await refresh({ openActive: true });
      });
    } catch {
      // The owner gate displays the shared error state.
      return false;
    }
  }

  async function lock() {
    try {
      return await runMutation("lock", async () => {
        await appApi.lock();
        setAuthState("locked");
        setAppState(emptyState);
        transitionTo("workouts");
        setError("");
      });
    } catch {
      // Keep the current authenticated state when the server could not lock it.
      return false;
    }
  }

  function navigate(nextPage) {
    if (nextPage === "session" && !appState.activeSession) {
      transitionTo("workouts");
      return;
    }
    transitionTo(nextPage);
  }

  function toggleSound() {
    const nextEnabled = !soundEnabled;
    soundEnabledRef.current = nextEnabled;
    setSoundEnabled(nextEnabled);
    writeSoundPreference(nextEnabled);
    if (nextEnabled) {
      primeInterfaceAudio(true).then(() => playInterfaceTone("unlock", true));
      showSyncNotice("saved", "Interface sounds on", 1500);
    } else {
      showSyncNotice("saved", "Interface sounds muted", 1500);
    }
  }

  async function startSession(templateId) {
    const template = sessions.find((session) => session.id === templateId);
    if (!template) return false;
    try {
      return await runMutation("start", async () => {
        try {
          const payload = await appApi.startWorkout(templateId, defaultVariants(template));
          setAppState((current) => ({
            ...current,
            activeSession: payload.session,
            logicalDaySession: payload.session,
          }));
          setSelectedSessionId(templateId);
          transitionTo("session");
        } catch (startError) {
          await refresh().catch(() => undefined);
          throw startError;
        }
      });
    } catch {
      return false;
    }
  }

  async function toggleSet(exerciseId, setNumber, completed) {
    const sessionId = appState.activeSession.id;
    try {
      return await runMutation(`set:${exerciseId}:${setNumber}`, async () => {
        const payload = await appApi.toggleSet(sessionId, exerciseId, setNumber, completed);
        setAppState((current) => ({
          ...current,
          activeSession: mergeSet(current.activeSession, payload.set, payload.exercise),
        }));
      });
    } catch {
      return false;
    }
  }

  async function selectVariant(exerciseId, variant) {
    try {
      return await runMutation(`variant:${exerciseId}:${variant}`, async () => {
        const payload = await appApi.selectVariant(appState.activeSession.id, exerciseId, variant);
        setAppState((current) => ({
          ...current,
          activeSession: mergeExercise(current.activeSession, payload.exercise),
        }));
      });
    } catch {
      return false;
    }
  }

  async function skipExercise(exerciseId) {
    const exercise = appState.activeSession.exercises.find((item) => item.exerciseId === exerciseId);
    try {
      return await runMutation(`skip:${exerciseId}`, async () => {
        const payload = await appApi.skipExercise(
          appState.activeSession.id,
          exerciseId,
          !exercise?.skippedAt,
        );
        setAppState((current) => ({
          ...current,
          activeSession: mergeExercise(current.activeSession, payload.exercise),
        }));
      });
    } catch {
      return false;
    }
  }

  async function finishSession(weightKg) {
    const sessionId = appState.activeSession.id;
    let weightSaveError = null;
    try {
      const started = await runMutation("finish", async () => {
        const workoutPayload = await appApi.finishWorkout(sessionId);
        setAppState((current) => reconcileClosedWorkout(current, workoutPayload.session));
        if (weightKg !== null) {
          try {
            const weightPayload = await appApi.addWeight({ weightKg });
            setAppState((current) => ({
              ...current,
              weights: upsertJournalEntry(current.weights, weightPayload.entry),
            }));
          } catch (weightError) {
            weightSaveError = weightError;
          }
        }
        transitionTo("analytics");
      }, { playSuccessSound: false });
      if (!started) return false;
      if (weightSaveError) {
        setError("The workout was saved, but the weight entry was not. Add it again from Analytics.");
        showSyncNotice("error", "Workout saved · weight needs retry", 4600);
        playInterfaceTone("partial", soundEnabledRef.current);
      } else {
        playInterfaceTone("complete", soundEnabledRef.current);
      }
      return true;
    } catch {
      return false;
    }
  }

  async function endIncomplete() {
    try {
      const started = await runMutation("end-incomplete", async () => {
        const payload = await appApi.endIncomplete(appState.activeSession.id);
        setAppState((current) => reconcileClosedWorkout(current, payload.session));
        transitionTo("calendar");
      });
      return started;
    } catch {
      return false;
    }
  }

  async function addWeight({ date, weightKg }) {
    const started = await runMutation("weight:add", async () => {
      const payload = await appApi.addWeight({ weightKg, date });
      setAppState((current) => ({
        ...current,
        weights: upsertJournalEntry(current.weights, payload.entry),
      }));
    });
    if (!started) throw new Error("Another change is still being saved.");
    return true;
  }

  async function editWeight(entryId, { date, weightKg }) {
    const started = await runMutation(`weight:${entryId}`, async () => {
      const payload = await appApi.updateWeight(entryId, { weightKg, date });
      setAppState((current) => ({
        ...current,
        weights: upsertJournalEntry(current.weights, payload.entry),
      }));
    });
    if (!started) throw new Error("Another change is still being saved.");
    return true;
  }

  if (authState === "loading") {
    return (
      <div className="app-loading" role="status">
        <span><Barbell size={28} weight="fill" /></span>
        <strong>Loading your training journal…</strong>
      </div>
    );
  }

  if (authState === "locked") {
    return <OwnerGate busy={mutationKey === "unlock"} error={error} onUnlock={unlock} />;
  }

  if (authState === "error") {
    return (
      <div className="app-fatal-error" role="alert">
        <WarningCircle size={42} weight="fill" />
        <h1>THE JOURNAL COULD NOT OPEN.</h1>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Try again</button>
      </div>
    );
  }

  return (
    <AppChrome
      activePage={page}
      activeSession={appState.activeSession}
      activeTemplate={activeTemplate}
      mutationKey={mutationKey}
      soundEnabled={soundEnabled}
      syncNotice={syncNotice}
      onNavigate={navigate}
      onLock={lock}
      onToggleSound={toggleSound}
    >
      {page === "workouts" && (
        <WorkoutHub
          selectedSessionId={selectedSessionId}
          activeSession={appState.activeSession}
          logicalDaySession={appState.logicalDaySession}
          busy={Boolean(mutationKey)}
          startBusy={mutationKey === "start"}
          error={error}
          onSelectSession={setSelectedSessionId}
          onStartSession={startSession}
          onContinueSession={() => transitionTo("session")}
        />
      )}

      {page === "session" && appState.activeSession && activeTemplate && (
        <SessionRunner
          session={activeTemplate}
          record={appState.activeSession}
          mutationKey={mutationKey}
          error={error}
          onBack={() => transitionTo("workouts")}
          onToggleSet={toggleSet}
          onSelectVariant={selectVariant}
          onSkipExercise={skipExercise}
          onFinish={finishSession}
          onEndIncomplete={endIncomplete}
        />
      )}

      {page === "food" && <FoodIndex />}

      {page === "calendar" && (
        <TrainingCalendar sessionHistory={appState.sessionHistory} logicalDayCutoffHour={4} />
      )}

      {page === "analytics" && (
        <TrainingAnalytics
          sessionHistory={appState.sessionHistory}
          weightEntries={appState.weights}
          logicalDayCutoffHour={4}
          busy={Boolean(mutationKey)}
          onAddWeight={addWeight}
          onEditWeight={editWeight}
        />
      )}

      {page === "guide" && (
        <GuidePage
          busy={Boolean(mutationKey)}
          startBusy={mutationKey === "start"}
          onStartSession={() => startSession("A")}
        />
      )}
    </AppChrome>
  );
}
