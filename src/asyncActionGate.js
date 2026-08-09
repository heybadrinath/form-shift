export function startSingleFlight(lockRef, key, action) {
  const active = lockRef.current;
  if (active) {
    return {
      started: false,
      key: active.key,
      promise: active.promise,
    };
  }

  const operation = { key, promise: null };
  operation.promise = Promise.resolve()
    .then(action)
    .finally(() => {
      if (lockRef.current === operation) lockRef.current = null;
    });
  lockRef.current = operation;

  return {
    started: true,
    key,
    promise: operation.promise,
  };
}
