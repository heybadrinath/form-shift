const primaryPageOrder = Object.freeze({
  workouts: 0,
  food: 1,
  calendar: 2,
  analytics: 3,
});

export function pageMotionMode(currentPage, nextPage) {
  if (currentPage === nextPage) return "stay";
  if (nextPage === "session" || nextPage === "guide") return "focus";
  if (currentPage === "session" || currentPage === "guide") return "return";

  const currentIndex = primaryPageOrder[currentPage];
  const nextIndex = primaryPageOrder[nextPage];
  if (!Number.isInteger(currentIndex) || !Number.isInteger(nextIndex)) return "focus";
  return nextIndex > currentIndex ? "forward" : "back";
}

