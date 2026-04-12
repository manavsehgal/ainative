/**
 * Bundle synthesizer for the chat app builder.
 *
 * Takes structured args from the LLM (manifest fields, table definitions,
 * schedules, profiles, pages) and produces a valid AppBundle with proper
 * namespacing, defaults, and generated IDs.
 */

import { appBundleSchema } from "./validation";
import type {
  AppBundle,
  AppBundleManifest,
  AppPageDefinition,
  AppPermission,
  AppProfileLink,
  AppScheduleTemplate,
  AppTableTemplate,
  AppWidget,
} from "./types";

// ── Input types (what the LLM provides) ──────────────────────────────

export interface SynthesizeManifestInput {
  name: string;
  description: string;
  category: string;
  tags?: string[];
  difficulty?: "beginner" | "intermediate" | "advanced";
  estimatedSetupMinutes?: number;
  icon?: string;
}

export interface SynthesizeTableInput {
  name: string;
  description?: string;
  columns: Array<{
    name: string;
    displayName: string;
    dataType: string;
    required?: boolean;
  }>;
}

export interface SynthesizeScheduleInput {
  name: string;
  description?: string;
  prompt: string;
  cronExpression: string;
  agentProfile?: string;
}

export interface SynthesizeProfileInput {
  id: string;
  label: string;
  description?: string;
}

export interface SynthesizePageInput {
  title: string;
  description?: string;
  path?: string;
  icon?: string;
  widgets?: AppWidget[];
}

export interface SynthesizeBundleInput {
  manifest: SynthesizeManifestInput;
  tables?: SynthesizeTableInput[];
  schedules?: SynthesizeScheduleInput[];
  profiles?: SynthesizeProfileInput[];
  pages?: SynthesizePageInput[];
}

// ── Helpers ──────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

function ns(appId: string, key: string): string {
  return `${appId}--${key}`;
}

function toKey(name: string): string {
  return slugify(name);
}

function inferPermissions(
  tables: AppTableTemplate[],
  schedules: AppScheduleTemplate[],
  profiles: AppProfileLink[],
): AppPermission[] {
  const perms: AppPermission[] = ["projects:create"];

  if (tables.length > 0) {
    perms.push("tables:create");
  }

  if (schedules.length > 0) {
    perms.push("schedules:create");
  }

  if (profiles.length > 0) {
    perms.push("profiles:link");
  }

  return perms;
}

function buildDefaultWidgets(
  tables: AppTableTemplate[],
  schedules: AppScheduleTemplate[],
  manifest: AppBundleManifest,
): AppWidget[] {
  const widgets: AppWidget[] = [
    {
      type: "hero",
      title: manifest.name,
      description: manifest.description,
      eyebrow: `v${manifest.version}`,
    },
  ];

  // Stats row if we have tables
  if (tables.length > 0) {
    widgets.push({
      type: "stats",
      title: "Overview",
      metrics: tables.map((t) => ({
        key: `${t.key}-count`,
        label: t.name,
        tableKey: t.key,
        aggregation: "rowCount" as const,
        format: "number" as const,
      })),
    });
  }

  // Table widgets for each table
  for (const table of tables) {
    widgets.push({
      type: "table",
      title: table.name,
      description: table.description,
      tableKey: table.key,
      limit: 10,
    });
  }

  // Schedule list if we have schedules
  if (schedules.length > 0) {
    widgets.push({
      type: "scheduleList",
      title: "Automations",
      description: "Scheduled tasks for this app",
    });
  }

  // Quick actions
  widgets.push({
    type: "actions",
    title: "Quick Actions",
    actions: [
      {
        key: "open-project",
        label: "Open Project",
        action: { type: "openProject" },
      },
      {
        key: "clear-sample-data",
        label: "Clear Sample Data",
        variant: "outline",
        action: { type: "clearSampleData" },
      },
    ],
  });

  return widgets;
}

// ── Main synthesizer ─────────────────────────────────────────────────

export function synthesizeBundle(input: SynthesizeBundleInput): AppBundle {
  const slug = slugify(input.manifest.name);
  const appId = `${slug}-${randomSuffix()}`;

  // Build tables with namespace prefixes
  const tables: AppTableTemplate[] = (input.tables ?? []).map((t) => ({
    key: ns(appId, toKey(t.name)),
    name: t.name,
    description: t.description,
    columns: t.columns.map((col, ci) => ({
      name: col.name,
      displayName: col.displayName,
      dataType: col.dataType as "text",
      position: ci,
      required: col.required ?? false,
      defaultValue: null,
      config: null,
    })),
    sampleRows: [],
  }));

  // Build schedules
  const schedules: AppScheduleTemplate[] = (input.schedules ?? []).map((s) => ({
    key: ns(appId, toKey(s.name)),
    name: s.name,
    description: s.description,
    prompt: s.prompt,
    cronExpression: s.cronExpression,
    agentProfile: s.agentProfile,
  }));

  // Build profiles
  const profiles: AppProfileLink[] = (input.profiles ?? []).map((p) => ({
    id: ns(appId, p.id),
    label: p.label,
    description: p.description,
  }));

  // Build manifest
  const manifest: AppBundleManifest = {
    id: appId,
    name: input.manifest.name,
    version: "1.0.0",
    description: input.manifest.description,
    category: input.manifest.category,
    tags: input.manifest.tags ?? [],
    difficulty: input.manifest.difficulty ?? "beginner",
    estimatedSetupMinutes: input.manifest.estimatedSetupMinutes ?? 5,
    icon: input.manifest.icon ?? "Rocket",
    trustLevel: "private",
    permissions: inferPermissions(tables, schedules, profiles),
    sidebarLabel: input.manifest.name,
  };

  // Build pages — use LLM-provided or generate defaults
  const pages: AppPageDefinition[] =
    input.pages && input.pages.length > 0
      ? input.pages.map((p, i) => ({
          key: toKey(p.title) || `page-${i}`,
          title: p.title,
          description: p.description,
          path: p.path ?? (i === 0 ? undefined : toKey(p.title)),
          icon: p.icon,
          widgets: p.widgets ?? buildDefaultWidgets(tables, schedules, manifest),
        }))
      : [
          {
            key: "overview",
            title: "Overview",
            description: `${manifest.name} dashboard`,
            widgets: buildDefaultWidgets(tables, schedules, manifest),
          },
        ];

  const bundle: AppBundle = {
    manifest,
    setupChecklist: [
      `Install the ${manifest.name} app`,
      "Review the generated tables and customize columns as needed",
      "Activate any paused schedules when ready",
    ],
    profiles,
    blueprints: [],
    tables,
    schedules,
    ui: { pages },
  };

  // Validate against the full schema — throws on invalid
  return appBundleSchema.parse(bundle);
}
