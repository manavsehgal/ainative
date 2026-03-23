import { NextRequest, NextResponse } from "next/server";
import {
  insertCheckpoint,
  getCheckpoints,
} from "@/lib/environment/data";
import { createGitCheckpoint, isGitRepo, getCurrentCommit } from "@/lib/environment/git-manager";
import { backupFiles, backupDirectory } from "@/lib/environment/backup-manager";
import { homedir } from "os";
import { join } from "path";
import { getLaunchCwd } from "@/lib/environment/workspace-context";

/** GET: List checkpoints, optionally filtered by projectId. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");

  const checkpoints = getCheckpoints(projectId || undefined);
  return NextResponse.json({ checkpoints });
}

/** POST: Create a new checkpoint. */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    label: string;
    checkpointType?: "pre-sync" | "manual" | "pre-onboard";
    projectDir?: string;
    globalPaths?: string[];
  };

  const label = body.label || `Manual checkpoint ${new Date().toISOString()}`;
  const checkpointType = body.checkpointType || "manual";
  const projectDir = body.projectDir || getLaunchCwd();

  let gitTag: string | undefined;
  let gitCommitSha: string | undefined;
  let backupPath: string | undefined;
  let filesCount = 0;

  // Git checkpoint for project-level files
  if (isGitRepo(projectDir)) {
    const result = createGitCheckpoint(projectDir, label, checkpointType);
    if (result) {
      gitTag = result.tag;
      gitCommitSha = result.commitSha;
      filesCount++;
    }
  }

  // File backup for global paths
  if (body.globalPaths && body.globalPaths.length > 0) {
    const backup = backupFiles(body.globalPaths, label);
    backupPath = backup.backupPath;
    filesCount += backup.filesCount;
  } else {
    // Default: backup common global config files
    const home = homedir();
    const defaultPaths = [
      join(home, ".claude", "settings.json"),
      join(home, ".claude", "settings.local.json"),
      join(home, ".claude", ".mcp.json"),
      join(home, ".codex", "config.toml"),
    ];
    const backup = backupFiles(defaultPaths, label);
    if (backup.filesCount > 0) {
      backupPath = backup.backupPath;
      filesCount += backup.filesCount;
    }
  }

  const checkpoint = insertCheckpoint({
    label,
    checkpointType,
    gitTag,
    gitCommitSha,
    backupPath,
    filesCount,
  });

  return NextResponse.json({ checkpoint });
}
