import { NextRequest, NextResponse } from "next/server";
import { createProfileFromSuggestion } from "@/lib/environment/profile-generator";
import type { ProfileSuggestion } from "@/lib/environment/profile-rules";

/** POST: Create a profile from a suggestion. */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    suggestion: ProfileSuggestion;
    overrides?: { name?: string; description?: string; systemPrompt?: string };
  };

  if (!body.suggestion) {
    return NextResponse.json({ error: "suggestion is required" }, { status: 400 });
  }

  try {
    createProfileFromSuggestion(body.suggestion, body.overrides);
    return NextResponse.json({
      message: `Profile "${body.suggestion.name}" created`,
      profileId: `env-${body.suggestion.ruleId}`,
    }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400 }
    );
  }
}
