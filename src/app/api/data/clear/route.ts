import { NextResponse } from "next/server";
import { clearAllData } from "@/lib/data/clear";

export async function POST() {
  try {
    const deleted = clearAllData();
    return NextResponse.json({ success: true, deleted });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
