import { createElement } from "react";
import yaml from "js-yaml";
import { ManifestPaneBody } from "@/components/apps/kit-view/manifest-pane-body";
import { LastRunCard } from "@/components/apps/last-run-card";
import { ErrorTimeline } from "@/components/workflows/error-timeline";
import type {
  KitDefinition,
  KitProjection,
  ResolveInput,
  RuntimeState,
  ViewModel,
} from "../types";

interface WorkflowHubProjection extends KitProjection {
  blueprintIds: string[];
  scheduleIds: string[];
  manifestYaml: string;
}

/**
 * Workflow Hub — the catch-all kit. Renders for any composed app that
 * doesn't match a more specific archetype (≥2 blueprints OR no clear hero
 * table per the inference table). Hero is intentionally absent; the value
 * is in KPIs (run-rate, success %, cost) + per-blueprint LastRunCard +
 * recent failures.
 *
 * Pure projection: no React state, no fetching. Runtime aggregates are
 * loaded by `loadRuntimeState`.
 */
export const workflowHubKit: KitDefinition = {
  id: "workflow-hub",

  resolve(input: ResolveInput): KitProjection {
    const projection: WorkflowHubProjection = {
      blueprintIds: input.manifest.blueprints.map((b) => b.id),
      scheduleIds: input.manifest.schedules.map((s) => s.id),
      manifestYaml: yaml.dump(input.manifest, { lineWidth: 100 }),
    };
    return projection;
  },

  buildModel(proj: KitProjection, runtime: RuntimeState): ViewModel {
    const projection = proj as WorkflowHubProjection;
    const { app } = runtime;
    const blueprintIds = projection.blueprintIds;

    const lastRuns = runtime.blueprintLastRuns ?? {};
    const counts = runtime.blueprintRunCounts ?? {};

    const secondary = blueprintIds.map((bpId) => ({
      id: `blueprint-${bpId}`,
      content: createElement(LastRunCard, {
        blueprintId: bpId,
        blueprintLabel: bpId,
        lastRun: lastRuns[bpId] ?? null,
        runCount30d: counts[bpId] ?? 0,
      }),
    }));

    const failed = runtime.failedTasks ?? [];
    const activity =
      failed.length > 0
        ? {
            content: createElement(ErrorTimeline, {
              events: failed.map((t) => ({
                timestamp: new Date(t.createdAt).toISOString(),
                event: "task_failed",
                severity: "error" as const,
                details: t.result?.slice(0, 240) ?? t.title,
              })),
            }),
          }
        : undefined;

    return {
      header: {
        title: app.name,
        description: app.description ?? "Composed app",
        status: "running",
        cadenceChip: runtime.cadence ?? undefined,
      },
      kpis: runtime.evaluatedKpis ?? [],
      secondary,
      activity,
      footer: {
        appId: app.id,
        appName: app.name,
        manifestYaml: projection.manifestYaml,
        body: ManifestPaneBody({
          manifest: app.manifest,
          files: app.files,
          manifestYaml: projection.manifestYaml,
        }),
      },
    };
  },
};
