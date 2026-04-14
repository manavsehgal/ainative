import { realpathSync, statSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Format a single `entityType: "file"` mention for Tier 3.
 *
 * Security:
 *  - `cwd` is resolved by the caller from a trusted source (active project's
 *    workingDirectory, else `getLaunchCwd()`) — NEVER from the mention itself.
 *  - The mention's `relPath` is treated as a relative path; any path that
 *    resolves outside `cwd` is rejected without opening the file.
 *
 * Size semantics (matches spec §3 "tiered expansion"):
 *  - < 8 KB: inline content inside a fenced code block with path header.
 *  - >= 8 KB and < MAX_SIZE: emit a short reference line so agents with a
 *    `Read` tool can fetch the file on demand; agents without one degrade
 *    gracefully ("I can't read large files on this runtime").
 *  - >= MAX_SIZE (50 MB): skip silently — pathological.
 *
 * Non-crashing by design: any read/stat failure becomes a short note in
 * the output, not a thrown error that would break the whole prompt build.
 */
export function expandFileMention(relPath: string, cwd: string): string[] {
  const lines: string[] = [];

  let cwdReal: string;
  try {
    cwdReal = realpathSync(cwd);
  } catch {
    lines.push(`\n### File: ${relPath}`);
    lines.push("(cwd does not exist)");
    return lines;
  }

  const abs = resolve(cwdReal, relPath);
  if (!abs.startsWith(cwdReal)) {
    lines.push(`\n### File: ${relPath}`);
    lines.push("(invalid path — escapes working directory)");
    return lines;
  }

  let stat: { size: number };
  try {
    stat = statSync(abs);
  } catch {
    lines.push(`\n### File: ${relPath}`);
    lines.push("(file not found at context-build time)");
    return lines;
  }

  const INLINE_LIMIT = 8 * 1024;
  const MAX_SIZE = 50 * 1024 * 1024;
  if (stat.size > MAX_SIZE) return []; // skip silently

  if (stat.size < INLINE_LIMIT) {
    let content: string;
    try {
      content = readFileSync(abs, "utf8");
    } catch {
      lines.push(`\n### File: ${relPath}`);
      lines.push("(file could not be read as UTF-8)");
      return lines;
    }
    const ext = relPath.split(".").pop() ?? "";
    lines.push(`\n### File: ${relPath}`);
    lines.push("```" + ext);
    lines.push(content);
    lines.push("```");
  } else {
    lines.push(
      `\n### File (by reference): ${relPath} (${Math.round(stat.size / 1024)} KB)`
    );
    lines.push("Use the Read tool to load this file if you need its content.");
  }
  return lines;
}
