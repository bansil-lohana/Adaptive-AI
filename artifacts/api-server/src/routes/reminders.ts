import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { reminders } from "@workspace/db/schema";
import { asyncHandler } from "../lib/asyncHandler";
import { requireUser } from "../lib/requireUser";
import { sendSuccess } from "../lib/response";
import { errors } from "../lib/errors";
import { requireAuth } from "../middleware/auth";
import { reminderBodySchema, reminderUpdateSchema, uuidParam } from "../validation/schemas";
import { getOwnedEntry } from "../services/timetableService";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    sendSuccess(res, await db.select().from(reminders).where(eq(reminders.userId, user.id)));
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const body = reminderBodySchema.parse(req.body);
    await getOwnedEntry(user.id, body.timetableEntryId);
    const [created] = await db
      .insert(reminders)
      .values({
        userId: user.id,
        timetableEntryId: body.timetableEntryId,
        minutesBefore: body.minutesBefore,
        enabled: body.enabled ?? true,
        notificationTitle: body.notificationTitle ?? "Upcoming class",
        notificationBody: body.notificationBody ?? null,
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
    const body = reminderUpdateSchema.parse(req.body);
    if (body.timetableEntryId) await getOwnedEntry(user.id, body.timetableEntryId);
    const [updated] = await db
      .update(reminders)
      .set(body)
      .where(and(eq(reminders.id, id), eq(reminders.userId, user.id)))
      .returning();
    if (!updated) throw errors.notFound("Reminder not found");
    sendSuccess(res, updated);
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const { id } = uuidParam.parse(req.params);
    const deleted = await db
      .delete(reminders)
      .where(and(eq(reminders.id, id), eq(reminders.userId, user.id)))
      .returning({ id: reminders.id });
    if (!deleted.length) throw errors.notFound("Reminder not found");
    sendSuccess(res, { id });
  }),
);

export default router;
