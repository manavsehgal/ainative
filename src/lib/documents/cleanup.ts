import { readdir, stat, unlink } from "fs/promises";
import { join } from "path";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { getStagentUploadsDir } from "@/lib/utils/stagent-paths";
import { eq } from "drizzle-orm";

const UPLOAD_DIR = getStagentUploadsDir();
const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function cleanupOrphanedUploads(): Promise<{
  deleted: string[];
  errors: string[];
}> {
  const deleted: string[] = [];
  const errors: string[] = [];

  try {
    const files = await readdir(UPLOAD_DIR);
    const now = Date.now();

    for (const filename of files) {
      const fileId = filename.split(".")[0];
      const filepath = join(UPLOAD_DIR, filename);

      try {
        const fileStat = await stat(filepath);
        const ageMs = now - fileStat.mtimeMs;

        if (ageMs < ORPHAN_AGE_MS) continue;

        const [doc] = await db
          .select()
          .from(documents)
          .where(eq(documents.id, fileId));

        if (!doc) {
          await unlink(filepath);
          deleted.push(filename);
        }
      } catch (err) {
        errors.push(`${filename}: ${err instanceof Error ? err.message : "unknown error"}`);
      }
    }
  } catch {
    // Upload directory may not exist yet
  }

  return { deleted, errors };
}
