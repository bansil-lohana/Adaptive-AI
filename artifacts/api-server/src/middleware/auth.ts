import type { NextFunction, Request, Response } from "express";
import { errors } from "../lib/errors";
import { getSupabaseAdmin } from "../lib/supabase";
import { db } from "@workspace/db";
import { profiles } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

function readBearerToken(req: Request): string | null {
  const header = req.header("authorization") || req.header("Authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

async function ensureProfile(user: { id: string; email?: string; user_metadata?: Record<string, unknown> }) {
  const [existing] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);
  if (existing) return existing;
  const fullName =
    (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name) ||
    (typeof user.user_metadata?.name === "string" && user.user_metadata.name) ||
    "Student";
  const [created] = await db
    .insert(profiles)
    .values({
      id: user.id,
      fullName,
      email: user.email ?? "",
    })
    .onConflictDoNothing()
    .returning();
  return created ?? (await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1))[0];
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = readBearerToken(req);
    if (!token) throw errors.unauthorized();
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) throw errors.unauthorized("Invalid or expired access token");
    await ensureProfile({
      id: data.user.id,
      email: data.user.email,
      user_metadata: data.user.user_metadata as Record<string, unknown>,
    });
    req.authUser = { id: data.user.id, email: data.user.email ?? "" };
    next();
  } catch (error) {
    next(error);
  }
}
