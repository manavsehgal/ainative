export type HealthScore = "healthy" | "stale" | "aging" | "broken" | "unknown";

export type SyncStatus =
  | "synced"
  | "claude-only"
  | "codex-only"
  | "shared";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const SIX_MONTHS_DAYS = 180;
const TWELVE_MONTHS_DAYS = 365;

export function computeHealthScore(
  modifiedAtMs: number | null,
  nowMs: number = Date.now()
): HealthScore {
  if (modifiedAtMs == null) return "unknown";
  const ageDays = (nowMs - modifiedAtMs) / MS_PER_DAY;
  if (ageDays < SIX_MONTHS_DAYS) return "healthy";
  if (ageDays < TWELVE_MONTHS_DAYS) return "stale";
  return "aging";
}

/**
 * Compute sync status from the set of tools that own the skill.
 * - Both claude-code and codex present → "synced"
 * - Only claude-code → "claude-only"
 * - Only codex → "codex-only"
 * - Only shared → "shared" (project-level file, no user peer expected)
 * - claude-code + shared (or codex + shared) → treat as synced
 */
export function computeSyncStatus(tools: string[]): SyncStatus {
  const set = new Set(tools);
  const hasClaude = set.has("claude-code");
  const hasCodex = set.has("codex");
  const hasShared = set.has("shared");
  if (hasClaude && hasCodex) return "synced";
  if (hasClaude && hasShared) return "synced";
  if (hasCodex && hasShared) return "synced";
  if (hasClaude) return "claude-only";
  if (hasCodex) return "codex-only";
  return "shared";
}
