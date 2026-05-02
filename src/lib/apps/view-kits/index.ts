import type { AppManifest } from "@/lib/apps/registry";
import { pickKit as pickKitId } from "./inference";
import { placeholderKit } from "./kits/placeholder";
import type { ColumnSchemaRef, KitDefinition, KitId } from "./types";

/**
 * View-kit registry. Phase 1.2 ships only `placeholder`. Phase 2+ populates
 * `tracker`, `workflow-hub`, etc.; until then any non-placeholder id resolves
 * to `placeholderKit` (graceful degradation per the strategy doc).
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
 * Resolve a `KitId` to a `KitDefinition`. Falls back to `placeholderKit` for
 * any id not yet registered, so Phase 1.2 inference can return real kit ids
 * without blocking on Phase 2+ kit implementations.
 */
export function resolveKit(id: KitId | string): KitDefinition {
  if (id in viewKits) {
    return viewKits[id as KitId] ?? placeholderKit;
  }
  return placeholderKit;
}

/**
 * Phase 1.2: `pickKit` now delegates to the inference decision table and
 * resolves the returned id to a kit definition (with `placeholder` fallback).
 * The signature is preserved from Phase 1.1 so the dispatcher call site is
 * untouched.
 */
export function pickKit(
  manifest: AppManifest,
  columns: ColumnSchemaRef[]
): KitDefinition {
  const id = pickKitId(manifest, columns);
  return resolveKit(id);
}

/**
 * Per-table column row as returned by the data layer (`getColumns`). Kept
 * minimal here so we don't take a full DB-row dependency in pure code paths.
 */
export interface ColumnRowLike {
  name: string;
  dataType: string;
  config: string | null;
}

export type GetColumnsFn = (tableId: string) => Promise<ColumnRowLike[]>;

/**
 * `loadColumnSchemas(app, [getColumns])` reads each manifest table's columns
 * via the data layer and shapes them for the inference predicates. The
 * `semantic` field comes from the column's JSON `config.semantic` (Option A
 * from the Phase 1 strategy decision: no DB migration in Phase 1).
 *
 * `getColumns` is injected for testability; production callers omit it and
 * the real `@/lib/data/tables#getColumns` is used.
 */
export async function loadColumnSchemas(
  manifest: AppManifest,
  getColumns?: GetColumnsFn
): Promise<ColumnSchemaRef[]> {
  const fetcher: GetColumnsFn =
    getColumns ?? (async (id) => {
      const mod = await import("@/lib/data/tables");
      const rows = await mod.getColumns(id);
      return rows.map((r) => ({
        name: r.name,
        dataType: r.dataType,
        config: r.config,
      }));
    });

  const out: ColumnSchemaRef[] = [];
  for (const t of manifest.tables) {
    let rows: ColumnRowLike[] = [];
    try {
      rows = await fetcher(t.id);
    } catch {
      rows = [];
    }
    out.push({
      tableId: t.id,
      columns: rows.map((r) => ({
        name: r.name,
        type: r.dataType,
        semantic: extractSemantic(r.config),
      })),
    });
  }
  return out;
}

function extractSemantic(config: string | null): string | undefined {
  if (!config) return undefined;
  try {
    const parsed = JSON.parse(config) as { semantic?: unknown };
    return typeof parsed.semantic === "string" ? parsed.semantic : undefined;
  } catch {
    return undefined;
  }
}

export type { KitDefinition, KitId, ColumnSchemaRef };
export { placeholderKit };
