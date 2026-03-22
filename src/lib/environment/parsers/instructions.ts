/**
 * Parse instruction files: CLAUDE.md, AGENTS.md, MEMORY.md, and similar.
 */

import type { EnvironmentArtifact, ToolPersona, ArtifactScope, ArtifactCategory } from "../types";
import { computeHash, safePreview, safeStat, safeReadFile } from "./utils";

interface InstructionTarget {
  fileName: string;
  category: ArtifactCategory;
  tool: ToolPersona;
}

const INSTRUCTION_FILES: InstructionTarget[] = [
  { fileName: "CLAUDE.md", category: "instruction", tool: "claude-code" },
  { fileName: "AGENTS.md", category: "instruction", tool: "shared" },
  { fileName: "MEMORY.md", category: "memory", tool: "shared" },
  { fileName: "GEMINI.md", category: "instruction", tool: "shared" },
];

/** Parse a single instruction-like file. */
export function parseInstructionFile(
  filePath: string,
  scope: ArtifactScope,
  baseDir: string,
  overrideTool?: ToolPersona
): EnvironmentArtifact | null {
  const content = safeReadFile(filePath);
  if (!content) return null;

  const stat = safeStat(filePath);
  if (!stat) return null;

  // Match against known instruction files
  const fileName = filePath.split("/").pop() || "";
  const target = INSTRUCTION_FILES.find((t) => t.fileName === fileName);

  return {
    tool: overrideTool || target?.tool || "shared",
    category: target?.category || "instruction",
    scope,
    name: fileName,
    relPath: filePath.replace(baseDir, "").replace(/^\//, ""),
    absPath: filePath,
    contentHash: computeHash(content),
    preview: safePreview(content),
    metadata: { lineCount: content.split("\n").length },
    sizeBytes: stat.size,
    modifiedAt: stat.mtimeMs,
  };
}

/** Scan a directory for known instruction files. */
export function scanInstructionFiles(
  dirPath: string,
  scope: ArtifactScope,
  baseDir: string
): EnvironmentArtifact[] {
  const artifacts: EnvironmentArtifact[] = [];

  for (const target of INSTRUCTION_FILES) {
    const fullPath = `${dirPath}/${target.fileName}`;
    const artifact = parseInstructionFile(fullPath, scope, baseDir, target.tool);
    if (artifact) artifacts.push(artifact);
  }

  return artifacts;
}
