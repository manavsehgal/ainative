import { NextRequest, NextResponse } from "next/server";
import { homedir } from "os";
import { resolve } from "path";
import { existsSync } from "fs";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { isNotNull } from "drizzle-orm";
import { discoverWorkspaceSchema } from "@/lib/validators/workspace";
import { discoverWorkspace } from "@/lib/environment/discovery";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = discoverWorkspaceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Expand tilde
  let parentDir = parsed.data.parentDir;
  if (parentDir.startsWith("~/")) {
    parentDir = resolve(homedir(), parentDir.slice(2));
  } else if (parentDir === "~") {
    parentDir = homedir();
  }

  // Verify directory exists
  if (!existsSync(parentDir)) {
    return NextResponse.json(
      { error: `Directory not found: ${parentDir}` },
      { status: 400 }
    );
  }

  // Discover projects
  const result = discoverWorkspace({
    parentDir,
    maxDepth: parsed.data.maxDepth,
    markers: parsed.data.markers,
  });

  // Check which paths are already imported
  const existingProjects = await db
    .select({ workingDirectory: projects.workingDirectory })
    .from(projects)
    .where(isNotNull(projects.workingDirectory));

  const importedPaths = new Set(
    existingProjects
      .map((p) => p.workingDirectory)
      .filter((d): d is string => d !== null)
  );

  for (const project of result.projects) {
    project.alreadyImported = importedPaths.has(project.path);
  }

  return NextResponse.json(result);
}
