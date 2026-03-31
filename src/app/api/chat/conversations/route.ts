import { NextRequest, NextResponse } from "next/server";
import {
  createConversation,
  listConversations,
} from "@/lib/data/chat";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ensureFreshScan } from "@/lib/environment/auto-scan";

/**
 * GET /api/chat/conversations?status=active&projectId=xxx&limit=50
 * List conversations with optional filters.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status") as "active" | "archived" | null;
  const projectId = searchParams.get("projectId") ?? undefined;
  const limit = searchParams.get("limit")
    ? parseInt(searchParams.get("limit")!, 10)
    : undefined;

  const rows = await listConversations({
    status: status ?? undefined,
    projectId,
    limit,
  });

  return NextResponse.json(rows);
}

/**
 * POST /api/chat/conversations
 * Create a new conversation.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { projectId, title, runtimeId, modelId } = body;

  if (!runtimeId) {
    return NextResponse.json(
      { error: "runtimeId is required" },
      { status: 400 }
    );
  }

  const validRuntimes = ["claude-code", "openai-codex-app-server"];
  if (!validRuntimes.includes(runtimeId)) {
    return NextResponse.json(
      { error: `Invalid runtimeId. Must be one of: ${validRuntimes.join(", ")}` },
      { status: 400 }
    );
  }

  // Auto-scan environment when starting a conversation for a project
  if (projectId) {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));
    if (project?.workingDirectory) {
      ensureFreshScan(project.workingDirectory, projectId);
    }
  }

  const conversation = await createConversation({
    projectId: projectId ?? null,
    title: title ?? null,
    runtimeId,
    modelId: modelId ?? null,
  });

  return NextResponse.json(conversation, { status: 201 });
}
