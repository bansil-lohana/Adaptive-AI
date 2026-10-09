import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { profiles } from "@workspace/db/schema";
import { asyncHandler } from "../lib/asyncHandler";
import { requireUser } from "../lib/requireUser";
import { sendSuccess } from "../lib/response";
import { errors } from "../lib/errors";
import { requireAuth } from "../middleware/auth";
import { profileUpdateSchema } from "../validation/schemas";
import { buckets, createSignedUrl, uploadPrivateFile } from "../services/storageService";
import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
});

const router = Router();
router.use(requireAuth);

async function getProfile(userId: string) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
  if (!profile) throw errors.notFound("Profile not found");
  let imageUrl = profile.profileImageUrl;
  if (imageUrl && !imageUrl.startsWith("http")) {
    imageUrl = await createSignedUrl(buckets.profile, imageUrl);
  }
  return { ...profile, profileImageUrl: imageUrl };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    sendSuccess(res, await getProfile(user.id));
  }),
);

router.put(
  "/",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const body = profileUpdateSchema.parse(req.body);
    const [updated] = await db
      .update(profiles)
      .set({
        ...(body.fullName !== undefined ? { fullName: body.fullName } : {}),
        ...(body.studentId !== undefined ? { studentId: body.studentId } : {}),
        ...(body.department !== undefined ? { department: body.department } : {}),
        ...(body.semester !== undefined ? { semester: body.semester } : {}),
      })
      .where(eq(profiles.id, user.id))
      .returning();
    if (!updated) throw errors.notFound("Profile not found");
    sendSuccess(res, await getProfile(user.id));
  }),
);

router.post(
  "/avatar",
  upload.single("image"),
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const file = req.file;
    if (!file) throw errors.validation("Profile image is required");
    if (!file.mimetype.startsWith("image/")) throw errors.validation("Avatar must be an image");
    const path = `${user.id}/avatar`;
    await uploadPrivateFile({
      bucket: buckets.profile,
      path,
      body: file.buffer,
      contentType: file.mimetype,
    });
    await db.update(profiles).set({ profileImageUrl: path }).where(eq(profiles.id, user.id));
    sendSuccess(res, await getProfile(user.id));
  }),
);

export default router;
