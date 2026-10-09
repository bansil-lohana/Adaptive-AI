import { and, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  reminders,
  subjects,
  timetableEntries,
  type Reminder,
  type Subject,
  type TimetableEntry,
} from "@workspace/db/schema";
import { errors } from "../lib/errors";
import { getNextClass } from "./nextClass";
import { normalizeTime } from "../lib/time";

export { getNextClass };

export type TimetableRecord = TimetableEntry & {
  subject: Subject | null;
  reminder: Reminder | null;
};

export function serializeEntry(entry: TimetableRecord) {
  return {
    id: entry.id,
    userId: entry.userId,
    subjectId: entry.subjectId,
    subject: entry.subject?.name ?? "",
    code: entry.subject?.code ?? null,
    dayOfWeek: entry.dayOfWeek,
    startTime: normalizeTime(entry.startTime),
    endTime: normalizeTime(entry.endTime),
    room: entry.room,
    teacher: entry.teacher ?? entry.subject?.teacher ?? null,
    semester: entry.semester,
    notes: entry.notes,
    reminderMinutes: entry.reminder?.minutesBefore ?? 15,
    enabled: entry.reminder?.enabled ?? true,
    reminderId: entry.reminder?.id ?? null,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

export async function listEntries(userId: string): Promise<TimetableRecord[]> {
  const rows = await db
    .select()
    .from(timetableEntries)
    .leftJoin(subjects, eq(subjects.id, timetableEntries.subjectId))
    .leftJoin(reminders, eq(reminders.timetableEntryId, timetableEntries.id))
    .where(eq(timetableEntries.userId, userId));

  return rows.map((row) => ({
    ...row.timetable_entries,
    subject: row.subjects,
    reminder: row.reminders,
  }));
}

export async function getNextClassForUser(
  userId: string,
  now = new Date(),
): Promise<TimetableRecord | null> {
  const entries = await listEntries(userId);
  return getNextClass(entries, now);
}

export async function getOwnedEntry(userId: string, id: string): Promise<TimetableRecord> {
  const [row] = await db
    .select()
    .from(timetableEntries)
    .leftJoin(subjects, eq(subjects.id, timetableEntries.subjectId))
    .leftJoin(reminders, eq(reminders.timetableEntryId, timetableEntries.id))
    .where(and(eq(timetableEntries.id, id), eq(timetableEntries.userId, userId)))
    .limit(1);
  if (!row) throw errors.notFound("Timetable entry not found");
  return { ...row.timetable_entries, subject: row.subjects, reminder: row.reminders };
}

export async function findOrCreateSubject(
  userId: string,
  input: { name: string; code?: string | null; teacher?: string | null; room?: string | null },
) {
  const existing = await db
    .select()
    .from(subjects)
    .where(eq(subjects.userId, userId));
  const match = existing.find(
    (item) => item.name.trim().toLowerCase() === input.name.trim().toLowerCase(),
  );
  if (match) return match;
  const [created] = await db
    .insert(subjects)
    .values({
      userId,
      name: input.name.trim(),
      code: input.code ?? null,
      teacher: input.teacher ?? null,
      defaultRoom: input.room ?? null,
    })
    .returning();
  if (!created) throw errors.database("Unable to create subject");
  return created;
}

export async function createEntry(
  userId: string,
  input: {
    subjectId?: string;
    subject?: string;
    code?: string | null;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    room?: string | null;
    teacher?: string | null;
    semester?: string | null;
    notes?: string | null;
    reminderMinutes?: number;
  },
) {
  if (normalizeTime(input.endTime) <= normalizeTime(input.startTime)) {
    throw errors.validation("endTime must be after startTime");
  }

  let subjectId = input.subjectId;
  if (subjectId) {
    const [owned] = await db
      .select()
      .from(subjects)
      .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)))
      .limit(1);
    if (!owned) throw errors.forbidden("Subject does not belong to this user");
  } else if (input.subject) {
    const subject = await findOrCreateSubject(userId, {
      name: input.subject,
      code: input.code,
      teacher: input.teacher,
      room: input.room,
    });
    subjectId = subject.id;
  } else {
    throw errors.validation("Provide subjectId or subject");
  }

  const [entry] = await db
    .insert(timetableEntries)
    .values({
      userId,
      subjectId,
      dayOfWeek: input.dayOfWeek,
      startTime: normalizeTime(input.startTime),
      endTime: normalizeTime(input.endTime),
      room: input.room ?? null,
      teacher: input.teacher ?? null,
      semester: input.semester ?? null,
      notes: input.notes ?? null,
    })
    .returning();
  if (!entry) throw errors.database("Unable to create timetable entry");

  await db.insert(reminders).values({
    userId,
    timetableEntryId: entry.id,
    minutesBefore: input.reminderMinutes ?? 15,
    enabled: true,
    notificationTitle: "Upcoming class",
    notificationBody: null,
  });

  return getOwnedEntry(userId, entry.id);
}
