import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/settings/helpers";
import { SETTINGS_KEYS } from "@/lib/constants/settings";

export async function GET() {
  const contextCharLimit = await getSetting(
    SETTINGS_KEYS.LEARNING_CONTEXT_CHAR_LIMIT
  );
  return NextResponse.json({
    contextCharLimit: contextCharLimit ?? "8000",
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.contextCharLimit !== undefined) {
    const limit = parseInt(body.contextCharLimit, 10);
    if (isNaN(limit) || limit < 2000 || limit > 32000 || limit % 1000 !== 0) {
      return NextResponse.json(
        {
          error:
            "contextCharLimit must be between 2,000 and 32,000 (step 1,000)",
        },
        { status: 400 }
      );
    }
    await setSetting(
      SETTINGS_KEYS.LEARNING_CONTEXT_CHAR_LIMIT,
      String(limit)
    );
  }

  const contextCharLimit = await getSetting(
    SETTINGS_KEYS.LEARNING_CONTEXT_CHAR_LIMIT
  );

  return NextResponse.json({
    contextCharLimit: contextCharLimit ?? "8000",
  });
}
