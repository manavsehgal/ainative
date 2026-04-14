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

import type { SkillSummary } from "./list-skills";

export interface EnrichedSkill extends SkillSummary {
  healthScore: HealthScore;
  syncStatus: SyncStatus;
  linkedProfileId: string | null;
  /** All absPaths for the same skill name (for symlink/dup handling). */
  absPaths: string[];
}

export interface EnrichmentContext {
  modifiedAtMsByPath: Record<string, number | null>;
  linkedProfilesByPath: Record<string, string | null>;
  nowMs?: number;
}

export function enrichSkills(
  skills: SkillSummary[],
  ctx: EnrichmentContext
): EnrichedSkill[] {
  const nowMs = ctx.nowMs ?? Date.now();
  // Dedupe by absPath first (symlink loops).
  const seen = new Set<string>();
  const deduped: SkillSummary[] = [];
  for (const s of skills) {
    if (seen.has(s.absPath)) continue;
    seen.add(s.absPath);
    deduped.push(s);
  }
  // Group by name.
  const byName = new Map<string, SkillSummary[]>();
  for (const s of deduped) {
    const list = byName.get(s.name) ?? [];
    list.push(s);
    byName.set(s.name, list);
  }
  const out: EnrichedSkill[] = [];
  for (const [, group] of byName) {
    const tools = group.map((g) => g.tool);
    const syncStatus = computeSyncStatus(tools);
    // Use the highest health (most recent modification) across the group.
    const ages = group.map((g) => ctx.modifiedAtMsByPath[g.absPath] ?? null);
    const newest = ages.reduce<number | null>(
      (acc, v) => (v != null && (acc == null || v > acc) ? v : acc),
      null
    );
    const healthScore = computeHealthScore(newest, nowMs);
    const linkedProfileId =
      group
        .map((g) => ctx.linkedProfilesByPath[g.absPath] ?? null)
        .find((v) => v != null) ?? null;
    const primary = group[0];
    out.push({
      ...primary,
      healthScore,
      syncStatus,
      linkedProfileId,
      absPaths: group.map((g) => g.absPath),
    });
  }
  return out;
}
