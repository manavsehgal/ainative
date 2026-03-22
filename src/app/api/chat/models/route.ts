import { NextResponse } from "next/server";
import { discoverModels } from "@/lib/chat/model-discovery";

/**
 * GET /api/chat/models
 * Return available chat models discovered from configured SDKs.
 * Falls back to hardcoded list if SDKs are unreachable.
 */
export async function GET() {
  const models = await discoverModels();
  return NextResponse.json(models);
}
