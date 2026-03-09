import { NextResponse } from "next/server";
import { cleanupOrphanedUploads } from "@/lib/documents/cleanup";

export async function POST() {
  const result = await cleanupOrphanedUploads();
  return NextResponse.json(result);
}
