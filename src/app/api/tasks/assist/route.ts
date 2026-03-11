import { NextRequest, NextResponse } from "next/server";
import { runTaskAssistWithRuntime } from "@/lib/agents/runtime";
import type { TaskAssistResponse } from "@/lib/agents/runtime/task-assist-types";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, description, assignedAgent } = body as {
    title?: string;
    description?: string;
    assignedAgent?: string;
  };

  if (!title?.trim() && !description?.trim()) {
    return NextResponse.json(
      { error: "Provide at least a title or description" },
      { status: 400 }
    );
  }

  try {
    const parsed: TaskAssistResponse = await runTaskAssistWithRuntime(
      { title, description },
      assignedAgent
    );
    return NextResponse.json(parsed);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AI assist failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
