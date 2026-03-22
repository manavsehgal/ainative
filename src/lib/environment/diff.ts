/**
 * Unified diff generation for sync preview.
 * Pure string comparison — no external dependencies.
 */

export interface DiffResult {
  /** Unified diff string */
  diff: string;
  /** Number of lines added */
  additions: number;
  /** Number of lines removed */
  deletions: number;
  /** Whether files are identical */
  identical: boolean;
}

/**
 * Generate a unified diff between two strings.
 * For new files, oldContent is empty. For deletions, newContent is empty.
 */
export function generateDiff(
  oldContent: string,
  newContent: string,
  oldPath: string,
  newPath: string
): DiffResult {
  if (oldContent === newContent) {
    return { diff: "", additions: 0, deletions: 0, identical: true };
  }

  const oldLines = oldContent ? oldContent.split("\n") : [];
  const newLines = newContent ? newContent.split("\n") : [];

  const lines: string[] = [];
  lines.push(`--- ${oldPath || "/dev/null"}`);
  lines.push(`+++ ${newPath || "/dev/null"}`);

  let additions = 0;
  let deletions = 0;

  // Simple line-by-line diff (not optimal but sufficient for config files)
  const maxLen = Math.max(oldLines.length, newLines.length);
  let chunkStart = -1;
  const chunks: Array<{ oldStart: number; newStart: number; lines: string[] }> = [];
  let currentChunk: string[] = [];
  let contextBefore: string[] = [];

  for (let i = 0; i < maxLen; i++) {
    const oldLine = i < oldLines.length ? oldLines[i] : undefined;
    const newLine = i < newLines.length ? newLines[i] : undefined;

    if (oldLine === newLine) {
      if (currentChunk.length > 0) {
        // Add up to 3 lines of trailing context
        currentChunk.push(` ${oldLine ?? ""}`);
        if (currentChunk.filter((l) => l.startsWith(" ")).length >= 3) {
          chunks.push({
            oldStart: chunkStart,
            newStart: chunkStart,
            lines: [...currentChunk],
          });
          currentChunk = [];
          chunkStart = -1;
        }
      } else {
        // Collect context before
        contextBefore.push(` ${oldLine ?? ""}`);
        if (contextBefore.length > 3) contextBefore.shift();
      }
    } else {
      if (chunkStart === -1) {
        chunkStart = Math.max(0, i - contextBefore.length);
        currentChunk = [...contextBefore];
      }
      contextBefore = [];

      if (oldLine !== undefined && newLine !== undefined) {
        currentChunk.push(`-${oldLine}`);
        currentChunk.push(`+${newLine}`);
        additions++;
        deletions++;
      } else if (oldLine !== undefined) {
        currentChunk.push(`-${oldLine}`);
        deletions++;
      } else if (newLine !== undefined) {
        currentChunk.push(`+${newLine}`);
        additions++;
      }
    }
  }

  if (currentChunk.length > 0) {
    chunks.push({
      oldStart: chunkStart,
      newStart: chunkStart,
      lines: currentChunk,
    });
  }

  for (const chunk of chunks) {
    const removals = chunk.lines.filter((l) => l.startsWith("-")).length;
    const adds = chunk.lines.filter((l) => l.startsWith("+")).length;
    const context = chunk.lines.filter((l) => l.startsWith(" ")).length;

    lines.push(
      `@@ -${chunk.oldStart + 1},${removals + context} +${chunk.newStart + 1},${adds + context} @@`
    );
    lines.push(...chunk.lines);
  }

  return {
    diff: lines.join("\n"),
    additions,
    deletions,
    identical: false,
  };
}

/** Generate a diff for a new file (all additions). */
export function generateNewFileDiff(content: string, path: string): DiffResult {
  return generateDiff("", content, "/dev/null", path);
}

/** Generate a diff for a deleted file (all deletions). */
export function generateDeleteFileDiff(content: string, path: string): DiffResult {
  return generateDiff(content, "", path, "/dev/null");
}
