import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { subjects } from "@workspace/db/schema";
import { asyncHandler } from "../lib/asyncHandler";
import { requireUser } from "../lib/requireUser";
import { sendSuccess } from "../lib/response";
import { errors } from "../lib/errors";
import { requireAuth } from "../middleware/auth";
import { subjectBodySchema, subjectUpdateSchema, uuidParam } from "../validation/schemas";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const rows = await db.select().from(subjects).where(eq(subjects.userId, user.id));
    sendSuccess(res, rows);
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const body = subjectBodySchema.parse(req.body);
    const [created] = await db
      .insert(subjects)
      .values({
        userId: user.id,
        name: body.name,
        code: body.code ?? null,
        teacher: body.teacher ?? null,
        defaultRoom: body.defaultRoom ?? null,
      })
      .returning();
    sendSuccess(res, created, 201);
  }),
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const { id } = uuidParam.parse(req.params);
    const body = subjectUpdateSchema.parse(req.body);
    const [updated] = await db
      .update(subjects)
      .set(body)
      .where(and(eq(subjects.id, id), eq(subjects.userId, user.id)))
      .returning();
    if (!updated) throw errors.notFound("Subject not found");
    sendSuccess(res, updated);
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const { id } = uuidParam.parse(req.params);
    const deleted = await db
      .delete(subjects)
      .where(and(eq(subjects.id, id), eq(subjects.userId, user.id)))
      .returning({ id: subjects.id });
    if (!deleted.length) throw errors.notFound("Subject not found");
    sendSuccess(res, { id });
  }),
);

export default router;
