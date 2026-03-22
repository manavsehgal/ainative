/**
 * Scanner for Claude Code CLI artifacts.
 * Reads project-level .claude/ and user-level ~/.claude/.
 */

import { readdirSync, existsSync } from "fs";
import { join } from "path";
import type { EnvironmentArtifact, ScanError } from "../types";
import { parseSkillDir } from "../parsers/skill";
import { parseClaudeMcpConfig } from "../parsers/mcp-config";
import {
  parseClaudeSettings,
  parseClaudePlugins,
  parseOutputStyles,
} from "../parsers/settings";
import { scanInstructionFiles, parseInstructionFile } from "../parsers/instructions";
import { safeStat, safeReadFile, computeHash, safePreview } from "../parsers/utils";

/** Directories to skip when scanning ~/.claude/. */
const USER_SKIP_DIRS = new Set([
  "cache",
  "debug",
  "file-history",
  "plans",
  "paste-cache",
  "todos",
  "statsig",
]);

/** Directories to skip when scanning project .claude/. */
const PROJECT_SKIP_DIRS = new Set([
  "cache",
  "plans",
  "paste-cache",
]);

interface ScanOutput {
  artifacts: EnvironmentArtifact[];
  errors: ScanError[];
}

/** Scan user-level ~/.claude/ directory. */
function scanUserLevel(userHome: string): ScanOutput {
  const claudeDir = join(userHome, ".claude");
  const artifacts: EnvironmentArtifact[] = [];
  const errors: ScanError[] = [];

  if (!existsSync(claudeDir)) return { artifacts, errors };

  // Skills: ~/.claude/skills/*/
  const skillsDir = join(claudeDir, "skills");
  if (existsSync(skillsDir)) {
    try {
      for (const entry of readdirSync(skillsDir)) {
        const skillPath = join(skillsDir, entry);
        const artifact = parseSkillDir(skillPath, "claude-code", "user", userHome);
        if (artifact) artifacts.push(artifact);
      }
    } catch (e) {
      errors.push({ path: skillsDir, error: String(e) });
    }
  }

  // MCP: ~/.claude/.mcp.json
  const mcpPath = join(claudeDir, ".mcp.json");
  if (existsSync(mcpPath)) {
    artifacts.push(...parseClaudeMcpConfig(mcpPath, "user", userHome));
  }

  // Plugins: ~/.claude/plugins/installed_plugins.json
  const pluginsFile = join(claudeDir, "plugins", "installed_plugins.json");
  if (existsSync(pluginsFile)) {
    artifacts.push(...parseClaudePlugins(pluginsFile, userHome));
  }

  // Settings: ~/.claude/settings.json and settings.local.json
  for (const settingsFile of ["settings.json", "settings.local.json"]) {
    const settingsPath = join(claudeDir, settingsFile);
    if (existsSync(settingsPath)) {
      artifacts.push(...parseClaudeSettings(settingsPath, "user", userHome));
    }
  }

  // Output styles: ~/.claude/output-styles/
  const outputStylesDir = join(claudeDir, "output-styles");
  if (existsSync(outputStylesDir)) {
    artifacts.push(...parseOutputStyles(outputStylesDir, "claude-code", userHome));
  }

  // Memory files in projects
  const projectsDir = join(claudeDir, "projects");
  if (existsSync(projectsDir)) {
    try {
      for (const projEntry of readdirSync(projectsDir)) {
        const memoryDir = join(projectsDir, projEntry, "memory");
        if (!existsSync(memoryDir)) continue;

        const memoryIndex = join(memoryDir, "MEMORY.md");
        if (existsSync(memoryIndex)) {
          const artifact = parseInstructionFile(
            memoryIndex,
            "user",
            userHome,
            "claude-code"
          );
          if (artifact) {
            artifact.name = `memory/${projEntry}/MEMORY.md`;
            artifact.category = "memory";
            artifacts.push(artifact);
          }
        }
      }
    } catch (e) {
      errors.push({ path: projectsDir, error: String(e) });
    }
  }

  return { artifacts, errors };
}

/** Scan project-level .claude/ directory and root instruction files. */
function scanProjectLevel(projectDir: string): ScanOutput {
  const claudeDir = join(projectDir, ".claude");
  const artifacts: EnvironmentArtifact[] = [];
  const errors: ScanError[] = [];

  // Root instruction files (CLAUDE.md, AGENTS.md, MEMORY.md)
  artifacts.push(...scanInstructionFiles(projectDir, "project", projectDir));

  if (!existsSync(claudeDir)) return { artifacts, errors };

  // Skills: .claude/skills/*/
  const skillsDir = join(claudeDir, "skills");
  if (existsSync(skillsDir)) {
    try {
      for (const entry of readdirSync(skillsDir)) {
        const skillPath = join(skillsDir, entry);
        const artifact = parseSkillDir(skillPath, "claude-code", "project", projectDir);
        if (artifact) artifacts.push(artifact);
      }
    } catch (e) {
      errors.push({ path: skillsDir, error: String(e) });
    }
  }

  // MCP: .claude/.mcp.json
  const mcpPath = join(claudeDir, ".mcp.json");
  if (existsSync(mcpPath)) {
    artifacts.push(...parseClaudeMcpConfig(mcpPath, "project", projectDir));
  }

  // Settings: .claude/settings.json and settings.local.json
  for (const settingsFile of ["settings.json", "settings.local.json"]) {
    const settingsPath = join(claudeDir, settingsFile);
    if (existsSync(settingsPath)) {
      artifacts.push(...parseClaudeSettings(settingsPath, "project", projectDir));
    }
  }

  // Hooks: .claude/hooks/ (if present)
  const hooksDir = join(claudeDir, "hooks");
  if (existsSync(hooksDir)) {
    try {
      for (const entry of readdirSync(hooksDir)) {
        const hookPath = join(hooksDir, entry);
        const content = safeReadFile(hookPath);
        if (!content) continue;

        const stat = safeStat(hookPath);
        if (!stat?.isFile()) continue;

        artifacts.push({
          tool: "claude-code",
          category: "hook",
          scope: "project",
          name: entry,
          relPath: hookPath.replace(projectDir, "").replace(/^\//, ""),
          absPath: hookPath,
          contentHash: computeHash(content),
          preview: safePreview(content),
          metadata: {},
          sizeBytes: stat.size,
          modifiedAt: stat.mtimeMs,
        });
      }
    } catch (e) {
      errors.push({ path: hooksDir, error: String(e) });
    }
  }

  return { artifacts, errors };
}

/** Full Claude Code scan: user-level + project-level. */
export function scanClaudeCode(
  projectDir: string,
  userHome: string
): ScanOutput {
  const user = scanUserLevel(userHome);
  const project = scanProjectLevel(projectDir);

  return {
    artifacts: [...user.artifacts, ...project.artifacts],
    errors: [...user.errors, ...project.errors],
  };
}
