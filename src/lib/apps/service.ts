import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  projects,
  schedules,
  appInstances,
  userTableTriggers,
  userTableViews,
  notifications,
} from "@/lib/db/schema";
import type { AppInstanceDbRow } from "@/lib/db/schema";
import { addRows, createTable, deleteRows, getTable, listRows } from "@/lib/data/tables";
import { getAppBundle, listAppBundles } from "./registry";
import { appResourceMapSchema } from "./validation";
import type {
  AppBundle,
  AppBundleManifest,
  AppCatalogEntry,
  AppInstanceRecord,
  AppResourceMap,
  AppSidebarGroup,
  AppUiSchema,
} from "./types";

class AppRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppRuntimeError";
  }
}

function parseResourceMap(raw: string | null | undefined): AppResourceMap {
  let parsedRaw: unknown = {};

  if (raw) {
    try {
      parsedRaw = JSON.parse(raw);
    } catch {
      parsedRaw = {};
    }
  }

  const parsed = appResourceMapSchema.safeParse(parsedRaw);
  return parsed.success ? parsed.data : { tables: {}, schedules: {} };
}

function safeParseJson<T>(raw: string, fallback: T, label: string): { value: T; ok: boolean } {
  try {
    return { value: JSON.parse(raw) as T, ok: true };
  } catch (err) {
    console.error(`[apps] corrupt ${label} JSON:`, err);
    return { value: fallback, ok: false };
  }
}

const CORRUPT_MANIFEST: AppBundleManifest = {
  id: "unknown",
  name: "Unknown App",
  version: "0.0.0",
  description: "Manifest data is corrupt",
  category: "unknown",
  tags: [],
  difficulty: "beginner",
  estimatedSetupMinutes: 0,
  icon: "AlertTriangle",
  trustLevel: "community",
  permissions: [],
};

const CORRUPT_UI: AppUiSchema = { pages: [] };

function hydrateInstance(row: AppInstanceDbRow, bundle: AppBundle): AppInstanceRecord {
  const manifest = safeParseJson<AppBundleManifest>(row.manifestJson, CORRUPT_MANIFEST, `manifest for ${row.appId}`);
  const ui = safeParseJson<AppUiSchema>(row.uiSchemaJson, CORRUPT_UI, `ui schema for ${row.appId}`);
  const isCorrupt = !manifest.ok || !ui.ok;

  return {
    id: row.id,
    appId: row.appId,
    name: row.name,
    version: row.version,
    projectId: row.projectId ?? null,
    status: isCorrupt ? "corrupt" : row.status,
    sourceType: row.sourceType,
    bootstrapError: isCorrupt
      ? `Manifest or UI schema JSON is corrupt — uninstall and reinstall to fix`
      : (row.bootstrapError ?? null),
    installedAt: row.installedAt,
    bootstrappedAt: row.bootstrappedAt ?? null,
    updatedAt: row.updatedAt,
    manifest: manifest.value,
    ui: ui.value,
    resourceMap: parseResourceMap(row.resourceMapJson),
    bundle,
  };
}

export function getAppInstance(appId: string): AppInstanceRecord | null {
  const row = db.select().from(appInstances).where(eq(appInstances.appId, appId)).get();
  if (!row) return null;

  const bundle = getAppBundle(appId);
  if (!bundle) {
    throw new AppRuntimeError(`Bundle "${appId}" is no longer available`);
  }

  return hydrateInstance(row, bundle);
}

export function listInstalledAppInstances(): AppInstanceRecord[] {
  return db
    .select()
    .from(appInstances)
    .all()
    .flatMap((row) => {
      const bundle = getAppBundle(row.appId);
      return bundle ? [hydrateInstance(row, bundle)] : [];
    });
}

