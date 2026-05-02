import type { AppManifest } from "@/lib/apps/registry";

/**
 * Resolved bindings extracted from an app manifest. Kits read this rather
 * than the raw manifest so future manifest reshaping (Phase 1.2's `view:`
 * field, Phase 5's `semantic` column hints) doesn't ripple into every kit.
 */
export interface ResolvedBindings {
  profileIds: string[];
  blueprintIds: string[];
  tableIds: string[];
  scheduleIds: string[];
  /** Schedules with their cron expression preserved for cadence rendering. */
  schedules: { id: string; cron: string | undefined }[];
}

export function resolveBindings(manifest: AppManifest): ResolvedBindings {
  return {
    profileIds: manifest.profiles.map((p) => p.id),
    blueprintIds: manifest.blueprints.map((b) => b.id),
    tableIds: manifest.tables.map((t) => t.id),
    scheduleIds: manifest.schedules.map((s) => s.id),
    schedules: manifest.schedules.map((s) => ({
      id: s.id,
      cron: s.cron,
    })),
  };
}
