export class ApiError extends Error {
  constructor(message, { code = "request_failed", status = 500, details = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

async function requestJson(path, { method = "GET", body, signal } = {}) {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError("The server returned an unreadable response.", {
      code: "invalid_server_response",
      status: response.status,
    });
  }

  if (!response.ok) {
    throw new ApiError(payload?.error?.message ?? "The request failed.", {
      code: payload?.error?.code,
      status: response.status,
      details: payload?.error?.details,
    });
  }

  return payload;
}

export const appApi = {
  bootstrap: (signal) => requestJson("/api/bootstrap", { signal }),
  unlock: (pin) => requestJson("/api/auth/unlock", { method: "POST", body: { pin } }),
  lock: () => requestJson("/api/auth/lock", { method: "POST" }),
  startWorkout: (templateId, variantSelections = {}) => requestJson("/api/workouts/start", {
    method: "POST",
    body: { templateId, variantSelections },
  }),
  toggleSet: (sessionId, exerciseId, setNumber, completed) => requestJson(`/api/workouts/${sessionId}/sets`, {
    method: "PUT",
    body: { exerciseId, setNumber, completed },
  }),
  selectVariant: (sessionId, exerciseId, variant) => requestJson(`/api/workouts/${sessionId}/variant`, {
    method: "PUT",
    body: { exerciseId, variant },
  }),
  skipExercise: (sessionId, exerciseId, skipped = true) => requestJson(`/api/workouts/${sessionId}/exercises`, {
    method: "PUT",
    body: { exerciseId, skipped },
  }),
  finishWorkout: (sessionId) => requestJson(`/api/workouts/${sessionId}/finish`, { method: "POST" }),
  endIncomplete: (sessionId, reason = null) => requestJson(`/api/workouts/${sessionId}/end-incomplete`, {
    method: "POST",
    body: reason ? { reason } : {},
  }),
  addWeight: ({ weightKg, measuredAt, date }) => requestJson("/api/weights", {
    method: "POST",
    body: {
      weightKg,
      ...(measuredAt ? { measuredAt } : {}),
      ...(!measuredAt && date ? { date } : {}),
    },
  }),
  updateWeight: (entryId, values) => requestJson(`/api/weights/${entryId}`, {
    method: "PUT",
    body: values,
  }),
  deleteWeight: (entryId) => requestJson(`/api/weights/${entryId}`, { method: "DELETE" }),
};