export function listAppCatalog(): AppCatalogEntry[] {
  const installed = new Map(
    listInstalledAppInstances().map((instance) => [instance.appId, instance])
  );

  return listAppBundles().map((bundle) => {
    const instance = installed.get(bundle.manifest.id) ?? null;

    return {
      appId: bundle.manifest.id,
      name: bundle.manifest.name,
      version: bundle.manifest.version,
      description: bundle.manifest.description,
      category: bundle.manifest.category,
      tags: bundle.manifest.tags,
      difficulty: bundle.manifest.difficulty,
      estimatedSetupMinutes: bundle.manifest.estimatedSetupMinutes,
      icon: bundle.manifest.icon,
      trustLevel: bundle.manifest.trustLevel,
      permissions: bundle.manifest.permissions,
      tableCount: bundle.tables.length,
      scheduleCount: bundle.schedules.length,
      profileCount: bundle.profiles.length,
      blueprintCount: bundle.blueprints.length,
      setupChecklistCount: bundle.setupChecklist.length,
      installed: Boolean(instance),
      installedStatus: instance?.status ?? null,
      projectId: instance?.projectId ?? null,
    };
  });
}

export function getAppSidebarGroups(): AppSidebarGroup[] {
  return listInstalledAppInstances()
    .filter((instance) => instance.status === "ready")
    .map((instance) => ({
      appId: instance.appId,
      label: instance.manifest.sidebarLabel ?? instance.manifest.name,
      icon: instance.manifest.icon,
      items: instance.ui.pages.map((page) => {
        const suffix = page.path ? `/${page.path}` : "";
        return {
          title: page.title,
          href: `/apps/${instance.appId}${suffix}`,
          icon: page.icon ?? instance.manifest.icon,
        };
      }),
    }));
}

export async function installApp(appId: string, projectName?: string): Promise<AppInstanceRecord> {
  const bundle = getAppBundle(appId);
  if (!bundle) {
    throw new AppRuntimeError(`App "${appId}" not found`);
  }

  // Fast-path: already installed — return existing instance
  const existing = getAppInstance(appId);
  if (existing) {
    return existing;
  }

  const now = new Date();
  const projectId = crypto.randomUUID();
  const instanceId = crypto.randomUUID();

  await db.insert(projects).values({
    id: projectId,
    name: projectName?.trim() || bundle.manifest.name,
    description: bundle.manifest.description,
    workingDirectory: null,
    status: "active",
    createdAt: now,
    updatedAt: now,
  });

  try {
    await db.insert(appInstances).values({
      id: instanceId,
      appId: bundle.manifest.id,
      name: bundle.manifest.name,
      version: bundle.manifest.version,
      projectId,
      manifestJson: JSON.stringify(bundle.manifest),
      uiSchemaJson: JSON.stringify(bundle.ui),
      resourceMapJson: JSON.stringify({ tables: {}, schedules: {} }),
      status: "installing",
      sourceType: "builtin",
      bootstrapError: null,
      installedAt: now,
      bootstrappedAt: null,
      updatedAt: now,
    });
  } catch (err) {
    // UNIQUE constraint race: another request inserted first — return that instance
    if (err instanceof Error && err.message.includes("UNIQUE constraint failed")) {
      const raceWinner = getAppInstance(appId);
      if (raceWinner) return raceWinner;
    }
    throw err;
  }

  return bootstrapApp(appId);
}

