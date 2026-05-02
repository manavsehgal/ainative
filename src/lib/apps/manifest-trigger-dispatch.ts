/**
 * Manifest-driven trigger dispatcher.
 *
 * Called from `addRows` (`src/lib/data/tables.ts`) alongside the existing
 * `evaluateTriggers` (UI-configured triggers). Reads cached manifests,
 * filters subscriptions by table id, and instantiates + executes the
 * named blueprint asynchronously.
 *
 * Tasks created by row-triggered blueprints carry:
 *   - `tasks.context_row_id = <row-id>`  (via workflow definition._contextRowId)
 *   - `tasks.project_id = <appId>`       (via instantiateBlueprint projectId arg)
 *
 * Failures (unknown blueprint, missing required variable, filesystem
 * fault) write a `notifications` row and log to console; one failing
 * subscription does not block other matching apps.
 *
 * Use `await import()` for engine.ts to avoid module-load cycles per
 * CLAUDE.md "smoke-test budget" rule.
 */

import { listAppsWithManifestsCached } from "./registry";
import type { AppManifest } from "./registry";
import { getBlueprint } from "@/lib/workflows/blueprints/registry";

export async function evaluateManifestTriggers(
  tableId: string,
  rowId: string,
  rowData: Record<string, unknown>
): Promise<void> {
  // listAppsWithManifestsCached returns AppDetail[] with `manifest` hydrated,
  // so findMatchingSubscriptions can read manifest.blueprints at runtime.
  const apps = listAppsWithManifestsCached();
  const matches = findMatchingSubscriptions(apps, tableId);

  for (const { appId, blueprintId } of matches) {
    try {
      const { instantiateBlueprint } = await import(
        "@/lib/workflows/blueprints/instantiator"
      );
      const { executeWorkflow } = await import("@/lib/workflows/engine");

      const variables = buildVariables(blueprintId, rowData);

      const { workflowId } = await instantiateBlueprint(
        blueprintId,
        variables,
        appId,
        { _contextRowId: rowId }
      );

      // Fire-and-forget — workflow may run for minutes
      executeWorkflow(workflowId).catch((err) => {
        console.error(
          `[manifest-trigger-dispatch] executeWorkflow ${workflowId} failed:`,
          err
        );
      });
    } catch (err) {
      console.error(
        `[manifest-trigger-dispatch] dispatch failed for app=${appId} blueprint=${blueprintId}:`,
        err
      );
    }
  }
}

interface MatchingSubscription {
  appId: string;
  blueprintId: string;
}

function findMatchingSubscriptions(
  apps: ReadonlyArray<{ id: string; manifest?: AppManifest }>,
  tableId: string
): MatchingSubscription[] {
  const out: MatchingSubscription[] = [];
  for (const app of apps) {
    for (const bp of app.manifest?.blueprints ?? []) {
      const t = (bp as { trigger?: { kind?: string; table?: string } }).trigger;
      if (t?.kind === "row-insert" && t.table === tableId) {
        out.push({ appId: app.id, blueprintId: bp.id });
      }
    }
  }
  return out;
}

const ROW_PLACEHOLDER = /^\{\{\s*row\.([a-zA-Z0-9_-]+)\s*\}\}$/;

/**
 * Build the variables object passed to `instantiateBlueprint`:
 *   1. Start with provided `rowData` (each column becomes a variable named after the column).
 *   2. For each blueprint variable whose `default` is `{{row.<col>}}`,
 *      resolve to `rowData[col]` so the variable has a concrete value
 *      even if `rowData[col]` is missing from step 1's column-name passthrough.
 *   3. Required variables left unresolved → instantiator throws → caller catches.
 */
function buildVariables(
  blueprintId: string,
  rowData: Record<string, unknown>
): Record<string, unknown> {
  const blueprint = getBlueprint(blueprintId);
  const vars: Record<string, unknown> = { ...rowData };

  if (!blueprint) {
    return vars; // unknown blueprint case; instantiator will throw
  }

  for (const varDef of blueprint.variables) {
    const defStr = typeof varDef.default === "string" ? varDef.default : null;
    if (!defStr) continue;
    const m = ROW_PLACEHOLDER.exec(defStr);
    if (m) {
      const col = m[1];
      if (vars[varDef.id] === undefined && rowData[col] !== undefined) {
        vars[varDef.id] = rowData[col];
      }
    }
  }

  return vars;
}
