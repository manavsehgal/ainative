import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/** Read a single setting from DB */
export async function getSetting(key: string): Promise<string | null> {
  const rows = await db.select().from(settings).where(eq(settings.key, key));
  return rows[0]?.value ?? null;
}

/** Upsert a setting in DB */
export async function setSetting(key: string, value: string): Promise<void> {
  const now = new Date();
  const existing = await getSetting(key);
  if (existing !== null) {
    await db.update(settings)
      .set({ value, updatedAt: now })
      .where(eq(settings.key, key));
  } else {
    await db.insert(settings)
      .values({ key, value, updatedAt: now });
  }
}
