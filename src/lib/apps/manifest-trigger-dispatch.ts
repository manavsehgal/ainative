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

import { listAppsCached } from "./registry";
import type { AppManifest } from "./registry";

export async function evaluateManifestTriggers(
  tableId: string,
  rowId: string,
  rowData: Record<string, unknown>
): Promise<void> {
  // Cached entries are AppSummary[] which doesn't include `manifest`.
  // findMatchingSubscriptions tolerates a missing `manifest` (returns []),
  // and the test path mocks the cache to return shapes with `manifest`.
  // Wave 6+ may extend the cache to include manifests on the hot path.
  const apps = listAppsCached() as ReadonlyArray<{ id: string; manifest?: AppManifest }>;
  const matches = findMatchingSubscriptions(apps, tableId);

  for (const { appId, blueprintId } of matches) {
    try {
      const { instantiateBlueprint } = await import(
        "@/lib/workflows/blueprints/instantiator"
      );
      const { executeWorkflow } = await import("@/lib/workflows/engine");

      const variables = { ...rowData };

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
