import { Router } from "express";
import multer from "multer";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { aiConversations, aiMessages, mcqHistory } from "@workspace/db/schema";
import { asyncHandler } from "../lib/asyncHandler";
import { requireUser } from "../lib/requireUser";
import { sendSuccess } from "../lib/response";
import { errors } from "../lib/errors";
import { requireAuth } from "../middleware/auth";
import { aiRateLimit } from "../middleware/rateLimit";
import {
  chatBodySchema,
  conversationBodySchema,
  conversationMessageSchema,
  DAY_NAMES,
  aiPromptSchema,
  uuidParam,
  voiceTranscriptSchema,
} from "../validation/schemas";
import {
  analyzeMcqImage,
  answerFromAudioWithFallback,
  answerWithContext,
  explainStudyImage,
  generateText,
} from "../services/geminiService";
import { getNextClass, listEntries, serializeEntry } from "../services/timetableService";
import { buckets, uploadPrivateFile } from "../services/storageService";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

const router = Router();
router.use(requireAuth);

const CONTEXT_LIMIT = 12;

function isScheduleQuestion(message: string): boolean {
  return /\b(class|classes|schedule|timetable|next class|tomorrow|today|where is my|what do i have)\b/i.test(
    message,
  );
}

async function getOwnedConversation(userId: string, id: string) {
  const [conversation] = await db
    .select()
    .from(aiConversations)
    .where(and(eq(aiConversations.id, id), eq(aiConversations.userId, userId)))
    .limit(1);
  if (!conversation) throw errors.notFound("Conversation not found");
  return conversation;
}

async function recentMessages(conversationId: string) {
  const rows = await db
    .select()
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId))
    .orderBy(desc(aiMessages.createdAt))
    .limit(CONTEXT_LIMIT);
  return rows.reverse();
}

async function replyToMessage(userId: string, conversationId: string, message: string) {
  const history = await recentMessages(conversationId);
  let facts = "";
  if (isScheduleQuestion(message)) {
    const entries = await listEntries(userId);
    const now = new Date();
    const today = entries.filter((item) => item.dayOfWeek === now.getDay()).map(serializeEntry);
    const tomorrow = entries
      .filter((item) => item.dayOfWeek === (now.getDay() + 1) % 7)
      .map(serializeEntry);
    const next = getNextClass(entries, now);
    facts = JSON.stringify({
      now: now.toISOString(),
      todayName: DAY_NAMES[now.getDay()],
      today,
      tomorrow,
      nextClass: next ? serializeEntry(next) : null,
    });
  }

  const transcript = history
    .map((item) => `${item.role}: ${item.content}`)
    .join("\n")
    .slice(-6000);

  const prompt = isScheduleQuestion(message)
    ? `You are Adaptive AI, a student assistant.
Answer using ONLY the timetable facts below. Never invent classes, rooms, or times.
If the facts do not contain the answer, say you do not have that class in the saved timetable.

TIMETABLE FACTS:
${facts}

Recent conversation:
${transcript}

Student: ${message}`
    : `You are Adaptive AI, a helpful university study assistant.
Keep answers clear and practical. Do not invent the student's timetable.

Recent conversation:
${transcript}

Student: ${message}`;

  const answer = await answerWithContext(prompt);
  const [saved] = await db
    .insert(aiMessages)
    .values({ conversationId, role: "assistant", content: answer })
    .returning();
  await db
    .update(aiConversations)
    .set({
      ...(history.length <= 1 ? { title: message.slice(0, 80) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(aiConversations.id, conversationId));
  return saved;
}

router.post(
  "/chat",
  aiRateLimit,
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const body = chatBodySchema.parse(req.body);
    let conversationId = body.conversationId;
    if (conversationId) {
      await getOwnedConversation(user.id, conversationId);
    } else {
      const [created] = await db
        .insert(aiConversations)
        .values({ userId: user.id, title: body.message.slice(0, 80) })
        .returning();
      if (!created) throw errors.database("Unable to create conversation");
      conversationId = created.id;
    }
    await db.insert(aiMessages).values({
      conversationId,
      role: "user",
      content: body.message,
    });
    const assistant = await replyToMessage(user.id, conversationId, body.message);
    sendSuccess(res, {
      conversationId,
      message: assistant,
    });
  }),
);

router.get(
  "/conversations",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const rows = await db
      .select()
      .from(aiConversations)
      .where(eq(aiConversations.userId, user.id))
      .orderBy(desc(aiConversations.updatedAt));
    sendSuccess(res, rows);
  }),
);

