import { getAllowedPermissions, addAllowedPermission, removeAllowedPermission } from "./permissions";

// ---------------------------------------------------------------------------
// Preset definitions
// ---------------------------------------------------------------------------

export interface PermissionPreset {
  id: string;
  name: string;
  description: string;
  risk: "low" | "medium" | "high";
  patterns: string[];
}

/**
 * Built-in permission presets. Presets are layered — higher-risk presets
 * include all patterns from lower-risk ones.
 */
export const PRESETS: PermissionPreset[] = [
  {
    id: "read-only",
    name: "Read Only",
    description: "Safe read operations — no file mutations or shell commands",
    risk: "low",
    patterns: ["Read", "Glob", "Grep", "LS", "NotebookRead"],
  },
  {
    id: "git-safe",
    name: "Git Safe",
    description: "Read operations plus file editing and git commands",
    risk: "medium",
    patterns: [
      // Includes all read-only patterns
      "Read",
      "Glob",
      "Grep",
      "LS",
      "NotebookRead",
      // Plus write + git
      "Write",
      "Edit",
      "Bash(command:git *)",
    ],
  },
  {
    id: "full-auto",
    name: "Full Auto",
    description: "All tools auto-approved — maximum agent autonomy",
    risk: "high",
    patterns: [
      // All safe tools
      "Read",
      "Glob",
      "Grep",
      "LS",
      "NotebookRead",
      "Write",
      "Edit",
      // All bash and other tools
      "Bash",
      "NotebookEdit",
      "WebFetch",
      "WebSearch",
    ],
  },
];

// ---------------------------------------------------------------------------
// Preset operations
// ---------------------------------------------------------------------------

/**
 * Get a preset by ID, or undefined if not found.
 */
export function getPreset(presetId: string): PermissionPreset | undefined {
  return PRESETS.find((p) => p.id === presetId);
}

/**
 * Check which presets are currently fully active (all patterns present).
 */
export async function getActivePresets(): Promise<string[]> {
  const current = await getAllowedPermissions();
  const currentSet = new Set(current);

  return PRESETS.filter((preset) =>
    preset.patterns.every((p) => currentSet.has(p))
  ).map((p) => p.id);
}

/**
 * Check if a specific preset is fully active.
 */
export async function isPresetActive(presetId: string): Promise<boolean> {
  const preset = getPreset(presetId);
  if (!preset) return false;

  const current = await getAllowedPermissions();
  const currentSet = new Set(current);
  return preset.patterns.every((p) => currentSet.has(p));
}

/**
 * Enable a preset — adds all its patterns to the permission store.
 * Existing patterns are preserved (additive, no duplicates).
 */
export async function applyPreset(presetId: string): Promise<void> {
  const preset = getPreset(presetId);
  if (!preset) {
    throw new Error(`Unknown preset: ${presetId}`);
  }

  for (const pattern of preset.patterns) {
    await addAllowedPermission(pattern);
  }
}

/**
 * Disable a preset — removes only patterns that are unique to this preset
 * (not present in any other active preset or individually approved).
 *
 * Patterns shared with other active presets are kept.
 */
export async function removePreset(presetId: string): Promise<void> {
  const preset = getPreset(presetId);
  if (!preset) {
    throw new Error(`Unknown preset: ${presetId}`);
  }

  // Gather patterns that belong to OTHER presets (excluding the one being removed)
  const otherPresetPatterns = new Set<string>();
  const activePresets = await getActivePresets();

  for (const otherId of activePresets) {
    if (otherId === presetId) continue;
    const other = getPreset(otherId);
    if (other) {
      for (const p of other.patterns) {
        otherPresetPatterns.add(p);
      }
    }
  }

  // Remove only patterns unique to this preset
  for (const pattern of preset.patterns) {
    if (!otherPresetPatterns.has(pattern)) {
      await removeAllowedPermission(pattern);
    }
  }
}
