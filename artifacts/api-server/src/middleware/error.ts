import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../lib/errors";
import { sendError } from "../lib/response";
import { logger } from "../lib/logger";

export function notFoundHandler(_req: Request, res: Response) {
  return sendError(res, 404, "NOT_FOUND", "Route not found");
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    if (err.status >= 500) {
      logger.error({ err, path: req.path }, err.message);
    } else {
      logger.warn({ code: err.code, path: req.path }, err.message);
    }
    return sendError(res, err.status, err.code, err.message, err.details);
  }

  if (err instanceof ZodError) {
    return sendError(res, 400, "VALIDATION_ERROR", "Invalid request", err.flatten());
  }

  const maybeMulter = err as { code?: string; message?: string };
  if (maybeMulter?.code === "LIMIT_FILE_SIZE") {
    return sendError(res, 413, "PAYLOAD_TOO_LARGE", "Uploaded file is too large");
  }

  logger.error({ err, path: req.path }, "Unhandled error");
  const message =
    process.env.NODE_ENV === "production"
      ? "An unexpected error occurred"
      : err instanceof Error
        ? err.message
        : "An unexpected error occurred";
  return sendError(res, 500, "INTERNAL_ERROR", message);
}
