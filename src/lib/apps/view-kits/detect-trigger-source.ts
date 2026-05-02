import type { AppManifest } from "@/lib/apps/registry";
import type { TriggerSource } from "./types";

/**
 * Pure helper that classifies how an app's run blueprint fires.
 *
 * Precedence: row-insert (validated against manifest.tables) > schedule > manual.
 *
 * When two blueprints declare row-insert triggers, the one matching
 * `preferredBlueprintId` wins; otherwise the first match wins (and the choice
 * is documented at the call site).
 *
 * When `trigger.table` references a non-existent table, the trigger is ignored
 * with a `console.warn` and detection falls through to schedule/manual.
 */
export function detectTriggerSource(
  manifest: AppManifest,
  preferredBlueprintId?: string
): TriggerSource {
  const knownTableIds = new Set(manifest.tables.map((t) => t.id));

  // Step 1: row-insert pass — find all valid row-insert triggers
  const rowInsertCandidates: TriggerSource[] = [];
  for (const bp of manifest.blueprints) {
    const trigger = (bp as { trigger?: { kind: string; table?: string } }).trigger;
    if (trigger?.kind !== "row-insert") continue;
    if (!trigger.table || !knownTableIds.has(trigger.table)) {
      console.warn(
        `[detectTriggerSource] blueprint "${bp.id}" declares trigger.table="${trigger.table}" which is not in manifest.tables; ignoring trigger.`
      );
      continue;
    }
    rowInsertCandidates.push({
      kind: "row-insert",
      table: trigger.table,
      blueprintId: bp.id,
    });
  }
  if (rowInsertCandidates.length > 0) {
    const preferred = preferredBlueprintId
      ? rowInsertCandidates.find((c) => c.blueprintId === preferredBlueprintId)
      : null;
    return preferred ?? rowInsertCandidates[0]!;
  }

  // Step 2: schedule pass — find a schedule that binds the preferred blueprint
  for (const s of manifest.schedules) {
    const runsId = (s as { runs?: string }).runs;
    if (!runsId) continue;
    if (preferredBlueprintId && runsId !== preferredBlueprintId) continue;
    return {
      kind: "schedule",
      scheduleId: s.id,
      blueprintId: runsId,
    };
  }

  // Step 3: manual fallback
  return { kind: "manual", blueprintId: preferredBlueprintId };
}
