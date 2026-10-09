import { Router } from "express";
import multer from "multer";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { mcqHistory } from "@workspace/db/schema";
import { asyncHandler } from "../lib/asyncHandler";
import { requireUser } from "../lib/requireUser";
import { sendSuccess } from "../lib/response";
import { errors } from "../lib/errors";
import { requireAuth } from "../middleware/auth";
import { aiRateLimit } from "../middleware/rateLimit";
import { uuidParam } from "../validation/schemas";
import { analyzeMcqImage } from "../services/geminiService";
import { buckets, uploadPrivateFile } from "../services/storageService";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

const router = Router();
router.use(requireAuth);

router.post(
  "/",
  aiRateLimit,
  upload.single("image"),
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const file = req.file;
    if (!file) throw errors.validation("An image is required");
    if (!file.mimetype.startsWith("image/")) throw errors.validation("Upload an image of the question");

    const storagePath = `${user.id}/mcq/${Date.now()}.jpg`;
    await uploadPrivateFile({
      bucket: buckets.mcq,
      path: storagePath,
      body: file.buffer,
      contentType: file.mimetype,
    });

    const analysis = await analyzeMcqImage({
      mimeType: file.mimetype,
      data: file.buffer.toString("base64"),
    });

    const unreadable = !analysis.readable;
    const payload = {
      question: analysis.question,
      options: analysis.options,
      answer: unreadable ? null : analysis.answer,
      explanation: unreadable
        ? "Unable to clearly read the question. Please capture a clearer image."
        : analysis.explanation,
      confidence: unreadable ? 0 : analysis.confidence,
    };

    const [saved] = await db
      .insert(mcqHistory)
      .values({
        userId: user.id,
        imagePath: storagePath,
        question: payload.question,
        options: payload.options,
        answer: payload.answer,
        explanation: payload.explanation,
        confidence: payload.confidence != null ? String(payload.confidence) : null,
      })
      .returning();

    sendSuccess(res, { ...payload, id: saved?.id ?? null });
  }),
);

router.get(
  "/history",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const rows = await db
      .select()
      .from(mcqHistory)
      .where(eq(mcqHistory.userId, user.id))
      .orderBy(desc(mcqHistory.createdAt));
    sendSuccess(res, rows);
  }),
);

router.get(
  "/history/:id",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const { id } = uuidParam.parse(req.params);
    const [row] = await db
      .select()
      .from(mcqHistory)
      .where(and(eq(mcqHistory.id, id), eq(mcqHistory.userId, user.id)))
      .limit(1);
    if (!row) throw errors.notFound("MCQ history item not found");
    sendSuccess(res, row);
  }),
);

router.delete(
  "/history/:id",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const { id } = uuidParam.parse(req.params);
    const deleted = await db
      .delete(mcqHistory)
      .where(and(eq(mcqHistory.id, id), eq(mcqHistory.userId, user.id)))
      .returning({ id: mcqHistory.id });
    if (!deleted.length) throw errors.notFound("MCQ history item not found");
    sendSuccess(res, { id });
  }),
);

export default router;