export async function bootstrapApp(appId: string): Promise<AppInstanceRecord> {
  const bundle = getAppBundle(appId);
  const current = getAppInstance(appId);

  if (!bundle || !current) {
    throw new AppRuntimeError(`Installed app "${appId}" not found`);
  }

  if (!current.projectId) {
    throw new AppRuntimeError(`App "${appId}" is missing its linked project`);
  }

  const updatedAt = new Date();
  db.update(appInstances)
    .set({
      status: "bootstrapping",
      bootstrapError: null,
      updatedAt,
    })
    .where(eq(appInstances.appId, appId))
    .run();

  const resourceMap = current.resourceMap;

  try {
    for (const tableTemplate of bundle.tables) {
      if (!resourceMap.tables[tableTemplate.key]) {
        const table = await createTable({
          name: tableTemplate.name,
          description: tableTemplate.description ?? null,
          projectId: current.projectId,
          columns: tableTemplate.columns,
          source: "template",
        });

        resourceMap.tables[tableTemplate.key] = table.id;

        if (tableTemplate.sampleRows.length > 0) {
          await addRows(
            table.id,
            tableTemplate.sampleRows.map((row) => ({
              data: row._sample === true ? row : { ...row, _sample: true },
              createdBy: "system",
            }))
          );
        }
      }
    }

    for (const scheduleTemplate of bundle.schedules) {
      if (!resourceMap.schedules[scheduleTemplate.key]) {
        const scheduleId = crypto.randomUUID();
        const now = new Date();

        await db.insert(schedules).values({
          id: scheduleId,
          projectId: current.projectId,
          name: scheduleTemplate.name,
          prompt: scheduleTemplate.prompt,
          cronExpression: scheduleTemplate.cronExpression,
          assignedAgent: null,
          agentProfile: scheduleTemplate.agentProfile ?? null,
          recurs: true,
          status: "paused",
          maxFirings: null,
          firingCount: 0,
          expiresAt: null,
          lastFiredAt: null,
          nextFireAt: null,
          type: "scheduled",
          heartbeatChecklist: null,
          activeHoursStart: null,
          activeHoursEnd: null,
          activeTimezone: "UTC",
          suppressionCount: 0,
          lastActionAt: null,
          heartbeatBudgetPerDay: null,
          heartbeatSpentToday: 0,
          heartbeatBudgetResetAt: null,
          avgTurnsPerFiring: null,
          lastTurnCount: null,
          failureStreak: 0,
          lastFailureReason: null,
          maxTurns: null,
          maxTurnsSetAt: null,
          maxRunDurationSec: null,
          turnBudgetBreachStreak: 0,
          createdAt: now,
          updatedAt: now,
        });

        resourceMap.schedules[scheduleTemplate.key] = scheduleId;
      }
    }

    // ── Tier 1 primitives ──

    // Triggers
    if (bundle.triggers) {
      if (!resourceMap.triggers) resourceMap.triggers = {};
      for (const trigger of bundle.triggers) {
        if (!resourceMap.triggers[trigger.key]) {
          const tableId = resourceMap.tables[trigger.tableKey];
          if (!tableId) continue; // skip if referenced table wasn't provisioned
          const triggerId = crypto.randomUUID();
          const now = new Date();
          await db.insert(userTableTriggers).values({
            id: triggerId,
            tableId,
            name: trigger.name,
            triggerEvent: trigger.event,
            condition: null,
            actionType: trigger.action === "notify" ? "create_task" : "run_workflow",
            actionConfig: JSON.stringify(trigger.actionConfig),
            status: "paused",
            fireCount: 0,
            lastFiredAt: null,
            createdAt: now,
            updatedAt: now,
          });
          resourceMap.triggers[trigger.key] = triggerId;
        }
      }
    }

    // Notifications (template-based — inserted as initial notifications)
    if (bundle.notifications) {
      if (!resourceMap.notifications) resourceMap.notifications = {};
      for (const notif of bundle.notifications) {
        if (!resourceMap.notifications[notif.key]) {
          const notifId = crypto.randomUUID();
          await db.insert(notifications).values({
            id: notifId,
            taskId: null,
            type: "agent_message",
            title: notif.title,
            body: notif.body,
            read: false,
            toolName: null,
            toolInput: null,
            response: null,
            respondedAt: null,
            createdAt: new Date(),
          });
          resourceMap.notifications[notif.key] = notifId;
        }
      }
    }

    // Saved views
    if (bundle.savedViews) {
      if (!resourceMap.savedViews) resourceMap.savedViews = {};
      for (const view of bundle.savedViews) {
        if (!resourceMap.savedViews[view.key]) {
          const tableId = resourceMap.tables[view.tableKey];
          if (!tableId) continue;
          const viewId = crypto.randomUUID();
          const now = new Date();
          const config = JSON.stringify({
            filters: view.filters,
            sortColumn: view.sortColumn,
            sortDirection: view.sortDirection,
            visibleColumns: view.visibleColumns,
          });
          await db.insert(userTableViews).values({
            id: viewId,
            tableId,
            name: view.name,
            type: "grid",
            config,
            isDefault: false,
            createdAt: now,
            updatedAt: now,
          });
          resourceMap.savedViews[view.key] = viewId;
        }
      }
    }

    // Documents and envVars are tracked in the resource map but
    // don't create DB rows — they're metadata declarations used by
    // the install wizard and runtime, not provisioned resources.
    if (bundle.documents) {
      if (!resourceMap.documents) resourceMap.documents = {};
      for (const doc of bundle.documents) {
        if (!resourceMap.documents[doc.key]) {
          resourceMap.documents[doc.key] = `declared:${doc.key}`;
        }
      }
    }

    if (bundle.envVars) {
      if (!resourceMap.envVars) resourceMap.envVars = {};
      for (const envVar of bundle.envVars) {
        if (!resourceMap.envVars[envVar.key]) {
          resourceMap.envVars[envVar.key] = `declared:${envVar.key}`;
        }
      }
    }

    db.update(appInstances)
      .set({
        status: "ready",
        resourceMapJson: JSON.stringify(resourceMap),
        bootstrapError: null,
        bootstrappedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(appInstances.appId, appId))
      .run();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to bootstrap app instance";

    db.update(appInstances)
      .set({
        status: "failed",
        bootstrapError: message,
        updatedAt: new Date(),
      })
      .where(eq(appInstances.appId, appId))
      .run();

    throw new AppRuntimeError(message);
  }

  const hydrated = getAppInstance(appId);
  if (!hydrated) {
    throw new AppRuntimeError(`Failed to reload app "${appId}" after bootstrap`);
  }

  return hydrated;
}

export function setAppInstanceStatus(appId: string, status: "ready" | "disabled"): AppInstanceRecord {
  const existing = getAppInstance(appId);
  if (!existing) {
    throw new AppRuntimeError(`App "${appId}" is not installed`);
  }

  db.update(appInstances)
    .set({
      status,
      updatedAt: new Date(),
    })
    .where(eq(appInstances.appId, appId))
    .run();

  return getAppInstance(appId)!;
}

export async function clearAppSampleData(appId: string): Promise<{ deletedRows: number }> {
  const instance = getAppInstance(appId);
  if (!instance) {
    throw new AppRuntimeError(`App "${appId}" is not installed`);
  }

  let deletedRows = 0;

  for (const tableId of Object.values(instance.resourceMap.tables)) {
    const rows = await listRows(tableId);
    const sampleRowIds = rows
      .filter((row) => {
        try {
          const data = JSON.parse(row.data) as Record<string, unknown>;
          return data._sample === true;
        } catch {
          return false;
        }
      })
      .map((row) => row.id);

    if (sampleRowIds.length > 0) {
      await deleteRows(sampleRowIds);
      deletedRows += sampleRowIds.length;
    }
  }

  return { deletedRows };
}

export function uninstallApp(appId: string): void {
  const instance = getAppInstance(appId);
  if (!instance) {
    throw new AppRuntimeError(`App "${appId}" is not installed`);
  }

  const scheduleIds = Object.values(instance.resourceMap.schedules);
  if (scheduleIds.length > 0) {
    db.delete(schedules).where(inArray(schedules.id, scheduleIds)).run();
  }

  db.delete(appInstances).where(eq(appInstances.appId, appId)).run();
}

export async function getResolvedAppTable(appId: string, tableKey: string) {
  const instance = getAppInstance(appId);
  const tableId = instance?.resourceMap.tables[tableKey];

  if (!tableId) return null;
  return getTable(tableId);
}
