/**
 * Project-to-AppBundle exporter.
 *
 * Converts an existing project's artifacts (tables, schedules, profiles)
 * into a valid AppBundle with sanitized seed data. Uses rule-based
 * inference to auto-assign sanitization strategies per column.
 */

import { introspectProject } from "./introspector";
import { sanitizeTableData } from "./seed-generator";
import { scanForPii } from "./pii-scanner";
import { appBundleSchema } from "./validation";
import { listRows } from "@/lib/data/tables";
import type {
  AppBundle,
  AppBundleManifest,
  AppPageDefinition,
  AppPermission,
  AppScheduleTemplate,
  AppTableTemplate,
  AppWidget,
} from "./types";
import type { SeedDataConfig } from "./sanitizers/types";
import type { ColumnDef } from "@/lib/tables/types";

// ── Export options ────────────────────────────────────────────────────

export interface ExportOptions {
  appName: string;
  appDescription: string;
  category?: string;
  includeTables?: string[];
  includeSchedules?: string[];
  seedDataRows?: number;
}

export interface ExportResult {
  bundle: AppBundle;
  stats: {
    tablesExported: number;
    schedulesExported: number;
    totalSeedRows: number;
    piiClean: boolean;
  };
}

// ── Strategy inference ───────────────────────────────────────────────

const NAME_PATTERNS: Record<string, { strategy: string; params?: Record<string, unknown> }> = {
  email: { strategy: "faker", params: { fakerMethod: "internet.email" } },
  name: { strategy: "faker", params: { fakerMethod: "person.firstName" } },
  first_name: { strategy: "faker", params: { fakerMethod: "person.firstName" } },
  last_name: { strategy: "faker", params: { fakerMethod: "person.lastName" } },
  company: { strategy: "faker", params: { fakerMethod: "company.name" } },
  city: { strategy: "faker", params: { fakerMethod: "address.city" } },
  address: { strategy: "redact" },
  phone: { strategy: "redact" },
  ssn: { strategy: "redact" },
  password: { strategy: "redact" },
  secret: { strategy: "redact" },
  token: { strategy: "redact" },
};

const TYPE_STRATEGIES: Record<string, { strategy: string; params?: Record<string, unknown> }> = {
  number: { strategy: "shift", params: { range: 10 } },
  date: { strategy: "shift", params: { range: 30 } },
  boolean: { strategy: "keep" },
  select: { strategy: "keep" },
  multi_select: { strategy: "keep" },
  url: { strategy: "redact" },
};

function inferStrategy(col: ColumnDef): { strategy: string; params?: Record<string, unknown> } {
  // Check name-based patterns first (more specific)
  const lowerName = col.name.toLowerCase();
  for (const [pattern, rule] of Object.entries(NAME_PATTERNS)) {
    if (lowerName.includes(pattern)) {
      return rule;
    }
  }

  // Fall back to type-based strategies
  const typeRule = TYPE_STRATEGIES[col.dataType];
  if (typeRule) return typeRule;

  // Default: randomize text columns
  return { strategy: "randomize" };
}

