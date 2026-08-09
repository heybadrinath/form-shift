export class AppError extends Error {
  constructor(code, message, status = 400, details = undefined) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function asAppError(error) {
  if (error instanceof AppError) return error;

  console.error("Unhandled API error", error);
  return new AppError(
    "internal_error",
    "The request could not be completed.",
    500,
  );
}
