import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/settings/helpers";
import { SETTINGS_KEYS } from "@/lib/constants/settings";

/**
 * GET /api/settings/ollama — Read Ollama settings.
 */
export async function GET() {
  const baseUrl = await getSetting(SETTINGS_KEYS.OLLAMA_BASE_URL);
  const defaultModel = await getSetting(SETTINGS_KEYS.OLLAMA_DEFAULT_MODEL);

  return NextResponse.json({
    baseUrl: baseUrl || "http://localhost:11434",
    defaultModel: defaultModel || "",
  });
}

/**
 * POST /api/settings/ollama — Update Ollama settings.
 * Body: { baseUrl?: string, defaultModel?: string }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.baseUrl !== undefined) {
    await setSetting(SETTINGS_KEYS.OLLAMA_BASE_URL, body.baseUrl);
  }

  if (body.defaultModel !== undefined) {
    await setSetting(SETTINGS_KEYS.OLLAMA_DEFAULT_MODEL, body.defaultModel);
  }

  return NextResponse.json({ ok: true });
}
