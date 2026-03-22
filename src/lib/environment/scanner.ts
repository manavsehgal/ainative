/**
 * Environment scanner orchestrator.
 * Detects installed tools, runs per-tool scanners, deduplicates shared artifacts.
 */

import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { EnvironmentArtifact, ScanOptions, ScanResult, ToolPersona } from "./types";
import { scanClaudeCode } from "./scanners/claude-code";
import { scanCodex } from "./scanners/codex";

/** Detect which tool personas are present on this system. */
function detectPersonas(userHome: string, projectDir: string): ToolPersona[] {
  const personas: ToolPersona[] = [];

  const hasClaudeCode =
    existsSync(join(userHome, ".claude")) ||
    existsSync(join(projectDir, ".claude"));

  const hasCodex = existsSync(join(userHome, ".codex"));

  if (hasClaudeCode) personas.push("claude-code");
  if (hasCodex) personas.push("codex");

  return personas;
}

/**
 * Post-merge pass: detect artifacts that exist in both Claude Code and Codex
 * (same name + same category) and mark them as "shared".
 */
function deduplicateSharedArtifacts(
  artifacts: EnvironmentArtifact[]
): EnvironmentArtifact[] {
  const byKey = new Map<string, EnvironmentArtifact[]>();

  for (const artifact of artifacts) {
    const key = `${artifact.category}:${artifact.name}`;
    const group = byKey.get(key) || [];
    group.push(artifact);
    byKey.set(key, group);
  }

  const result: EnvironmentArtifact[] = [];

  for (const [, group] of byKey) {
    if (group.length <= 1) {
      result.push(...group);
      continue;
    }

    // Check if artifacts span multiple tools
    const tools = new Set(group.map((a) => a.tool));
    if (tools.size > 1) {
      // Keep the most recently modified one, mark as shared
      const sorted = group.sort((a, b) => b.modifiedAt - a.modifiedAt);
      const primary = { ...sorted[0], tool: "shared" as ToolPersona };
      primary.metadata = {
        ...primary.metadata,
        sharedWith: group.map((a) => a.tool),
        allPaths: group.map((a) => a.absPath),
      };
      result.push(primary);
    } else {
      // Same tool, different scopes — keep all
      result.push(...group);
    }
  }

  return result;
}

/** Run a full environment scan. */
export function scanEnvironment(options?: Partial<ScanOptions>): ScanResult {
  const start = performance.now();

  const userHome = options?.userHome || homedir();
  const projectDir = options?.projectDir || process.cwd();
  const personas = detectPersonas(userHome, projectDir);

  let allArtifacts: EnvironmentArtifact[] = [];
  const allErrors: Array<{ path: string; error: string }> = [];

  // Run applicable scanners
  if (personas.includes("claude-code")) {
    const result = scanClaudeCode(projectDir, userHome);
    allArtifacts.push(...result.artifacts);
    allErrors.push(...result.errors);
  }

  if (personas.includes("codex")) {
    const result = scanCodex(projectDir, userHome);
    allArtifacts.push(...result.artifacts);
    allErrors.push(...result.errors);
  }

  // Deduplicate shared artifacts
  allArtifacts = deduplicateSharedArtifacts(allArtifacts);

  // Sort by category, then name
  allArtifacts.sort((a, b) => {
    const catCmp = a.category.localeCompare(b.category);
    return catCmp !== 0 ? catCmp : a.name.localeCompare(b.name);
  });

  // Add "shared" persona if any shared artifacts exist
  const finalPersonas = [...personas];
  if (allArtifacts.some((a) => a.tool === "shared") && !finalPersonas.includes("shared")) {
    finalPersonas.push("shared");
  }

  return {
    personas: finalPersonas,
    artifacts: allArtifacts,
    errors: allErrors,
    durationMs: Math.round(performance.now() - start),
  };
}
