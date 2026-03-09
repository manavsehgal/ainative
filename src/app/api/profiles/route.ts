import { NextResponse } from "next/server";
import { listProfiles } from "@/lib/agents/profiles/registry";

export async function GET() {
  return NextResponse.json(listProfiles());
}