router.post(
  "/conversations",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const body = conversationBodySchema.parse(req.body);
    const [created] = await db
      .insert(aiConversations)
      .values({ userId: user.id, title: body.title ?? "New conversation" })
      .returning();
    sendSuccess(res, created, 201);
  }),
);

router.get(
  "/conversations/:id",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const { id } = uuidParam.parse(req.params);
    const conversation = await getOwnedConversation(user.id, id);
    const messages = await db
      .select()
      .from(aiMessages)
      .where(eq(aiMessages.conversationId, id))
      .orderBy(aiMessages.createdAt);
    sendSuccess(res, { ...conversation, messages });
  }),
);

router.delete(
  "/conversations/:id",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const { id } = uuidParam.parse(req.params);
    const deleted = await db
      .delete(aiConversations)
      .where(and(eq(aiConversations.id, id), eq(aiConversations.userId, user.id)))
      .returning({ id: aiConversations.id });
    if (!deleted.length) throw errors.notFound("Conversation not found");
    sendSuccess(res, { id });
  }),
);

router.post(
  "/conversations/:id/messages",
  aiRateLimit,
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const { id } = uuidParam.parse(req.params);
    const body = conversationMessageSchema.parse(req.body);
    await getOwnedConversation(user.id, id);
    await db.insert(aiMessages).values({ conversationId: id, role: "user", content: body.content });
    const assistant = await replyToMessage(user.id, id, body.content);
    sendSuccess(res, assistant);
  }),
);

router.post(
  "/mcq",
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

router.post(
  ["/image", "/vision"],
  aiRateLimit,
  upload.single("image"),
  asyncHandler(async (req, res) => {
    requireUser(req);
    const file = req.file;
    if (!file) throw errors.validation("An image is required");
    if (!file.mimetype.startsWith("image/")) {
      throw errors.validation("Upload an image to explain");
    }

    const answer = await explainStudyImage({
      mimeType: file.mimetype,
      data: file.buffer.toString("base64"),
    });
    sendSuccess(res, { answer });
  }),
);

router.post(
  "/voice",
  aiRateLimit,
  upload.single("audio"),
  asyncHandler(async (req, res) => {
    requireUser(req);
    const file = req.file;
    const transcriptInput = req.body?.transcript === undefined
      ? null
      : voiceTranscriptSchema.parse({ transcript: req.body.transcript });
    if (!file && !transcriptInput) {
      throw errors.validation("Provide an audio recording or voice transcript");
    }
    if (file && !file.mimetype.startsWith("audio/")) {
      throw errors.validation("Upload a supported audio recording");
    }

    let answer: string;
    if (transcriptInput) {
      answer = await answerWithContext(
        `The student spoke this voice transcript. Answer their request clearly and practically:\n\n${transcriptInput.transcript}`,
      );
    } else if (file) {
      answer = await answerFromAudioWithFallback({
        mimeType: file.mimetype,
        data: file.buffer.toString("base64"),
      });
    } else {
      throw errors.validation("Provide an audio recording or voice transcript");
    }
    sendSuccess(res, { answer });
  }),
);

router.post(
  "/explain",
  aiRateLimit,
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const body = aiPromptSchema.parse(req.body);
    const answer = await generateText(
      `Explain this for a university student in clear language:\n\n${body.content}`,
    );
    sendSuccess(res, { answer, userId: user.id });
  }),
);

router.post(
  "/generate",
  aiRateLimit,
  asyncHandler(async (req, res) => {
    requireUser(req);
    const body = aiPromptSchema.parse(req.body);
    const answer = await generateText(body.content);
    sendSuccess(res, { answer });
  }),
);

export default router;
