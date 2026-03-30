import { NextRequest, NextResponse } from "next/server";
import { suggestRuntime } from "@/lib/agents/router";
import { getRoutingPreference } from "@/lib/settings/routing";
import { getRuntimeSetupStates } from "@/lib/settings/runtime-setup";
import { listConfiguredRuntimeIds } from "@/lib/settings/runtime-setup";
import type { AgentRuntimeId } from "@/lib/agents/runtime/catalog";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, description, profileId } = body;

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const preference = await getRoutingPreference();
  const runtimeStates = await getRuntimeSetupStates();
  const availableRuntimeIds = listConfiguredRuntimeIds(runtimeStates) as AgentRuntimeId[];

  const suggestion = suggestRuntime(
    title,
    description,
    profileId,
    availableRuntimeIds,
    preference,
  );

  return NextResponse.json(suggestion);
}
