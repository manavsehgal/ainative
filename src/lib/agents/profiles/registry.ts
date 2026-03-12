import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { ProfileConfigSchema } from "@/lib/validators/profile";
import type { ProfileConfig } from "@/lib/validators/profile";
import { getSupportedRuntimes } from "./compatibility";
import type { AgentProfile } from "./types";

/**
 * Builtins ship inside the repo at src/lib/agents/profiles/builtins/.
 * At runtime they are copied (if missing) to ~/.claude/skills/ so users
 * can customize them without touching source.
 */
const BUILTINS_DIR = path.resolve(
  import.meta.dirname ?? __dirname,
  "builtins"
);

const SKILLS_DIR = path.join(
  process.env.HOME ?? process.env.USERPROFILE ?? ".",
  ".claude",
  "skills"
);

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

let profileCache: Map<string, AgentProfile> | null = null;
let profileCacheSignature: string | null = null;

function getSkillsDirectorySignature(): string {
  if (!fs.existsSync(SKILLS_DIR)) {
    return "missing";
  }

  const entries = fs
    .readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  const signatureParts: string[] = [];

  for (const entry of entries) {
    const dir = path.join(SKILLS_DIR, entry.name);
    const yamlPath = path.join(dir, "profile.yaml");
    const skillPath = path.join(dir, "SKILL.md");

    signatureParts.push(entry.name);

    if (fs.existsSync(yamlPath)) {
      const stats = fs.statSync(yamlPath);
      signatureParts.push(`yaml:${stats.mtimeMs}:${stats.size}`);
    }

    if (fs.existsSync(skillPath)) {
      const stats = fs.statSync(skillPath);
      signatureParts.push(`skill:${stats.mtimeMs}:${stats.size}`);
    }
  }

  return signatureParts.join("|");
}

// ---------------------------------------------------------------------------
// ensureBuiltins — copy missing builtins to .claude/skills/ (idempotent)
// ---------------------------------------------------------------------------

