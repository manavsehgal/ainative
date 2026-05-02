import type { AppManifest } from "@/lib/apps/registry";
import { placeholderKit } from "./kits/placeholder";
import type { ColumnSchemaRef, KitDefinition, KitId } from "./types";

/**
 * View-kit registry. Phase 1.1 ships only `placeholder`. Phase 1.2 introduces
 * the strict `view:` field on the manifest and the 7-rule `pickKit` decision
 * table; Phase 2+ populates `tracker`, `workflow-hub`, etc.
 */
export const viewKits: Record<KitId, KitDefinition | undefined> = {
  placeholder: placeholderKit,
  tracker: undefined,
  "workflow-hub": undefined,
  coach: undefined,
  ledger: undefined,
  inbox: undefined,
  research: undefined,
};

/**
 * Stub `pickKit`: always returns `placeholder` until Phase 1.2 lands the real
 * decision table. The signature already accepts the column schemas Phase 1.2
 * will need so the call site at `src/app/apps/[id]/page.tsx` doesn't change.
 */
export function pickKit(
  _manifest: AppManifest,
  _columns: ColumnSchemaRef[]
): KitDefinition {
  return placeholderKit;
}

export type { KitDefinition, KitId, ColumnSchemaRef };
export { placeholderKit };
