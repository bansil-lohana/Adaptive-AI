import type { Request } from "express";
import { errors } from "./errors";
import type { AuthUser } from "../types";

export function requireUser(req: Request): AuthUser {
  if (!req.authUser) throw errors.unauthorized();
  return req.authUser;
}
