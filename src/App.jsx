import { useCallback, useEffect, useMemo, useState } from "react";
import { Barbell, WarningCircle } from "@phosphor-icons/react";
import { appApi, ApiError } from "./api.js";
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
    if (payload.activeSession && openActive) setPage("session");
  }, []);

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
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [page]);

  async function runMutation(key, action) {
    setMutationKey(key);
    setError("");
    try {
      return await action();
    } catch (mutationError) {
      if (mutationError instanceof ApiError && mutationError.status === 401) {
        setAuthState("locked");
        setAppState(emptyState);
      }
      setError(readableError(mutationError));
      throw mutationError;
    } finally {
      setMutationKey(null);
    }
  }

  async function unlock(pin) {
    try {
      await runMutation("unlock", () => appApi.unlock(pin));
      await refresh({ openActive: true });
    } catch {
      // The owner gate displays the shared error state.
    }
  }

  async function lock() {
    try {
      await appApi.lock();
    } finally {
      setAuthState("locked");
      setAppState(emptyState);
      setPage("workouts");
      setError("");
    }
  }

  function navigate(nextPage) {
    if (nextPage === "session" && !appState.activeSession) {
      setPage("workouts");
      return;
    }
    setPage(nextPage);
  }

  async function startSession(templateId) {
    const template = sessions.find((session) => session.id === templateId);
    if (!template) return;
    try {
      const payload = await runMutation("start", () => appApi.startWorkout(templateId, defaultVariants(template)));
      setAppState((current) => ({
        ...current,
        activeSession: payload.session,
        logicalDaySession: payload.session,
      }));
      setSelectedSessionId(templateId);
      setPage("session");
    } catch {
      await refresh().catch(() => undefined);
    }
  }

  async function toggleSet(exerciseId, setNumber, completed) {
    const sessionId = appState.activeSession.id;
    const payload = await runMutation(`set:${exerciseId}:${setNumber}`, () => (
      appApi.toggleSet(sessionId, exerciseId, setNumber, completed)
    ));
    setAppState((current) => ({
      ...current,
      activeSession: mergeSet(current.activeSession, payload.set, payload.exercise),
    }));
  }

  async function selectVariant(exerciseId, variant) {
    const payload = await runMutation(`variant:${exerciseId}`, () => (
      appApi.selectVariant(appState.activeSession.id, exerciseId, variant)
    ));
    setAppState((current) => ({
      ...current,
      activeSession: mergeExercise(current.activeSession, payload.exercise),
    }));
  }

  async function skipExercise(exerciseId) {
    const exercise = appState.activeSession.exercises.find((item) => item.exerciseId === exerciseId);
    const payload = await runMutation(`skip:${exerciseId}`, () => (
      appApi.skipExercise(appState.activeSession.id, exerciseId, !exercise?.skippedAt)
    ));
    setAppState((current) => ({
      ...current,
      activeSession: mergeExercise(current.activeSession, payload.exercise),
    }));
  }

  async function finishSession(weightKg) {
    const sessionId = appState.activeSession.id;
    let weightSaveError = null;
    await runMutation("finish", async () => {
      await appApi.finishWorkout(sessionId);
      if (weightKg !== null) {
        try {
          await appApi.addWeight({ weightKg });
        } catch (weightError) {
          weightSaveError = weightError;
        }
      }
      await refresh();
    });
    setPage("analytics");
    if (weightSaveError) {
      setError("The workout was saved, but the weight entry was not. Add it again from Analytics.");
    }
  }

  async function endIncomplete() {
    await runMutation("end-incomplete", async () => {
      await appApi.endIncomplete(appState.activeSession.id);
      await refresh();
    });
    setPage("calendar");
  }

  async function addWeight({ date, weightKg }) {
    const measuredAt = new Date(`${date}T12:00:00+05:30`).toISOString();
    await runMutation("weight:add", async () => {
      await appApi.addWeight({ weightKg, measuredAt });
      await refresh();
    });
  }

  async function editWeight(entryId, { date, weightKg }) {
    const measuredAt = new Date(`${date}T12:00:00+05:30`).toISOString();
    await runMutation(`weight:${entryId}`, async () => {
      await appApi.updateWeight(entryId, { weightKg, measuredAt });
      await refresh();
    });
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
      onNavigate={navigate}
      onLock={lock}
    >
      {page === "workouts" && (
        <WorkoutHub
          selectedSessionId={selectedSessionId}
          activeSession={appState.activeSession}
          logicalDaySession={appState.logicalDaySession}
          busy={mutationKey === "start"}
          error={error}
          onSelectSession={setSelectedSessionId}
          onStartSession={startSession}
          onContinueSession={() => setPage("session")}
        />
      )}

      {page === "session" && appState.activeSession && activeTemplate && (
        <SessionRunner
          session={activeTemplate}
          record={appState.activeSession}
          mutationKey={mutationKey}
          error={error}
          onBack={() => setPage("workouts")}
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
          onAddWeight={addWeight}
          onEditWeight={editWeight}
        />
      )}

      {page === "guide" && (
        <GuidePage onStartSession={() => startSession("A")} />
      )}
    </AppChrome>
  );
}
