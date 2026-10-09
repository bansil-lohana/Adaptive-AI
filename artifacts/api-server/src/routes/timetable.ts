import { Router } from "express";
import multer from "multer";
import { and, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { timetableEntries, timetableUploads } from "@workspace/db/schema";
import { asyncHandler } from "../lib/asyncHandler";
import { requireUser } from "../lib/requireUser";
import { sendSuccess } from "../lib/response";
import { errors } from "../lib/errors";
import { requireAuth } from "../middleware/auth";
import { aiRateLimit } from "../middleware/rateLimit";
import {
  confirmTimetableSchema,
  dayParam,
  parseClock,
  parseDayName,
  timetableBodySchema,
  timetableUpdateSchema,
  uuidParam,
} from "../validation/schemas";
import {
  createEntry,
  getNextClass,
  getNextClassForUser,
  getOwnedEntry,
  listEntries,
  serializeEntry,
} from "../services/timetableService";
import { extractTimetableFromFile } from "../services/geminiService";
import { buckets, uploadPrivateFile } from "../services/storageService";
import { normalizeTime } from "../lib/time";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const entries = await listEntries(user.id);
    sendSuccess(res, entries.map(serializeEntry));
  }),
);

router.get(
  "/today",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const today = new Date().getDay();
    const entries = (await listEntries(user.id)).filter((item) => item.dayOfWeek === today);
    sendSuccess(res, entries.map(serializeEntry));
  }),
);

router.get(
  "/week",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    sendSuccess(res, (await listEntries(user.id)).map(serializeEntry));
  }),
);

router.get(
  "/next",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const next = await getNextClassForUser(user.id);
    sendSuccess(res, next ? serializeEntry(next) : null);
  }),
);

router.get(
  "/day/:day",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const { day } = dayParam.parse(req.params);
    const entries = (await listEntries(user.id)).filter((item) => item.dayOfWeek === day);
    sendSuccess(res, entries.map(serializeEntry));
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const body = timetableBodySchema.parse(req.body);
    const created = await createEntry(user.id, body);
    sendSuccess(res, serializeEntry(created), 201);
  }),
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const { id } = uuidParam.parse(req.params);
    const body = timetableUpdateSchema.parse(req.body);
    await getOwnedEntry(user.id, id);
    if (body.startTime && body.endTime && normalizeTime(body.endTime) <= normalizeTime(body.startTime)) {
      throw errors.validation("endTime must be after startTime");
    }
    const [updated] = await db
      .update(timetableEntries)
      .set({
        ...(body.subjectId ? { subjectId: body.subjectId } : {}),
        ...(body.dayOfWeek !== undefined ? { dayOfWeek: body.dayOfWeek } : {}),
        ...(body.startTime ? { startTime: normalizeTime(body.startTime) } : {}),
        ...(body.endTime ? { endTime: normalizeTime(body.endTime) } : {}),
        ...(body.room !== undefined ? { room: body.room } : {}),
        ...(body.teacher !== undefined ? { teacher: body.teacher } : {}),
        ...(body.semester !== undefined ? { semester: body.semester } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      })
      .where(and(eq(timetableEntries.id, id), eq(timetableEntries.userId, user.id)))
      .returning();
    if (!updated) throw errors.notFound("Timetable entry not found");
    sendSuccess(res, serializeEntry(await getOwnedEntry(user.id, id)));
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const { id } = uuidParam.parse(req.params);
    const deleted = await db
      .delete(timetableEntries)
      .where(and(eq(timetableEntries.id, id), eq(timetableEntries.userId, user.id)))
      .returning({ id: timetableEntries.id });
    if (!deleted.length) throw errors.notFound("Timetable entry not found");
    sendSuccess(res, { id });
  }),
);

router.post(
  "/extract",
  aiRateLimit,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const file = req.file;
    if (!file) throw errors.validation("A timetable image or PDF is required");
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
    if (!allowed.includes(file.mimetype)) {
      throw errors.validation("Upload a PNG, JPEG, WEBP, HEIC, or PDF timetable");
    }

    const extension = file.originalname.includes(".")
      ? file.originalname.slice(file.originalname.lastIndexOf("."))
      : "";
    const storagePath = `${user.id}/timetable/${Date.now()}${extension}`;
    await uploadPrivateFile({
      bucket: buckets.timetable,
      path: storagePath,
      body: file.buffer,
      contentType: file.mimetype,
    });

    const [uploadRow] = await db
      .insert(timetableUploads)
      .values({
        userId: user.id,
        storagePath,
        fileType: file.mimetype,
        processingStatus: "processing",
      })
      .returning();
    if (!uploadRow) throw errors.database("Unable to record timetable upload");

    try {
      const extracted = await extractTimetableFromFile({
        mimeType: file.mimetype,
        data: file.buffer.toString("base64"),
      });
      const entries = extracted.entries
        .map((item) => {
          const dayOfWeek = parseDayName(item.day);
          const startTime = parseClock(item.startTime);
          const endTime = parseClock(item.endTime);
          if (dayOfWeek === null || !startTime || !endTime || endTime <= startTime) return null;
          return {
            subject: item.subject,
            code: item.code ?? null,
            teacher: item.teacher ?? null,
            dayOfWeek,
            startTime,
            endTime,
            room: item.room ?? null,
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item));

      if (!entries.length) {
        await db
          .update(timetableUploads)
          .set({
            processingStatus: "failed",
            errorMessage: "No valid timetable entries could be read from this file.",
          })
          .where(eq(timetableUploads.id, uploadRow.id));
        throw errors.validation("No valid timetable entries could be read. Try a clearer image.");
      }

      await db
        .update(timetableUploads)
        .set({ processingStatus: "completed", extractedData: { entries } })
        .where(eq(timetableUploads.id, uploadRow.id));

      sendSuccess(res, {
        uploadId: uploadRow.id,
        processingStatus: "completed",
        entries,
      });
    } catch (error) {
      await db
        .update(timetableUploads)
        .set({
          processingStatus: "failed",
          errorMessage: error instanceof Error ? error.message : "Extraction failed",
        })
        .where(eq(timetableUploads.id, uploadRow.id));
      throw error;
    }
  }),
);

router.post(
  "/confirm",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const body = confirmTimetableSchema.parse(req.body);
    const created = [];
    for (const entry of body.entries) {
      created.push(
        serializeEntry(
          await createEntry(user.id, {
            subject: entry.subject,
            code: entry.code,
            teacher: entry.teacher,
            dayOfWeek: entry.dayOfWeek,
            startTime: entry.startTime,
            endTime: entry.endTime,
            room: entry.room,
            reminderMinutes: entry.reminderMinutes ?? 15,
          }),
        ),
      );
    }
    if (body.uploadId) {
      await db
        .update(timetableUploads)
        .set({ processingStatus: "completed" })
        .where(and(eq(timetableUploads.id, body.uploadId), eq(timetableUploads.userId, user.id)));
    }
    sendSuccess(res, created, 201);
  }),
);

export default router;
