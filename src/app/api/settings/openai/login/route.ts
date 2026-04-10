import { NextResponse } from "next/server";
import {
  cancelOpenAIChatGPTLogin,
  getOpenAILoginState,
  startOpenAIChatGPTLogin,
} from "@/lib/settings/openai-login-manager";
import { setOpenAIAuthSettings } from "@/lib/settings/openai-auth";

export async function GET() {
  return NextResponse.json(getOpenAILoginState());
}

export async function POST() {
  await setOpenAIAuthSettings({ method: "oauth" });
  const state = await startOpenAIChatGPTLogin();
  return NextResponse.json(state);
}

export async function DELETE() {
  const state = await cancelOpenAIChatGPTLogin();
  return NextResponse.json(state);
}
