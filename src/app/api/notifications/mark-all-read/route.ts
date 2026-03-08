import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH() {
  await db
    .update(notifications)
    .set({ read: true })
    .where(eq(notifications.read, false));

  return NextResponse.json({ success: true });
}
