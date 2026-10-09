import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  time,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  studentId: text("student_id"),
  department: text("department"),
  semester: integer("semester"),
  profileImageUrl: text("profile_image_url"),
  ...timestamps,
});

export const subjects = pgTable(
  "subjects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: text("code"),
    teacher: text("teacher"),
    defaultRoom: text("default_room"),
    ...timestamps,
  },
  (table) => [index("subjects_user_id_idx").on(table.userId)],
);

export const timetableEntries = pgTable(
  "timetable_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    dayOfWeek: integer("day_of_week").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    room: text("room"),
    teacher: text("teacher"),
    semester: text("semester"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    check("timetable_day_of_week_check", sql`${table.dayOfWeek} between 0 and 6`),
    check("timetable_time_order_check", sql`${table.endTime} > ${table.startTime}`),
    index("timetable_entries_user_id_idx").on(table.userId),
    index("timetable_entries_subject_id_idx").on(table.subjectId),
    index("timetable_entries_day_idx").on(table.dayOfWeek),
    index("timetable_entries_user_day_idx").on(table.userId, table.dayOfWeek),
  ],
);

export const reminders = pgTable(
  "reminders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    timetableEntryId: uuid("timetable_entry_id")
      .notNull()
      .references(() => timetableEntries.id, { onDelete: "cascade" }),
    minutesBefore: integer("minutes_before").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    notificationTitle: text("notification_title"),
    notificationBody: text("notification_body"),
    ...timestamps,
  },
  (table) => [
    check("reminders_minutes_before_check", sql`${table.minutesBefore} > 0`),
    index("reminders_user_id_idx").on(table.userId),
    index("reminders_entry_id_idx").on(table.timetableEntryId),
  ],
);

export const timetableUploads = pgTable(
  "timetable_uploads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    storagePath: text("storage_path"),
    fileType: text("file_type"),
    processingStatus: text("processing_status").notNull().default("pending"),
    extractedData: jsonb("extracted_data"),
    errorMessage: text("error_message"),
    ...timestamps,
  },
  (table) => [index("timetable_uploads_user_id_idx").on(table.userId)],
);

export const mcqHistory = pgTable(
  "mcq_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    imagePath: text("image_path"),
    question: text("question"),
    options: jsonb("options"),
    answer: text("answer"),
    explanation: text("explanation"),
    confidence: numeric("confidence"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("mcq_history_user_id_idx").on(table.userId),
    index("mcq_history_created_at_idx").on(table.createdAt),
  ],
);

export const aiConversations = pgTable(
  "ai_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    title: text("title"),
    ...timestamps,
  },
  (table) => [index("ai_conversations_user_id_idx").on(table.userId)],
);

export const aiMessages = pgTable(
  "ai_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => aiConversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ai_messages_conversation_id_idx").on(table.conversationId),
    index("ai_messages_created_at_idx").on(table.createdAt),
  ],
);

export const profilesRelations = relations(profiles, ({ many }) => ({
  subjects: many(subjects),
  timetableEntries: many(timetableEntries),
  reminders: many(reminders),
  timetableUploads: many(timetableUploads),
  mcqHistory: many(mcqHistory),
  aiConversations: many(aiConversations),
}));

export const subjectsRelations = relations(subjects, ({ one, many }) => ({
  profile: one(profiles, { fields: [subjects.userId], references: [profiles.id] }),
  timetableEntries: many(timetableEntries),
}));

export const timetableEntriesRelations = relations(timetableEntries, ({ one, many }) => ({
  profile: one(profiles, { fields: [timetableEntries.userId], references: [profiles.id] }),
  subject: one(subjects, { fields: [timetableEntries.subjectId], references: [subjects.id] }),
  reminders: many(reminders),
}));

export const remindersRelations = relations(reminders, ({ one }) => ({
  profile: one(profiles, { fields: [reminders.userId], references: [profiles.id] }),
  timetableEntry: one(timetableEntries, {
    fields: [reminders.timetableEntryId],
    references: [timetableEntries.id],
  }),
}));

export const aiConversationsRelations = relations(aiConversations, ({ one, many }) => ({
  profile: one(profiles, { fields: [aiConversations.userId], references: [profiles.id] }),
  messages: many(aiMessages),
}));

export const aiMessagesRelations = relations(aiMessages, ({ one }) => ({
  conversation: one(aiConversations, {
    fields: [aiMessages.conversationId],
    references: [aiConversations.id],
  }),
}));

export type Profile = typeof profiles.$inferSelect;
export type Subject = typeof subjects.$inferSelect;
export type TimetableEntry = typeof timetableEntries.$inferSelect;
export type Reminder = typeof reminders.$inferSelect;
export type TimetableUpload = typeof timetableUploads.$inferSelect;
export type McqHistoryItem = typeof mcqHistory.$inferSelect;
export type AiConversation = typeof aiConversations.$inferSelect;
export type AiMessage = typeof aiMessages.$inferSelect;
