import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { getLaunchCwd } from "@/lib/environment/workspace-context";
import { searchFiles } from "@/lib/chat/files/search";

/**
 * GET /api/chat/files/search?q=&projectId=&limit=20
 *
 * Returns files under the active project's workingDirectory (if a valid
 * projectId is supplied), else under the stagent launch cwd. The client
 * never supplies cwd directly — that would let a hostile prompt or XSS
 * reach arbitrary paths on disk.
 *
 * Results respect `.gitignore` via `git ls-files --exclude-standard`.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";

  const limitRaw = parseInt(searchParams.get("limit") ?? "20", 10);
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(50, limitRaw))
    : 20;

  const projectId = searchParams.get("projectId");

  let cwd = getLaunchCwd();
  if (projectId) {
    const project = await db
      .select({ workingDirectory: projects.workingDirectory })
      .from(projects)
      .where(eq(projects.id, projectId))
      .get();
    if (project?.workingDirectory) {
      cwd = project.workingDirectory;
    }
  }

  try {
    const results = searchFiles(cwd, q, limit);
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "file search failed" },
      { status: 500 }
    );
  }
}
