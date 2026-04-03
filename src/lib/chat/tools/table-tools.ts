import { defineTool } from "../tool-registry";
import { z } from "zod";
import { ok, err, type ToolContext } from "./helpers";
import {
  listTables,
  getTable,
  createTable,
  listRows,
  addRows,
  updateRow,
  deleteRows,
  listTemplates,
  cloneFromTemplate,
  addColumn,
  updateColumn,
  deleteColumn,
  reorderColumns,
  getColumns,
} from "@/lib/data/tables";
import {
  extractStructuredData,
  inferColumnTypes,
  importRows,
  createImportRecord,
} from "@/lib/tables/import";
import type { ColumnDef } from "@/lib/tables/types";

export function tableTools(ctx: ToolContext) {
  return [
    // ── Read operations ──────────────────────────────────────────────

    defineTool(
      "list_tables",
      "List all user-defined tables, optionally filtered by project. Returns table name, description, column count, row count, and source.",
      {
        projectId: z
          .string()
          .optional()
          .describe("Filter by project ID. Omit to use active project."),
        source: z
          .enum(["manual", "imported", "agent", "template"])
          .optional()
          .describe("Filter by how the table was created"),
      },
      async (args) => {
        try {
          const effectiveProjectId = args.projectId ?? ctx.projectId ?? undefined;
          const tables = await listTables({
            projectId: effectiveProjectId,
            source: args.source,
          });
          return ok(
            tables.map((t) => ({
              id: t.id,
              name: t.name,
              description: t.description,
              projectName: t.projectName,
              columnCount: t.columnCount,
              rowCount: t.rowCount,
              source: t.source,
            }))
          );
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to list tables");
        }
      }
    ),

    defineTool(
      "get_table_schema",
      "Get the full schema of a table including all column definitions, types, and configurations.",
      {
        tableId: z.string().describe("The table ID to inspect"),
      },
      async (args) => {
        try {
          const table = await getTable(args.tableId);
          if (!table) return err("Table not found");
          const columns = JSON.parse(table.columnSchema) as ColumnDef[];
          return ok({
            id: table.id,
            name: table.name,
            description: table.description,
            rowCount: table.rowCount,
            columns: columns.map((c) => ({
              name: c.name,
              displayName: c.displayName,
              dataType: c.dataType,
              required: c.required,
              config: c.config,
            })),
          });
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to get table schema");
        }
      }
    ),

    defineTool(
      "query_table",
      "Query rows from a table with optional filters and sorting. Filters use structured operators (eq, neq, gt, gte, lt, lte, contains, starts_with, in, is_empty, is_not_empty).",
      {
        tableId: z.string().describe("Table ID to query"),
        filters: z
          .array(
            z.object({
              column: z.string(),
              operator: z.enum([
                "eq", "neq", "gt", "gte", "lt", "lte",
                "contains", "starts_with", "in", "is_empty", "is_not_empty",
              ]),
              value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]).optional(),
            })
          )
          .optional()
          .describe("Filter conditions"),
        sorts: z
          .array(z.object({ column: z.string(), direction: z.enum(["asc", "desc"]) }))
          .optional()
          .describe("Sort order"),
        limit: z.number().min(1).max(500).optional().describe("Max rows to return (default 100)"),
      },
      async (args) => {
        try {
          const rows = await listRows(args.tableId, {
            filters: args.filters,
            sorts: args.sorts,
            limit: args.limit,
          });
          return ok(
            rows.map((r) => ({
              id: r.id,
              data: JSON.parse(r.data),
              position: r.position,
            }))
          );
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to query table");
        }
      }
    ),

    defineTool(
      "search_table",
      "Search table rows for text matching a query across all text columns.",
      {
        tableId: z.string().describe("Table ID to search"),
        query: z.string().describe("Search text"),
        limit: z.number().min(1).max(100).optional().describe("Max results (default 20)"),
      },
      async (args) => {
        try {
          const table = await getTable(args.tableId);
          if (!table) return err("Table not found");
          const columns = JSON.parse(table.columnSchema) as ColumnDef[];
          const textCols = columns.filter((c) =>
            ["text", "email", "url"].includes(c.dataType)
          );

          if (textCols.length === 0) return ok([]);

          // Search using contains filter on first text column (basic approach)
          const rows = await listRows(args.tableId, {
            filters: [{ column: textCols[0].name, operator: "contains", value: args.query }],
            limit: args.limit ?? 20,
          });

          return ok(
            rows.map((r) => ({
              id: r.id,
              data: JSON.parse(r.data),
            }))
          );
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to search table");
        }
      }
    ),

    defineTool(
      "aggregate_table",
      "Compute aggregate values (sum, avg, count, min, max) on a numeric column, with optional filters.",
      {
        tableId: z.string().describe("Table ID"),
        column: z.string().describe("Column name to aggregate (must be numeric)"),
        operation: z.enum(["sum", "avg", "count", "min", "max"]).describe("Aggregation operation"),
        filters: z
          .array(
            z.object({
              column: z.string(),
              operator: z.enum([
                "eq", "neq", "gt", "gte", "lt", "lte",
                "contains", "starts_with", "in", "is_empty", "is_not_empty",
              ]),
              value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]).optional(),
            })
          )
          .optional(),
      },
      async (args) => {
        try {
          const rows = await listRows(args.tableId, {
            filters: args.filters,
            limit: 10000,
          });

          const values = rows
            .map((r) => {
              const data = JSON.parse(r.data) as Record<string, unknown>;
              return Number(data[args.column]);
            })
            .filter((v) => !isNaN(v));

          if (values.length === 0) return ok({ result: null, count: 0 });

          let result: number;
          switch (args.operation) {
            case "sum":
              result = values.reduce((a, b) => a + b, 0);
              break;
            case "avg":
              result = values.reduce((a, b) => a + b, 0) / values.length;
              break;
            case "count":
              result = values.length;
              break;
            case "min":
              result = Math.min(...values);
              break;
            case "max":
              result = Math.max(...values);
              break;
          }

          return ok({ result, count: values.length, operation: args.operation, column: args.column });
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to aggregate");
        }
      }
    ),

    // ── Write operations ─────────────────────────────────────────────

    defineTool(
      "add_rows",
      "Add one or more rows to a table. Each row is an object mapping column names to values.",
      {
        tableId: z.string().describe("Table ID"),
        rows: z
          .array(z.record(z.string(), z.unknown()))
          .min(1)
          .max(100)
          .describe("Array of row data objects"),
      },
      async (args) => {
        try {
          const ids = await addRows(
            args.tableId,
            args.rows.map((data) => ({ data, createdBy: "agent" }))
          );
          return ok({ added: ids.length, rowIds: ids });
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to add rows");
        }
      }
    ),

    defineTool(
      "update_row",
      "Update specific fields of a row. Only the provided fields are changed; others are preserved.",
      {
        rowId: z.string().describe("Row ID to update"),
        data: z.record(z.string(), z.unknown()).describe("Fields to update"),
      },
      async (args) => {
        try {
          const row = await updateRow(args.rowId, { data: args.data });
          if (!row) return err("Row not found");
          return ok({ id: row.id, data: JSON.parse(row.data) });
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to update row");
        }
      }
    ),

    defineTool(
      "delete_rows",
      "Delete one or more rows from a table by their IDs.",
      {
        rowIds: z.array(z.string()).min(1).describe("Row IDs to delete"),
      },
      async (args) => {
        try {
          await deleteRows(args.rowIds);
          return ok({ deleted: args.rowIds.length });
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to delete rows");
        }
      }
    ),

    // ── Creation operations ──────────────────────────────────────────

    defineTool(
      "create_table",
      "Create a new empty table with specified columns.",
      {
        name: z.string().min(1).max(256).describe("Table name"),
        description: z.string().max(1024).optional().describe("Table description"),
        projectId: z.string().optional().describe("Project ID. Omit for active project."),
        columns: z
          .array(
            z.object({
              name: z.string(),
              displayName: z.string(),
              dataType: z.enum([
                "text", "number", "date", "boolean", "select", "url", "email",
              ]),
              config: z.record(z.string(), z.unknown()).optional(),
            })
          )
          .min(1)
          .describe("Column definitions"),
      },
      async (args) => {
        try {
          const effectiveProjectId = args.projectId ?? ctx.projectId ?? undefined;
          const table = await createTable({
            name: args.name,
            description: args.description,
            projectId: effectiveProjectId,
            columns: args.columns.map((c, i) => ({
              ...c,
              position: i,
            })),
            source: "agent",
          });
          return ok({ id: table.id, name: table.name });
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to create table");
        }
      }
    ),

    defineTool(
      "import_document_as_table",
      "Import a document (CSV, XLSX, TSV) into an existing table. Automatically detects column types from the document content.",
      {
        tableId: z.string().describe("Table ID to import into"),
        documentId: z.string().describe("Document ID to import from"),
      },
      async (args) => {
        try {
          const { headers, rows } = await extractStructuredData(args.documentId);
          const sampleRows = rows.slice(0, 100);
          const inferredColumns = inferColumnTypes(headers, sampleRows);
          const result = await importRows(args.tableId, rows, inferredColumns);
          await createImportRecord(args.tableId, args.documentId, result);
          return ok({
            importId: result.importId,
            rowsImported: result.rowsImported,
            rowsSkipped: result.rowsSkipped,
          });
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to import document");
        }
      }
    ),

    defineTool(
      "list_table_templates",
      "List available table templates that can be used to quickly create pre-structured tables.",
      {
        category: z
          .enum(["business", "personal", "pm", "finance", "content"])
          .optional()
          .describe("Filter by template category"),
      },
      async (args) => {
        try {
          const templates = await listTemplates({ category: args.category });
          return ok(
            templates.map((t) => ({
              id: t.id,
              name: t.name,
              description: t.description,
              category: t.category,
            }))
          );
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to list templates");
        }
      }
    ),

    defineTool(
      "create_table_from_template",
      "Create a new table from a template, optionally including sample data.",
      {
        templateId: z.string().describe("Template ID to clone from"),
        name: z.string().min(1).max(256).describe("Name for the new table"),
        projectId: z.string().optional().describe("Project ID. Omit for active project."),
        includeSampleData: z.boolean().optional().describe("Whether to include sample rows"),
      },
      async (args) => {
        try {
          const effectiveProjectId = args.projectId ?? ctx.projectId ?? undefined;
          const table = await cloneFromTemplate({
            templateId: args.templateId,
            name: args.name,
            projectId: effectiveProjectId,
            includeSampleData: args.includeSampleData,
          });
          return ok({ id: table.id, name: table.name });
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to create from template");
        }
      }
    ),

    // ── NL-to-schema creation ──────────────────────────────────────────

    defineTool(
      "create_table_from_description",
      `Create a table by inferring column schema from a natural language description. You (the LLM) should infer appropriate column names, data types, and constraints from the description.

Guidelines for schema inference:
- Use "email" type for email-like fields, "url" for URLs, "date" for dates, "number" for numeric fields, "boolean" for yes/no
- Use "select" type with options for fields with a known set of values (e.g., status, priority, category)
- Use "text" as the default for free-form text fields
- Always include a primary descriptive column (e.g., "name", "title") as the first column
- Include 5-10 columns that make sense for the described use case`,
      {
        description: z.string().min(3).describe("Natural language description of the table to create, e.g. 'a table for tracking job applications'"),
        name: z.string().min(1).max(256).describe("Table name inferred from the description"),
        columns: z.array(z.object({
          name: z.string().describe("Machine-readable column name (snake_case)"),
          displayName: z.string().describe("Human-readable column name"),
          dataType: z.enum(["text", "number", "date", "boolean", "select", "url", "email"]).describe("Inferred data type"),
          config: z.object({ options: z.array(z.string()).optional() }).optional().describe("Config for select columns"),
        })).describe("Inferred column definitions"),
        projectId: z.string().optional().describe("Project ID. Omit for active project."),
      },
      async (args) => {
        try {
          const effectiveProjectId = args.projectId ?? ctx.projectId ?? undefined;
          const table = await createTable({
            name: args.name,
            projectId: effectiveProjectId,
            columns: args.columns.map((c, i) => ({
              name: c.name,
              displayName: c.displayName,
              dataType: c.dataType,
              position: i,
              config: c.config,
            })),
            source: "agent",
          });
          return ok({
            id: table.id,
            name: table.name,
            columns: args.columns.length,
            description: `Created from: "${args.description}"`,
          });
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to create table");
        }
      }
    ),

    // ── Export ──────────────────────────────────────────────────────────

    defineTool(
      "export_table",
      "Export a table's data as CSV, JSON, or XLSX. Returns the download URL.",
      {
        tableId: z.string().describe("Table ID to export"),
        format: z.enum(["csv", "json", "xlsx"]).describe("Export format"),
      },
      async (args) => {
        try {
          const table = await getTable(args.tableId);
          if (!table) return err("Table not found");
          const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
          return ok({
            url: `${baseUrl}/api/tables/${args.tableId}/export?format=${args.format}`,
            table: table.name,
            format: args.format,
          });
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to export");
        }
      }
    ),

    // ── Column CRUD ────────────────────────────────────────────────────

    defineTool(
      "add_column",
      "Add a new column to a table.",
      {
        tableId: z.string().describe("Table ID"),
        name: z.string().min(1).max(64).describe("Column name (snake_case)"),
        displayName: z.string().min(1).max(128).describe("Display name"),
        dataType: z.enum(["text", "number", "date", "boolean", "select", "url", "email", "relation", "computed"]).describe("Column data type"),
        required: z.boolean().optional().describe("Whether the column is required"),
        config: z.record(z.string(), z.unknown()).optional().describe("Type-specific config (options for select, formula for computed, targetTableId for relation)"),
      },
      async (args) => {
        try {
          const col = await addColumn(args.tableId, {
            name: args.name,
            displayName: args.displayName,
            dataType: args.dataType,
            required: args.required,
            config: args.config as ColumnDef["config"],
          });
          return ok({ id: col.id, name: col.name, displayName: col.displayName });
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to add column");
        }
      }
    ),

    defineTool(
      "update_column",
      "Update an existing column's display name, type, or configuration.",
      {
        columnId: z.string().describe("Column ID to update"),
        displayName: z.string().optional().describe("New display name"),
        dataType: z.enum(["text", "number", "date", "boolean", "select", "url", "email", "relation", "computed"]).optional().describe("New data type"),
        config: z.record(z.string(), z.unknown()).optional().describe("Updated config"),
      },
      async (args) => {
        try {
          const col = await updateColumn(args.columnId, {
            displayName: args.displayName,
            dataType: args.dataType,
            config: args.config as ColumnDef["config"],
          });
          if (!col) return err("Column not found");
          return ok({ id: col.id, name: col.name });
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to update column");
        }
      }
    ),

    defineTool(
      "delete_column",
      "Delete a column from a table. This removes the column definition but preserves row data.",
      {
        columnId: z.string().describe("Column ID to delete"),
      },
      async (args) => {
        try {
          await deleteColumn(args.columnId);
          return ok({ deleted: true });
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to delete column");
        }
      }
    ),

    defineTool(
      "reorder_columns",
      "Reorder columns in a table by providing column IDs in the desired order.",
      {
        tableId: z.string().describe("Table ID"),
        columnIds: z.array(z.string()).min(1).describe("Column IDs in desired order"),
      },
      async (args) => {
        try {
          await reorderColumns(args.tableId, args.columnIds);
          return ok({ reordered: true, count: args.columnIds.length });
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to reorder columns");
        }
      }
    ),
  ];
}
