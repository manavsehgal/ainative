/**
 * Environment sync engine orchestrator.
 * Coordinates preview → checkpoint → execute → log for all sync operations.
 */

import { mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";
import { getArtifactById, insertCheckpoint, insertSyncOp } from "./data";
import { createGitCheckpoint, isGitRepo } from "./git-manager";
import { backupFiles } from "./backup-manager";
import { getLaunchCwd } from "./workspace-context";
import { generateDiff, generateNewFileDiff } from "./diff";
import { prepareSkillSync, executeSkillSync } from "./sync/skill-sync";
import { prepareMcpSync } from "./sync/mcp-sync";
import { prepareInstructionSync } from "./sync/instruction-sync";
import { preparePermissionSync } from "./sync/permission-sync";
import { prepareHookSync } from "./sync/hook-sync";
import { safeReadFile } from "./parsers/utils";
import type { SyncOperation } from "./sync/skill-sync";
import type { DiffResult } from "./diff";

export interface SyncRequest {
  artifactId: string;
  operation: "create" | "update" | "delete" | "sync";
  targetTool: string;
  targetPath?: string;
}

export interface SyncPreviewItem {
  artifactId: string;
  artifactName: string;
  category: string;
  operation: string;
  targetTool: string;
  targetPath: string;
  diff: DiffResult;
  hasConflict: boolean;
  syncOp: SyncOperation;
}

export interface SyncExecuteResult {
  checkpointId: string;
  operations: Array<{
    artifactId: string;
    status: "applied" | "failed";
    targetPath: string;
    error?: string;
  }>;
}

/**
 * Preview sync operations — dry run that returns diffs without modifying files.
 */
export function previewSync(requests: SyncRequest[]): SyncPreviewItem[] {
  const previews: SyncPreviewItem[] = [];

  for (const req of requests) {
    const artifact = getArtifactById(req.artifactId);
    if (!artifact) continue;

    let syncOp: SyncOperation | null = null;
    const targetPath = req.targetPath;

    // Route to the appropriate sync module based on category
    switch (artifact.category) {
      case "skill":
        syncOp = prepareSkillSync(artifact, req.targetTool);
        break;
      case "mcp-server":
        syncOp = prepareMcpSync(artifact, req.targetTool);
        break;
      case "instruction":
      case "memory":
        if (targetPath) {
          syncOp = prepareInstructionSync(artifact, targetPath);
        }
        break;
      case "permission":
        if (targetPath) {
          syncOp = preparePermissionSync(artifact, targetPath);
        }
        break;
      case "hook":
        if (targetPath) {
          syncOp = prepareHookSync(artifact, targetPath);
        }
        break;
    }

    if (!syncOp) continue;

    // Generate diff
    const diff = syncOp.isNew
      ? generateNewFileDiff(syncOp.content, syncOp.targetPath)
      : generateDiff(
          syncOp.existingContent || "",
          syncOp.content,
          syncOp.targetPath,
          syncOp.targetPath
        );

    previews.push({
      artifactId: artifact.id,
      artifactName: artifact.name,
      category: artifact.category,
      operation: req.operation,
      targetTool: req.targetTool,
      targetPath: syncOp.targetPath,
      diff,
      hasConflict: !syncOp.isNew && !diff.identical,
      syncOp,
    });
  }

  return previews;
}

/**
 * Execute sync operations with auto-checkpoint.
 * 1. Creates checkpoint (git tag + file backup)
 * 2. Writes files
 * 3. Logs operations to environment_sync_ops
 */
export function executeSync(
  previews: SyncPreviewItem[],
  label?: string
): SyncExecuteResult {
  const checkpointLabel = label || `Sync ${previews.length} artifact(s)`;

  // Step 1: Create checkpoint
  const projectDir = getLaunchCwd();
  let gitTag: string | undefined;
  let gitCommitSha: string | undefined;
  let backupPath: string | undefined;

  if (isGitRepo(projectDir)) {
    const gitResult = createGitCheckpoint(projectDir, checkpointLabel, "pre-sync");
    if (gitResult) {
      gitTag = gitResult.tag;
      gitCommitSha = gitResult.commitSha;
    }
  }

  // Backup any global files that will be affected
  const globalPaths = previews
    .filter((p) => p.syncOp.existingContent !== null)
    .map((p) => p.syncOp.targetPath)
    .filter((p) => !p.startsWith(projectDir));

  if (globalPaths.length > 0) {
    const backup = backupFiles(globalPaths, checkpointLabel);
    backupPath = backup.backupPath;
  }

  const checkpoint = insertCheckpoint({
    label: checkpointLabel,
    checkpointType: "pre-sync",
    gitTag,
    gitCommitSha,
    backupPath,
    filesCount: previews.length,
  });

  // Step 2: Execute operations
  const operations: SyncExecuteResult["operations"] = [];

  for (const preview of previews) {
    try {
      // Write the file
      mkdirSync(dirname(preview.syncOp.targetPath), { recursive: true });
      writeFileSync(preview.syncOp.targetPath, preview.syncOp.content, "utf-8");

      // Log success
      insertSyncOp({
        checkpointId: checkpoint.id,
        artifactId: preview.artifactId,
        operation: preview.operation as "create" | "update" | "delete" | "sync",
        targetTool: preview.targetTool,
        targetPath: preview.syncOp.targetPath,
        diffPreview: preview.diff.diff.slice(0, 2000),
      });

      operations.push({
        artifactId: preview.artifactId,
        status: "applied",
        targetPath: preview.syncOp.targetPath,
      });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);

      insertSyncOp({
        checkpointId: checkpoint.id,
        artifactId: preview.artifactId,
        operation: preview.operation as "create" | "update" | "delete" | "sync",
        targetTool: preview.targetTool,
        targetPath: preview.syncOp.targetPath,
        diffPreview: error,
      });

      operations.push({
        artifactId: preview.artifactId,
        status: "failed",
        targetPath: preview.syncOp.targetPath,
        error,
      });
    }
  }

  return { checkpointId: checkpoint.id, operations };
}
