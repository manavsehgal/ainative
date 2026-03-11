import { NextRequest, NextResponse } from "next/server";
import {
  getOpenAIAuthSettings,
  setOpenAIAuthSettings,
} from "@/lib/settings/openai-auth";
import { updateOpenAISettingsSchema } from "@/lib/validators/settings";

export async function GET() {
  const settings = await getOpenAIAuthSettings();
  return NextResponse.json(settings);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = updateOpenAISettingsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await setOpenAIAuthSettings(parsed.data);
  const updated = await getOpenAIAuthSettings();
  return NextResponse.json(updated);
}
