import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { mcqHistory, profiles } from "@workspace/db/schema";
import { asyncHandler } from "../lib/asyncHandler";
import { requireUser } from "../lib/requireUser";
import { sendSuccess } from "../lib/response";
import { errors } from "../lib/errors";
import { requireAuth } from "../middleware/auth";
import { getNextClass, listEntries, serializeEntry } from "../services/timetableService";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);
    if (!profile) throw errors.notFound("Profile not found");
    const entries = await listEntries(user.id);
    const today = new Date().getDay();
    const todayClasses = entries.filter((item) => item.dayOfWeek === today).map(serializeEntry);
    const nextClass = getNextClass(entries);
    const upcomingReminders = entries
      .filter((item) => item.reminder?.enabled)
      .map(serializeEntry)
      .slice(0, 8);
    const recentMcq = await db
      .select()
      .from(mcqHistory)
      .where(eq(mcqHistory.userId, user.id))
      .orderBy(desc(mcqHistory.createdAt))
      .limit(5);

    sendSuccess(res, {
      profile: {
        id: profile.id,
        fullName: profile.fullName,
        email: profile.email,
        studentId: profile.studentId,
        department: profile.department,
        semester: profile.semester,
        profileImageUrl: profile.profileImageUrl,
      },
      todayClasses,
      nextClass: nextClass ? serializeEntry(nextClass) : null,
      upcomingReminders,
      recentMcq,
    });
  }),
);

export default router;
