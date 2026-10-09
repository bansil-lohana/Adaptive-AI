import { errors } from "../lib/errors";
import { getSupabaseAdmin } from "../lib/supabase";

export const buckets = {
  profile: "profile-images",
  timetable: "timetable-files",
  mcq: "mcq-images",
} as const;

export async function uploadPrivateFile(input: {
  bucket: string;
  path: string;
  body: Buffer;
  contentType: string;
}) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(input.bucket).upload(input.path, input.body, {
    contentType: input.contentType,
    upsert: true,
  });
  if (error) {
    throw errors.storage(error.message);
  }
  return input.path;
}

export async function createSignedUrl(bucket: string, path: string, expiresIn = 60 * 60) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) throw errors.storage(error.message);
  return data.signedUrl;
}
