import "server-only";
import { unstable_cache } from "next/cache";
import { and, count, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { tasks, schedules, userTableRows } from "@/lib/db/schema";
import { humanizeCron } from "@/lib/apps/registry";
import type { AppDetail, AppManifest, ViewConfig } from "@/lib/apps/registry";
import type { ResolvedBindings } from "./resolve";
import type {
  CadenceChipData,
  HeroTableData,
  KitId,
  KpiTile,
  RuntimeState,
  RuntimeTaskSummary,
} from "./types";
import type { ColumnDef } from "@/lib/tables/types";
import type { TaskStatus } from "@/lib/constants/task-status";
import { evaluateKpi } from "./evaluate-kpi";
import { createKpiContext } from "./kpi-context";

type KpiSpec = NonNullable<ViewConfig["bindings"]["kpis"]>[number];

/**
 * Subset of kit projection fields read by `loadRuntimeState`. Kits that need
 * specific runtime data declare these in their projection; kits that don't
 * leave them undefined.
 */
export interface KitProjectionShape {
  heroTableId?: string;
  cadenceScheduleId?: string;
  runsBlueprintId?: string;
  kpiSpecs?: KpiSpec[];
  blueprintIds?: string[];
  scheduleIds?: string[];
}

/**
 * Server-only loader: assembles a `RuntimeState` for the kit's `buildModel`.
 * Phase 2 makes this kit-aware — based on `kitId` we populate different
 * subsets of the optional Phase 2 fields. Tracker needs heroTable + cadence
 * + KPIs; Workflow Hub needs blueprintLastRuns + counts + failedTasks.
 *
 * Generic baseline (recentTaskCount, scheduleCadence) is always populated
 * for compat with the placeholder kit and Phase 1.1 behavior.
 */
async function loadRuntimeStateUncached(
  app: AppDetail,
  bindings: ResolvedBindings,
  kitId: KitId,
  projection: KitProjectionShape
): Promise<RuntimeState> {
  const baseline = await loadBaseline(app);

  if (kitId === "tracker") {
    return {
      ...baseline,
      cadence: await loadCadence(app.manifest, projection.cadenceScheduleId),
      heroTable: await loadHeroTable(projection.heroTableId),
      evaluatedKpis: await loadEvaluatedKpis(projection.kpiSpecs ?? []),
    };
  }

  if (kitId === "workflow-hub") {
    return {
      ...baseline,
      cadence: await loadCadence(app.manifest, undefined),
      blueprintLastRuns: await loadBlueprintLastRuns(bindings.blueprintIds),
      blueprintRunCounts: await loadBlueprintRunCounts(bindings.blueprintIds),
      failedTasks: await loadFailedTasks(app.id, 10),
      evaluatedKpis: await loadEvaluatedKpis(projection.kpiSpecs ?? []),
    };
  }

  // placeholder + any unrecognized kit: just baseline
  return baseline;
}

async function loadBaseline(app: AppDetail): Promise<RuntimeState> {
  let recentTaskCount: number | undefined;
  try {
    const rows = db
      .select({ value: count() })
      .from(tasks)
      .where(eq(tasks.projectId, app.id))
      .all();
    recentTaskCount = rows[0]?.value ?? 0;
  } catch {
    recentTaskCount = undefined;
  }
  const firstCron = app.manifest.schedules[0]?.cron;
  const scheduleCadence = firstCron ? humanizeCron(firstCron) : null;
  return { app, recentTaskCount, scheduleCadence };
}

async function loadCadence(
  manifest: AppManifest,
  scheduleId: string | undefined
): Promise<CadenceChipData | null> {
  const sched = scheduleId
    ? manifest.schedules.find((s) => s.id === scheduleId)
    : manifest.schedules[0];
  if (!sched?.cron) return null;
  const humanLabel = humanizeCron(sched.cron);

  let nextFireMs: number | null = null;
  if (sched.id) {
    try {
      const row = db
        .select({ value: schedules.nextFireAt })
        .from(schedules)
        .where(eq(schedules.id, sched.id))
        .get();
      nextFireMs = row?.value ? row.value.getTime() : null;
    } catch {
      nextFireMs = null;
    }
  }
  return { humanLabel, nextFireMs };
}

async function loadHeroTable(
  heroTableId: string | undefined
): Promise<HeroTableData | null> {
  if (!heroTableId) return null;
  try {
    const mod = await import("@/lib/data/tables");
    const cols = await mod.getColumns(heroTableId);
    const columns: ColumnDef[] = cols.map((c) => ({
      name: c.name,
      displayName: c.displayName,
      dataType: c.dataType as ColumnDef["dataType"],
      position: c.position,
      required: c.required,
      defaultValue: c.defaultValue,
      config: c.config ? (JSON.parse(c.config) as ColumnDef["config"]) : null,
    }));
    const rows = db
      .select()
      .from(userTableRows)
      .where(eq(userTableRows.tableId, heroTableId))
      .orderBy(desc(userTableRows.createdAt))
      .limit(50)
      .all();
    return { tableId: heroTableId, columns, rows };
  } catch {
    return null;
  }
}

async function loadBlueprintLastRuns(
  blueprintIds: string[]
): Promise<Record<string, RuntimeTaskSummary | null>> {
  const out: Record<string, RuntimeTaskSummary | null> = {};
  if (blueprintIds.length === 0) return out;
  for (const id of blueprintIds) out[id] = null;
  try {
    const rows = db
      .select()
      .from(tasks)
      .where(inArray(tasks.assignedAgent, blueprintIds))
      .orderBy(desc(tasks.createdAt))
      .limit(50)
      .all();
    for (const row of rows) {
      const bp = row.assignedAgent ?? "";
      if (bp && out[bp] == null) {
        out[bp] = {
          id: row.id,
          title: row.title,
          status: row.status as TaskStatus,
          createdAt: row.createdAt.getTime(),
          result: row.result,
        };
      }
    }
  } catch {
    // leave nulls
  }
  return out;
}

async function loadBlueprintRunCounts(
  blueprintIds: string[]
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (blueprintIds.length === 0) return out;
  const since = new Date(Date.now() - 30 * 86_400_000);
  for (const id of blueprintIds) out[id] = 0;
  try {
    for (const bpId of blueprintIds) {
      const rows = db
        .select({ value: count() })
        .from(tasks)
        .where(and(eq(tasks.assignedAgent, bpId), gte(tasks.createdAt, since)))
        .all();
      out[bpId] = rows[0]?.value ?? 0;
    }
  } catch {
    // leave zeros
  }
  return out;
}

async function loadFailedTasks(
  projectId: string,
  limit: number
): Promise<RuntimeTaskSummary[]> {
  try {
    const rows = db
      .select()
      .from(tasks)
      .where(and(eq(tasks.projectId, projectId), eq(tasks.status, "failed")))
      .orderBy(desc(tasks.createdAt))
      .limit(limit)
      .all();
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status as TaskStatus,
      createdAt: r.createdAt.getTime(),
      result: r.result,
    }));
  } catch {
    return [];
  }
}

async function loadEvaluatedKpis(specs: KpiSpec[]): Promise<KpiTile[]> {
  if (specs.length === 0) return [];
  const ctx = createKpiContext();
  const tiles: KpiTile[] = [];
  for (const spec of specs) {
    try {
      tiles.push(await evaluateKpi(spec, ctx));
    } catch {
      tiles.push({ id: spec.id, label: spec.label, value: "—" });
    }
  }
  return tiles;
}

/**
 * Cached entry point. Cache key includes the app id + kit id so different
 * kits (during inference rollouts) don't collide. 30s revalidate.
 */
export function loadRuntimeState(
  app: AppDetail,
  bindings: ResolvedBindings,
  kitId: KitId,
  projection: KitProjectionShape
): Promise<RuntimeState> {
  const cached = unstable_cache(
    () => loadRuntimeStateUncached(app, bindings, kitId, projection),
    ["app-runtime", app.id, kitId],
    { revalidate: 30, tags: [`app-runtime:${app.id}`] }
  );
  return cached();
}
