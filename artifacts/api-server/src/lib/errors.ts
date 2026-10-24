export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const errors = {
  unauthorized: (message = "Authentication required") =>
    new AppError(401, "UNAUTHORIZED", message),
  forbidden: (message = "You do not have access to this resource") =>
    new AppError(403, "FORBIDDEN", message),
  notFound: (message = "Resource not found") => new AppError(404, "NOT_FOUND", message),
  validation: (message: string, details?: unknown) =>
    new AppError(400, "VALIDATION_ERROR", message, details),
  conflict: (message: string) => new AppError(409, "CONFLICT", message),
  payload: (message: string) => new AppError(413, "PAYLOAD_TOO_LARGE", message),
  gemini: (message: string) => new AppError(502, "AI_PROVIDER_ERROR", message),
  geminiRateLimited: () =>
    new AppError(
      429,
      "AI_RATE_LIMITED",
      "The AI service is temporarily rate-limited. Please try again later.",
    ),
  database: (message = "A database error occurred") =>
    new AppError(500, "DATABASE_ERROR", message),
  storage: (message = "File storage failed") => new AppError(500, "STORAGE_ERROR", message),
};