function ensureBuiltins(): void {
  if (!fs.existsSync(BUILTINS_DIR)) return;

  fs.mkdirSync(SKILLS_DIR, { recursive: true });

  for (const entry of fs.readdirSync(BUILTINS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const targetDir = path.join(SKILLS_DIR, entry.name);
    const targetYaml = path.join(targetDir, "profile.yaml");
    const srcYaml = path.join(BUILTINS_DIR, entry.name, "profile.yaml");

    // Never overwrite user edits — only copy if profile.yaml is missing
    if (fs.existsSync(targetYaml)) {
      try {
        const source = (yaml.load(fs.readFileSync(srcYaml, "utf-8")) ??
          {}) as Record<string, unknown>;
        const target = (yaml.load(fs.readFileSync(targetYaml, "utf-8")) ??
          {}) as Record<string, unknown>;
        let changed = false;

        if (
          source.supportedRuntimes !== undefined &&
          target.supportedRuntimes === undefined
        ) {
          target.supportedRuntimes = source.supportedRuntimes;
          changed = true;
        }

        if (
          source.runtimeOverrides !== undefined &&
          target.runtimeOverrides === undefined
        ) {
          target.runtimeOverrides = source.runtimeOverrides;
          changed = true;
        }

        if (changed) {
          fs.writeFileSync(targetYaml, yaml.dump(target));
        }
      } catch {
        // If a user has customized or broken the YAML, leave it untouched.
      }
      continue;
    }

    fs.mkdirSync(targetDir, { recursive: true });

    const srcDir = path.join(BUILTINS_DIR, entry.name);
    for (const file of fs.readdirSync(srcDir)) {
      fs.copyFileSync(path.join(srcDir, file), path.join(targetDir, file));
    }
  }
}

// ---------------------------------------------------------------------------
// scanProfiles — read .claude/skills/*/profile.yaml, validate, pair w/ SKILL.md
// ---------------------------------------------------------------------------

function scanProfiles(): Map<string, AgentProfile> {
  const profiles = new Map<string, AgentProfile>();

  if (!fs.existsSync(SKILLS_DIR)) return profiles;

  for (const entry of fs.readdirSync(SKILLS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const dir = path.join(SKILLS_DIR, entry.name);
    const yamlPath = path.join(dir, "profile.yaml");
    const skillPath = path.join(dir, "SKILL.md");

    if (!fs.existsSync(yamlPath)) continue;

    try {
      const rawYaml = fs.readFileSync(yamlPath, "utf-8");
      const parsed = yaml.load(rawYaml);
      const result = ProfileConfigSchema.safeParse(parsed);

      if (!result.success) {
        console.warn(
          `[profiles] Invalid profile.yaml in ${entry.name}:`,
          result.error.issues.map((i) => i.message).join(", ")
        );
        continue;
      }

      const config = result.data;
      const skillMd = fs.existsSync(skillPath)
        ? fs.readFileSync(skillPath, "utf-8")
        : "";

      // Extract description from SKILL.md frontmatter or fall back to name
      const descMatch = skillMd.match(
        /^---\s*\n[\s\S]*?description:\s*(.+?)\s*\n[\s\S]*?---/
      );
      const description = descMatch?.[1] ?? config.name;

      profiles.set(config.id, {
        id: config.id,
        name: config.name,
        description,
        domain: config.domain,
        tags: config.tags,
        systemPrompt: skillMd, // backward compat
        skillMd,
        allowedTools: config.allowedTools,
        mcpServers: config.mcpServers as Record<string, unknown>,
        canUseToolPolicy: config.canUseToolPolicy,
        temperature: config.temperature,
        maxTurns: config.maxTurns,
        outputFormat: config.outputFormat,
        version: config.version,
        author: config.author,
        source: config.source,
        tests: config.tests,
        supportedRuntimes: getSupportedRuntimes(config),
        runtimeOverrides: config.runtimeOverrides,
      });
    } catch (err) {
      console.warn(`[profiles] Error loading profile ${entry.name}:`, err);
    }
  }

  return profiles;
}

// ---------------------------------------------------------------------------
// Initialization — lazy on first access
// ---------------------------------------------------------------------------

function ensureLoaded(): Map<string, AgentProfile> {
  ensureBuiltins();
  const signature = getSkillsDirectorySignature();

  if (!profileCache || profileCacheSignature !== signature) {
    profileCache = scanProfiles();
    profileCacheSignature = signature;
  }
  return profileCache;
}

// ---------------------------------------------------------------------------
// Public API — same synchronous signatures as before
// ---------------------------------------------------------------------------

export function getProfile(id: string): AgentProfile | undefined {
  return ensureLoaded().get(id);
}

export function listProfiles(): AgentProfile[] {
  return Array.from(ensureLoaded().values());
}

export function getProfileTags(): Map<string, string[]> {
  const tagMap = new Map<string, string[]>();
  for (const profile of ensureLoaded().values()) {
    tagMap.set(profile.id, profile.tags);
  }
  return tagMap;
}

/** Force re-scan of .claude/skills/ — call after user adds/edits profiles */
export function reloadProfiles(): void {
  profileCache = null;
  profileCacheSignature = null;
}

/** Check if a profile ID is a built-in (exists in builtins/ source directory) */
export function isBuiltin(id: string): boolean {
  return fs.existsSync(path.join(BUILTINS_DIR, id, "profile.yaml"));
}

/** Create a new custom profile in ~/.claude/skills/ */
export function createProfile(config: ProfileConfig, skillMd: string): void {
  const result = ProfileConfigSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid profile: ${result.error.issues.map(i => i.message).join(", ")}`);
  }

  const dir = path.join(SKILLS_DIR, config.id);
  if (fs.existsSync(path.join(dir, "profile.yaml"))) {
    throw new Error(`Profile "${config.id}" already exists`);
  }

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "profile.yaml"), yaml.dump(config));
  fs.writeFileSync(path.join(dir, "SKILL.md"), skillMd);
  reloadProfiles();
}

/** Update an existing custom profile (rejects builtins) */
export function updateProfile(id: string, config: ProfileConfig, skillMd: string): void {
  if (isBuiltin(id)) {
    throw new Error("Cannot modify built-in profiles");
  }

  const result = ProfileConfigSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid profile: ${result.error.issues.map(i => i.message).join(", ")}`);
  }

  const dir = path.join(SKILLS_DIR, id);
  if (!fs.existsSync(dir)) {
    throw new Error(`Profile "${id}" not found`);
  }

  fs.writeFileSync(path.join(dir, "profile.yaml"), yaml.dump(config));
  fs.writeFileSync(path.join(dir, "SKILL.md"), skillMd);
  reloadProfiles();
}

/** Delete a custom profile (rejects builtins) */
export function deleteProfile(id: string): void {
  if (isBuiltin(id)) {
    throw new Error("Cannot delete built-in profiles");
  }

  const dir = path.join(SKILLS_DIR, id);
  if (!fs.existsSync(dir)) {
    throw new Error(`Profile "${id}" not found`);
  }

  fs.rmSync(dir, { recursive: true, force: true });
  reloadProfiles();
}
