import { NextResponse } from "next/server";
import { seedSampleData } from "@/lib/data/seed";

export async function POST() {
  try {
    const seeded = await seedSampleData();
    return NextResponse.json({ success: true, seeded });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
