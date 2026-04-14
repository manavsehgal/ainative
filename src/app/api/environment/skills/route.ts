import { NextResponse } from "next/server";
import { listSkillsEnriched } from "@/lib/environment/list-skills";

export async function GET() {
  try {
    return NextResponse.json(listSkillsEnriched());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "scan failed" },
      { status: 500 }
    );
  }
}