function buildSanitizationConfig(
  tables: Array<{ key: string; columns: ColumnDef[] }>,
): SeedDataConfig {
  const config: SeedDataConfig = { tables: {} };

  for (const table of tables) {
    const sanitize: Record<string, { strategy: string; params?: Record<string, unknown> }> = {};
    for (const col of table.columns) {
      sanitize[col.name] = inferStrategy(col);
    }
    config.tables[table.key] = { sanitize };
  }

  return config;
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

// ── Main exporter ────────────────────────────────────────────────────

export async function exportProjectToBundle(
  projectId: string,
  options: ExportOptions,
): Promise<ExportResult> {
  const fingerprint = await introspectProject(projectId);
  const maxRows = options.seedDataRows ?? 25;
  const appSlug = slugify(options.appName);
  const appId = `${appSlug}-${randomSuffix()}`;

  // Filter tables if specified
  let tablesToExport = fingerprint.tables;
  if (options.includeTables?.length) {
    const includeSet = new Set(options.includeTables);
    tablesToExport = tablesToExport.filter(
      (t) => includeSet.has(t.id) || includeSet.has(t.name),
    );
  }

  // Filter schedules if specified
  let schedulesToExport = fingerprint.schedules;
  if (options.includeSchedules?.length) {
    const includeSet = new Set(options.includeSchedules);
    schedulesToExport = schedulesToExport.filter(
      (s) => includeSet.has(s.id) || includeSet.has(s.name),
    );
  }

  // Build table templates with sanitized seed data
  const tableTemplates: AppTableTemplate[] = [];
  const sanitizationConfig = buildSanitizationConfig(
    tablesToExport.map((t) => ({
      key: slugify(t.name),
      columns: t.columns,
    })),
  );

  let totalSeedRows = 0;

  for (const table of tablesToExport) {
    const tableKey = ns(appId, slugify(table.name));
    const rows = await listRows(table.id);
    const parsedRows = rows.slice(0, maxRows).map((r) => {
      try {
        return JSON.parse(r.data) as Record<string, unknown>;
      } catch {
        return {};
      }
    });

    // Sanitize real data
    const columnNames = table.columns.map((c) => c.name);
    const sanitizedRows = sanitizeTableData(
      slugify(table.name),
      columnNames,
      parsedRows,
      sanitizationConfig,
    );

    totalSeedRows += sanitizedRows.length;

    tableTemplates.push({
      key: tableKey,
      name: table.name,
      description: table.description ?? undefined,
      columns: table.columns.map((col, i) => ({
        name: col.name,
        displayName: col.displayName,
        dataType: col.dataType as "text",
        position: i,
        required: col.required ?? false,
        defaultValue: col.defaultValue ?? null,
        config: col.config ?? null,
      })),
      sampleRows: sanitizedRows,
    });
  }

  // Verify PII was stripped
  const piiCheck: Record<string, Record<string, unknown>[]> = {};
  for (const t of tableTemplates) {
    piiCheck[t.key] = t.sampleRows;
  }
  const piiScan = scanForPii(piiCheck);

  // Build schedule templates
  const scheduleTemplates: AppScheduleTemplate[] = schedulesToExport.map(
    (s) => ({
      key: ns(appId, slugify(s.name)),
      name: s.name,
      prompt: s.prompt,
      cronExpression: s.cronExpression,
      agentProfile: s.agentProfile ?? undefined,
    }),
  );

  // Infer permissions
  const permissions: AppPermission[] = ["projects:create"];
  if (tableTemplates.length > 0) {
    permissions.push("tables:create");
    if (totalSeedRows > 0) permissions.push("tables:seed");
  }
  if (scheduleTemplates.length > 0) permissions.push("schedules:create");

  // Build manifest
  const manifest: AppBundleManifest = {
    id: appId,
    name: options.appName,
    version: "1.0.0",
    description: options.appDescription,
    category: options.category ?? "general",
    tags: [],
    difficulty: "beginner",
    estimatedSetupMinutes: Math.max(3, tableTemplates.length * 2),
    icon: "Rocket",
    trustLevel: "private",
    permissions,
    sidebarLabel: options.appName,
  };

  // Build default overview page
  const widgets: AppWidget[] = [
    {
      type: "hero",
      title: manifest.name,
      description: manifest.description,
      eyebrow: `Exported from ${fingerprint.projectName}`,
    },
  ];

  if (tableTemplates.length > 0) {
    widgets.push({
      type: "stats",
      title: "Overview",
      metrics: tableTemplates.map((t) => ({
        key: `${t.key}-count`,
        label: t.name,
        tableKey: t.key,
        aggregation: "rowCount" as const,
        format: "number" as const,
      })),
    });

    for (const table of tableTemplates) {
      widgets.push({
        type: "table",
        title: table.name,
        description: table.description,
        tableKey: table.key,
        limit: 10,
      });
    }
  }

  if (scheduleTemplates.length > 0) {
    widgets.push({
      type: "scheduleList",
      title: "Automations",
    });
  }

  widgets.push({
    type: "actions",
    title: "Quick Actions",
    actions: [
      { key: "open-project", label: "Open Project", action: { type: "openProject" } },
      { key: "clear-samples", label: "Clear Sample Data", variant: "outline", action: { type: "clearSampleData" } },
    ],
  });

  const pages: AppPageDefinition[] = [
    {
      key: "overview",
      title: "Overview",
      description: `${manifest.name} dashboard`,
      widgets,
    },
  ];

  const bundle: AppBundle = {
    manifest,
    setupChecklist: [
      `Install the ${manifest.name} app`,
      "Review tables and replace sample data with real data",
      "Activate paused schedules when ready",
    ],
    profiles: [],
    blueprints: [],
    tables: tableTemplates,
    schedules: scheduleTemplates,
    ui: { pages },
  };

  // Validate
  const validated = appBundleSchema.parse(bundle);

  return {
    bundle: validated,
    stats: {
      tablesExported: tableTemplates.length,
      schedulesExported: scheduleTemplates.length,
      totalSeedRows,
      piiClean: piiScan.clean,
    },
  };
}
