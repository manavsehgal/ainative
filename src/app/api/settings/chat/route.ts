import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/settings/helpers";
import { DEFAULT_CHAT_MODEL, CHAT_MODELS } from "@/lib/chat/types";

const SETTINGS_KEY = "chat.defaultModel";

/**
 * GET /api/settings/chat
 * Return chat settings (default model).
 */
export async function GET() {
  const defaultModel =
    (await getSetting(SETTINGS_KEY)) ?? DEFAULT_CHAT_MODEL;
  return NextResponse.json({ defaultModel });
}

/**
 * PUT /api/settings/chat
 * Save chat settings.
 */
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { defaultModel } = body;

  if (defaultModel) {
    const valid = CHAT_MODELS.some((m) => m.id === defaultModel);
    if (!valid) {
      return NextResponse.json(
        { error: `Invalid model. Must be one of: ${CHAT_MODELS.map((m) => m.id).join(", ")}` },
        { status: 400 }
      );
    }
    await setSetting(SETTINGS_KEY, defaultModel);
  }

  return NextResponse.json({ defaultModel: defaultModel ?? DEFAULT_CHAT_MODEL });
}
