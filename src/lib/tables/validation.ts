import { z } from "zod";
import { COLUMN_DATA_TYPES, TABLE_SOURCES, TEMPLATE_CATEGORIES } from "@/lib/constants/table-status";

// ── Column Definition Schema ─────────────────────────────────────────

const columnConfigSchema = z.object({
  options: z.array(z.string()).optional(),
  formula: z.string().optional(),
  formulaType: z.enum(["arithmetic", "text_concat", "date_diff", "conditional", "aggregate"]).optional(),
  resultType: z.enum(COLUMN_DATA_TYPES).optional(),
  dependencies: z.array(z.string()).optional(),
  targetTableId: z.string().optional(),
  displayColumn: z.string().optional(),
}).optional();

const columnDefSchema = z.object({
  name: z.string().min(1).max(64),
  displayName: z.string().min(1).max(128),
  dataType: z.enum(COLUMN_DATA_TYPES),
  position: z.number().int().min(0),
  required: z.boolean().optional(),
  defaultValue: z.string().nullable().optional(),
  config: columnConfigSchema,
});

// ── Table Schemas ────────────────────────────────────────────────────

export const createTableSchema = z.object({
  name: z.string().min(1).max(256),
  description: z.string().max(1024).nullable().optional(),
  projectId: z.string().nullable().optional(),
  columns: z.array(columnDefSchema).optional(),
  source: z.enum(TABLE_SOURCES).optional(),
  templateId: z.string().nullable().optional(),
});

export const updateTableSchema = z.object({
  name: z.string().min(1).max(256).optional(),
  description: z.string().max(1024).nullable().optional(),
  projectId: z.string().nullable().optional(),
});

// ── Column Schemas ───────────────────────────────────────────────────

export const addColumnSchema = z.object({
  name: z.string().min(1).max(64),
  displayName: z.string().min(1).max(128),
  dataType: z.enum(COLUMN_DATA_TYPES),
  required: z.boolean().optional(),
  defaultValue: z.string().nullable().optional(),
  config: columnConfigSchema,
});

export const updateColumnSchema = z.object({
  displayName: z.string().min(1).max(128).optional(),
  dataType: z.enum(COLUMN_DATA_TYPES).optional(),
  required: z.boolean().optional(),
  defaultValue: z.string().nullable().optional(),
  config: columnConfigSchema,
});

export const reorderColumnsSchema = z.object({
  /** Array of column IDs in the desired order */
  columnIds: z.array(z.string()).min(1),
});

// ── Row Schemas ──────────────────────────────────────────────────────

export const addRowsSchema = z.object({
  rows: z.array(
    z.object({
      data: z.record(z.string(), z.unknown()),
      createdBy: z.string().optional(),
    })
  ).min(1).max(1000),
});

export const updateRowSchema = z.object({
  data: z.record(z.string(), z.unknown()),
});

// ── Query Schemas ────────────────────────────────────────────────────

const filterOperators = [
  "eq", "neq", "gt", "gte", "lt", "lte",
  "contains", "starts_with", "in", "is_empty", "is_not_empty",
] as const;

export const filterSpecSchema = z.object({
  column: z.string().min(1),
  operator: z.enum(filterOperators),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]).optional(),
});

export const sortSpecSchema = z.object({
  column: z.string().min(1),
  direction: z.enum(["asc", "desc"]),
});

export const rowQuerySchema = z.object({
  filters: z.array(filterSpecSchema).optional(),
  sorts: z.array(sortSpecSchema).optional(),
  limit: z.number().int().min(1).max(1000).optional(),
  offset: z.number().int().min(0).optional(),
});

// ── Template Schemas ─────────────────────────────────────────────────

export const cloneFromTemplateSchema = z.object({
  templateId: z.string(),
  name: z.string().min(1).max(256),
  projectId: z.string().nullable().optional(),
  includeSampleData: z.boolean().optional(),
});

export const listTemplatesSchema = z.object({
  category: z.enum(TEMPLATE_CATEGORIES).optional(),
  scope: z.enum(["system", "user"]).optional(),
});
