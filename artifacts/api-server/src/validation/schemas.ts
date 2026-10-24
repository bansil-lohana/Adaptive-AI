import { z } from "zod";

export const uuidParam = z.object({
  id: z.string().uuid(),
});

export const dayParam = z.object({
  day: z.coerce.number().int().min(0).max(6),
});

const hhmm = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:MM")
  .or(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/));

export const profileUpdateSchema = z.object({
  fullName: z.string().trim().min(1).max(120).optional(),
  studentId: z.string().trim().max(64).nullable().optional(),
  department: z.string().trim().max(120).nullable().optional(),
  semester: z.number().int().min(1).max(16).nullable().optional(),
});

export const subjectBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().max(32).nullable().optional(),
  teacher: z.string().trim().max(120).nullable().optional(),
  defaultRoom: z.string().trim().max(64).nullable().optional(),
});

export const subjectUpdateSchema = subjectBodySchema.partial();

export const timetableBodySchema = z
  .object({
    subjectId: z.string().uuid().optional(),
    subject: z.string().trim().min(1).max(120).optional(),
    code: z.string().trim().max(32).nullable().optional(),
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: hhmm,
    endTime: hhmm,
    room: z.string().trim().max(64).nullable().optional(),
    teacher: z.string().trim().max(120).nullable().optional(),
    semester: z.string().trim().max(64).nullable().optional(),
    notes: z.string().trim().max(500).nullable().optional(),
    reminderMinutes: z.number().int().min(1).max(180).optional(),
  })
  .refine((value) => Boolean(value.subjectId || value.subject), {
    message: "Provide subjectId or subject",
  })
  .refine((value) => value.endTime > value.startTime, {
    message: "endTime must be after startTime",
    path: ["endTime"],
  });

export const timetableUpdateSchema = z.object({
  subjectId: z.string().uuid().optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  startTime: hhmm.optional(),
  endTime: hhmm.optional(),
  room: z.string().trim().max(64).nullable().optional(),
  teacher: z.string().trim().max(120).nullable().optional(),
  semester: z.string().trim().max(64).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const reminderBodySchema = z.object({
  timetableEntryId: z.string().uuid(),
  minutesBefore: z.number().int().min(1).max(180),
  enabled: z.boolean().optional(),
  notificationTitle: z.string().trim().max(120).nullable().optional(),
  notificationBody: z.string().trim().max(240).nullable().optional(),
});

export const reminderUpdateSchema = reminderBodySchema.partial().extend({
  timetableEntryId: z.string().uuid().optional(),
});

export const extractedEntrySchema = z.object({
  subject: z.string().trim().min(1).max(120),
  code: z.string().trim().max(32).nullable().optional(),
  teacher: z.string().trim().max(120).nullable().optional(),
  day: z.string().trim().min(1),
  startTime: z.string().trim().min(4).max(8),
  endTime: z.string().trim().min(4).max(8),
  room: z.string().trim().max(64).nullable().optional(),
});

export const extractedTimetableSchema = z.object({
  entries: z.array(extractedEntrySchema).max(80),
});

export const confirmTimetableSchema = z.object({
  uploadId: z.string().uuid().optional(),
  entries: z.array(
    z.object({
      subject: z.string().trim().min(1).max(120),
      code: z.string().trim().max(32).nullable().optional(),
      teacher: z.string().trim().max(120).nullable().optional(),
      dayOfWeek: z.number().int().min(0).max(6),
      startTime: hhmm,
      endTime: hhmm,
      room: z.string().trim().max(64).nullable().optional(),
      reminderMinutes: z.number().int().min(1).max(180).optional(),
    }),
  ).min(1).max(80),
});

export const chatBodySchema = z.object({
  message: z.string().trim().min(1).max(4000),
  conversationId: z.string().uuid().optional(),
});

export const voiceTranscriptSchema = z.object({
  transcript: z.string().trim().min(1).max(4000),
});

export const conversationBodySchema = z.object({
  title: z.string().trim().max(120).optional(),
});

export const conversationMessageSchema = z.object({
  content: z.string().trim().min(1).max(4000),
});

export const aiPromptSchema = z.object({
  content: z.string().trim().min(1).max(600_000),
});

export const mcqResultSchema = z.object({
  readable: z.boolean(),
  question: z.string().nullable(),
  options: z.array(z.string()).max(8),
  answer: z.string().nullable(),
  explanation: z.string().nullable(),
  confidence: z.number().min(0).max(1).nullable(),
});

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export function parseDayName(value: string): number | null {
  const normalized = value.trim().toLowerCase();
  const index = DAY_NAMES.findIndex((day) => day.toLowerCase() === normalized || day.toLowerCase().startsWith(normalized.slice(0, 3)));
  return index >= 0 ? index : null;
}

export function parseClock(value: string): string | null {
  const trimmed = value.trim().toUpperCase();
  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (match12) {
    let hours = Number(match12[1]);
    const minutes = match12[2];
    const meridiem = match12[3];
    if (meridiem === "PM" && hours < 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;
    return `${String(hours).padStart(2, "0")}:${minutes}`;
  }
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match24) return null;
  const hours = Number(match24[1]);
  const minutes = match24[2];
  if (hours > 23) return null;
  return `${String(hours).padStart(2, "0")}:${minutes}`;
}
