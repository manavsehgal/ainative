/**
 * Parse permissions, plugins, and output styles.
 */

import { readdirSync } from "fs";
import { join, basename } from "path";
import type { EnvironmentArtifact, ToolPersona, ArtifactScope } from "../types";
import { computeHash, safePreview, safeStat, safeReadFile } from "./utils";
import { parseTOML } from "./toml";

/** Parse Claude Code settings.json or settings.local.json for permissions. */
export function parseClaudeSettings(
  filePath: string,
  scope: ArtifactScope,
  baseDir: string
): EnvironmentArtifact[] {
  const content = safeReadFile(filePath);
  if (!content) return [];

  const stat = safeStat(filePath);
  if (!stat) return [];

  try {
    const config = JSON.parse(content) as {
      permissions?: { allow?: string[]; deny?: string[] };
      [key: string]: unknown;
    };

    const artifacts: EnvironmentArtifact[] = [];

    // Each permission set (allow/deny) becomes one artifact
    if (config.permissions?.allow?.length) {
      artifacts.push({
        tool: "claude-code",
        category: "permission",
        scope,
        name: `${basename(filePath, ".json")}-allow`,
        relPath: filePath.replace(baseDir, "").replace(/^\//, ""),
        absPath: filePath,
        contentHash: computeHash(JSON.stringify(config.permissions.allow)),
        preview: `Allow: ${config.permissions.allow.slice(0, 10).join(", ")}`,
        metadata: { type: "allow", rules: config.permissions.allow },
        sizeBytes: stat.size,
        modifiedAt: stat.mtimeMs,
      });
    }

    if (config.permissions?.deny?.length) {
      artifacts.push({
        tool: "claude-code",
        category: "permission",
        scope,
        name: `${basename(filePath, ".json")}-deny`,
        relPath: filePath.replace(baseDir, "").replace(/^\//, ""),
        absPath: filePath,
        contentHash: computeHash(JSON.stringify(config.permissions.deny)),
        preview: `Deny: ${config.permissions.deny.slice(0, 10).join(", ")}`,
        metadata: { type: "deny", rules: config.permissions.deny },
        sizeBytes: stat.size,
        modifiedAt: stat.mtimeMs,
      });
    }

    return artifacts;
  } catch {
    return [];
  }
}

/** Parse Codex config.toml for trust/permission settings. */
export function parseCodexSettings(
  filePath: string,
  baseDir: string
): EnvironmentArtifact[] {
  const content = safeReadFile(filePath);
  if (!content) return [];

  const stat = safeStat(filePath);
  if (!stat) return [];

  const config = parseTOML(content);
  if (!config) return [];

  const artifacts: EnvironmentArtifact[] = [];

  // Extract model and personality as a single settings artifact
  const settingsKeys = ["model", "model_reasoning", "approval_mode", "sandbox", "personality"];
  const settings: Record<string, unknown> = {};
  for (const key of settingsKeys) {
    if (config[key] !== undefined) settings[key] = config[key];
  }

  if (Object.keys(settings).length > 0) {
    artifacts.push({
      tool: "codex",
      category: "permission",
      scope: "user",
      name: "codex-config",
      relPath: filePath.replace(baseDir, "").replace(/^\//, ""),
      absPath: filePath,
      contentHash: computeHash(JSON.stringify(settings)),
      preview: Object.entries(settings)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", "),
      metadata: settings,
      sizeBytes: stat.size,
      modifiedAt: stat.mtimeMs,
    });
  }

  return artifacts;
}

/** Parse Claude Code plugins from installed_plugins.json. */
export function parseClaudePlugins(
  filePath: string,
  baseDir: string
): EnvironmentArtifact[] {
  const content = safeReadFile(filePath);
  if (!content) return [];

  const stat = safeStat(filePath);
  if (!stat) return [];

  try {
    const plugins = JSON.parse(content) as Array<{
      name?: string;
      package_name?: string;
      [key: string]: unknown;
    }>;

    return plugins.map((plugin) => ({
      tool: "claude-code" as ToolPersona,
      category: "plugin" as const,
      scope: "user" as const,
      name: plugin.name || plugin.package_name || "unknown",
      relPath: filePath.replace(baseDir, "").replace(/^\//, ""),
      absPath: filePath,
      contentHash: computeHash(JSON.stringify(plugin)),
      preview: `Plugin: ${plugin.name || plugin.package_name}`,
      metadata: { ...plugin },
      sizeBytes: stat.size,
      modifiedAt: stat.mtimeMs,
    }));
  } catch {
    return [];
  }
}

/** Parse output styles directory. */
export function parseOutputStyles(
  dirPath: string,
  tool: ToolPersona,
  baseDir: string
): EnvironmentArtifact[] {
  const stat = safeStat(dirPath);
  if (!stat?.isDirectory()) return [];

  const artifacts: EnvironmentArtifact[] = [];
  try {
    for (const entry of readdirSync(dirPath)) {
      const fullPath = join(dirPath, entry);
      const content = safeReadFile(fullPath);
      if (!content) continue;

      const fStat = safeStat(fullPath);
      if (!fStat?.isFile()) continue;

      artifacts.push({
        tool,
        category: "output-style",
        scope: "user",
        name: basename(entry, ".md"),
        relPath: fullPath.replace(baseDir, "").replace(/^\//, ""),
        absPath: fullPath,
        contentHash: computeHash(content),
        preview: safePreview(content),
        metadata: {},
        sizeBytes: fStat.size,
        modifiedAt: fStat.mtimeMs,
      });
    }
  } catch {
    // Directory unreadable
  }

  return artifacts;
}
