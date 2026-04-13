import { z } from "zod";
import { COLUMN_DATA_TYPES } from "@/lib/constants/table-status";
import {
  APP_DIFFICULTY_LEVELS,
  APP_INSTANCE_STATUSES,
  APP_PERMISSIONS,
  APP_SOURCE_TYPES,
  APP_TRUST_LEVELS,
} from "./types";

const columnConfigSchema = z
  .object({
    options: z.array(z.string()).optional(),
    formula: z.string().optional(),
    formulaType: z
      .enum(["arithmetic", "text_concat", "date_diff", "conditional", "aggregate"])
      .optional(),
    resultType: z.enum(COLUMN_DATA_TYPES).optional(),
    dependencies: z.array(z.string()).optional(),
    targetTableId: z.string().optional(),
    displayColumn: z.string().optional(),
  })
  .nullable()
  .optional();

export const appColumnDefSchema = z.object({
  name: z.string().min(1).max(64),
  displayName: z.string().min(1).max(128),
  dataType: z.enum(COLUMN_DATA_TYPES),
  position: z.number().int().min(0),
  required: z.boolean().optional(),
  defaultValue: z.string().nullable().optional(),
  config: columnConfigSchema,
});

const manifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(120),
  version: z.string().min(1).max(32),
  description: z.string().min(1).max(500),
  category: z.string().min(1).max(48),
  tags: z.array(z.string().min(1).max(32)).max(8),
  difficulty: z.enum(APP_DIFFICULTY_LEVELS),
  estimatedSetupMinutes: z.number().int().min(1).max(240),
  icon: z.string().min(1).max(48),
  trustLevel: z.enum(APP_TRUST_LEVELS),
  permissions: z.array(z.enum(APP_PERMISSIONS)).min(1),
  sidebarLabel: z.string().min(1).max(80).optional(),
});

const linkedAssetSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(120),
  description: z.string().max(240).optional(),
});

const tableTemplateSchema = z.object({
  key: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(120),
  description: z.string().max(240).optional(),
  columns: z.array(appColumnDefSchema).min(1),
  sampleRows: z.array(z.record(z.string(), z.unknown())).max(200),
});

const scheduleTemplateSchema = z.object({
  key: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(120),
  description: z.string().max(240).optional(),
  prompt: z.string().min(1),
  cronExpression: z.string().min(1),
  agentProfile: z.string().optional(),
});

const actionSchema = z.object({
  key: z.string().regex(/^[a-z0-9-]+$/),
  label: z.string().min(1).max(120),
  description: z.string().max(240).optional(),
  variant: z.enum(["default", "outline", "secondary"]).optional(),
  action: z.discriminatedUnion("type", [
    z.object({ type: z.literal("openProject") }),
    z.object({ type: z.literal("openPage"), pageKey: z.string().min(1) }),
    z.object({ type: z.literal("openTable"), tableKey: z.string().min(1) }),
    z.object({ type: z.literal("openSchedules") }),
    z.object({ type: z.literal("openWorkflows") }),
    z.object({ type: z.literal("clearSampleData") }),
  ]),
});

const widgetSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("hero"),
    title: z.string().min(1),
    description: z.string().min(1),
    eyebrow: z.string().optional(),
  }),
  z.object({
    type: z.literal("stats"),
    title: z.string().optional(),
    metrics: z
      .array(
        z.object({
          key: z.string().regex(/^[a-z0-9-]+$/),
          label: z.string().min(1).max(120),
          tableKey: z.string().min(1),
          aggregation: z.enum(["rowCount", "sampleCount"]),
          format: z.enum(["number"]).optional(),
        })
      )
      .min(1),
  }),
  z.object({
    type: z.literal("table"),
    title: z.string().min(1),
    description: z.string().optional(),
    tableKey: z.string().min(1),
    columns: z.array(z.string().min(1)).optional(),
    limit: z.number().int().min(1).max(50).optional(),
  }),
  z.object({
    type: z.literal("text"),
    title: z.string().optional(),
    markdown: z.string().min(1),
  }),
  z.object({
    type: z.literal("actions"),
    title: z.string().min(1),
    actions: z.array(actionSchema).min(1),
  }),
  z.object({
    type: z.literal("linkedAssets"),
    title: z.string().min(1),
    showProfiles: z.boolean().optional(),
    showBlueprints: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("scheduleList"),
    title: z.string().min(1),
    description: z.string().optional(),
  }),
]);

const pageSchema = z.object({
  key: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(120),
  description: z.string().max(240).optional(),
  path: z.string().regex(/^[a-z0-9-]*$/).optional(),
  icon: z.string().min(1).max(48).optional(),
  widgets: z.array(widgetSchema).min(1),
});

export const appUiSchemaSchema = z.object({
  pages: z.array(pageSchema).min(1),
});

export const appBundleSchema = z.object({
  manifest: manifestSchema,
  setupChecklist: z.array(z.string().min(1).max(240)).min(1),
  profiles: z.array(linkedAssetSchema),
  blueprints: z.array(linkedAssetSchema),
  tables: z.array(tableTemplateSchema),
  schedules: z.array(scheduleTemplateSchema),
  ui: appUiSchemaSchema,
});

export const appResourceMapSchema = z.object({
  tables: z.record(z.string(), z.string()).default({}),
  schedules: z.record(z.string(), z.string()).default({}),
});

export const appInstanceStatusSchema = z.enum(APP_INSTANCE_STATUSES);
export const appSourceTypeSchema = z.enum(APP_SOURCE_TYPES);
