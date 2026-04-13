/**
 * Chat tools for the app builder.
 *
 * Three tools:
 * - introspect_project: Read existing project structure
 * - create_app_bundle: Create and install a new app from conversation
 * - list_app_templates: Show available builtin apps as starting points
 */

import { defineTool } from "../tool-registry";
import { z } from "zod";
import { ok, err, type ToolContext } from "./helpers";

export function appTools(ctx: ToolContext) {
  return [
    // ── Read operations ──────────────────────────────────────────────

    defineTool(
      "introspect_project",
      "Examine an existing project's tables, schedules, profiles, and documents. " +
        "Returns a structured fingerprint showing table names with column schemas, " +
        "row counts, active schedules, and attached documents. Use this to understand " +
        "what the user already has before proposing new data models.",
      {
        projectId: z
          .string()
          .describe(
            "The project ID to introspect. Omit to use the active project.",
          ),
      },
      async (args) => {
        try {
          const { introspectProject } = await import(
            "@/lib/apps/introspector"
          );
          const effectiveProjectId =
            args.projectId ?? ctx.projectId ?? undefined;
          if (!effectiveProjectId) {
            return err(
              "No project specified. Provide a projectId or set an active project.",
            );
          }
          const fingerprint = await introspectProject(effectiveProjectId);
          return ok(fingerprint);
        } catch (e) {
          return err(e instanceof Error ? e.message : "Introspection failed");
        }
      },
    ),

    defineTool(
      "list_app_templates",
      "List available built-in app bundles that can serve as templates or " +
        "inspiration for creating new apps. Returns manifest summaries including " +
        "name, description, category, table count, schedule count, and difficulty.",
      {},
      async () => {
        try {
          const { listAppCatalog } = await import("@/lib/apps/service");
          const catalog = listAppCatalog();
          return ok(
            catalog.map((entry) => ({
              appId: entry.appId,
              name: entry.name,
              description: entry.description,
              category: entry.category,
              tags: entry.tags,
              difficulty: entry.difficulty,
              tableCount: entry.tableCount,
              scheduleCount: entry.scheduleCount,
              profileCount: entry.profileCount,
              installed: entry.installed,
            })),
          );
        } catch (e) {
          return err(
            e instanceof Error ? e.message : "Failed to list templates",
          );
        }
      },
    ),

    // ── Write operation (requires approval) ─────────────────────────

    defineTool(
      "create_app_bundle",
      "Create and install a new Stagent app from a structured specification. " +
        "This tool validates all inputs, synthesizes an AppBundle, installs it " +
        "(creating project, tables, schedules), and saves the .sap directory. " +
        "IMPORTANT: This tool creates real database resources. Always present " +
        "a structured summary to the user and get their confirmation before calling.",
      {
        name: z
          .string()
          .min(1)
          .max(120)
          .describe("Display name for the app (e.g. 'Real Estate Tracker')"),
        description: z
          .string()
          .min(1)
          .max(500)
          .describe("What the app does, for the marketplace listing"),
        category: z
          .string()
          .describe(
            "App category: finance, sales, content, dev, automation, or general",
          ),
        tags: z
          .array(z.string())
          .max(8)
          .optional()
          .describe("Searchable tags (e.g. ['portfolio', 'investing'])"),
        difficulty: z
          .enum(["beginner", "intermediate", "advanced"])
          .optional()
          .describe("User skill level needed (default: beginner)"),
        estimatedSetupMinutes: z
          .number()
          .int()
          .min(1)
          .max(60)
          .optional()
          .describe("Estimated setup time in minutes (default: 5)"),
        icon: z
          .string()
          .optional()
          .describe(
            "Lucide icon name (e.g. 'TrendingUp', 'Briefcase'). Default: 'Rocket'",
          ),
        tables: z
          .array(
            z.object({
              name: z.string().describe("Table display name"),
              description: z.string().optional(),
              columns: z
                .array(
                  z.object({
                    name: z.string().describe("Column key (snake_case)"),
                    displayName: z.string().describe("Column display name"),
                    dataType: z
                      .string()
                      .describe(
                        "Data type: text, number, boolean, date, url, email, select, multi_select, formula, relation",
                      ),
                    required: z.boolean().optional(),
                  }),
                )
                .min(1),
            }),
          )
          .optional()
          .describe("Tables to create"),
        schedules: z
          .array(
            z.object({
              name: z.string().describe("Schedule display name"),
              description: z.string().optional(),
              prompt: z
                .string()
                .describe(
                  "The prompt the agent will execute on each firing",
                ),
              cronExpression: z
                .string()
                .describe(
                  "Cron expression (e.g. '0 9 * * *' for daily at 9am)",
                ),
              agentProfile: z.string().optional(),
            }),
          )
          .optional()
          .describe("Automated schedules to create"),
        profiles: z
          .array(
            z.object({
              id: z.string().describe("Profile identifier (kebab-case)"),
              label: z.string().describe("Display name"),
              description: z.string().optional(),
            }),
          )
          .optional()
          .describe("Agent profile links"),
        pages: z
          .array(
            z.object({
              title: z.string().describe("Page title"),
              description: z.string().optional(),
              path: z
                .string()
                .optional()
                .describe(
                  "URL path segment (omit for root page). E.g. 'analytics'",
                ),
              icon: z.string().optional().describe("Lucide icon name"),
            }),
          )
          .optional()
          .describe(
            "UI pages. Omit to auto-generate an overview page with default widgets.",
          ),
      },
      async (args) => {
        try {
          const { synthesizeBundle } = await import("@/lib/apps/synthesizer");
          const { installApp, saveSapDirectory } = await import(
            "@/lib/apps/service"
          );
          const { registerBundle } = await import("@/lib/apps/registry");

          // Synthesize (validates against appBundleSchema internally)
          const bundle = synthesizeBundle({
            manifest: {
              name: args.name,
              description: args.description,
              category: args.category,
              tags: args.tags,
              difficulty: args.difficulty,
              estimatedSetupMinutes: args.estimatedSetupMinutes,
              icon: args.icon,
            },
            tables: args.tables,
            schedules: args.schedules,
            profiles: args.profiles,
            pages: args.pages,
          });

          // Register in memory first so bundle is discoverable immediately
          registerBundle(bundle, "sap");

          // Persist to disk BEFORE install — if install fails, SAP files
          // allow recovery via JIT loading on next getAppBundle() call
          try {
            await saveSapDirectory(bundle.manifest.id, bundle);
          } catch (sapErr) {
            console.error(
              `[apps] SAP directory write failed for ${bundle.manifest.id}:`,
              sapErr instanceof Error ? sapErr.stack : sapErr,
            );
          }

          // Install (creates project, tables, schedules — may fail during bootstrap)
          const instance = await installApp(bundle.manifest.id, undefined, bundle, "file");

          ctx.onToolResult?.("create_app_bundle", {
            appId: instance.appId,
            projectId: instance.projectId,
            name: instance.name,
          });

          return ok({
            appId: instance.appId,
            name: instance.name,
            projectId: instance.projectId,
            status: instance.status,
            openHref: `/apps/${instance.appId}`,
            tableCount: bundle.tables.length,
            scheduleCount: bundle.schedules.length,
            message: `App "${instance.name}" installed successfully. Open it at /apps/${instance.appId}`,
          });
        } catch (e) {
          return err(
            e instanceof Error ? e.message : "Failed to create app bundle",
          );
        }
      },
    ),

    // ── Export operation (requires approval) ───────────────────────

    defineTool(
      "export_app_bundle",
      "Export an existing project's tables, schedules, and profiles as a reusable " +
        "AppBundle with sanitized seed data. Real data is automatically stripped of " +
        "PII using rule-based strategies (faker names, shifted dates, redacted emails). " +
        "The exported bundle is saved as a .sap directory. " +
        "IMPORTANT: This tool reads real data to generate seed rows. Always present " +
        "a summary to the user before calling.",
      {
        projectId: z
          .string()
          .describe(
            "The project ID to export. Omit to use the active project.",
          ),
        appName: z
          .string()
          .min(1)
          .max(120)
          .describe("Display name for the exported app"),
        appDescription: z
          .string()
          .min(1)
          .max(500)
          .describe("Description of what the exported app does"),
        category: z
          .string()
          .optional()
          .describe("App category (default: general)"),
        includeTables: z
          .array(z.string())
          .optional()
          .describe(
            "Table IDs or names to include. Omit to include all tables.",
          ),
        includeSchedules: z
          .array(z.string())
          .optional()
          .describe(
            "Schedule IDs or names to include. Omit to include all schedules.",
          ),
        seedDataRows: z
          .number()
          .int()
          .min(0)
          .max(100)
          .optional()
          .describe(
            "Number of sanitized seed rows per table (default: 25, 0 for none)",
          ),
      },
      async (args) => {
        try {
          const { exportProjectToBundle } = await import(
            "@/lib/apps/exporter"
          );
          const { saveSapDirectory, registerExportedApp } = await import("@/lib/apps/service");

          const effectiveProjectId =
            args.projectId ?? ctx.projectId ?? undefined;
          if (!effectiveProjectId) {
            return err(
              "No project specified. Provide a projectId or set an active project.",
            );
          }

          const result = await exportProjectToBundle(effectiveProjectId, {
            appName: args.appName,
            appDescription: args.appDescription,
            category: args.category,
            includeTables: args.includeTables,
            includeSchedules: args.includeSchedules,
            seedDataRows: args.seedDataRows,
          });

          // Persist as .sap directory
          let sapPath: string | null = null;
          try {
            sapPath = await saveSapDirectory(
              result.bundle.manifest.id,
              result.bundle,
            );
          } catch (sapErr) {
            console.warn(
              `[apps] SAP write failed for ${result.bundle.manifest.id}:`,
              sapErr,
            );
          }

          // Register in DB linked to source project (no new project created)
          try {
            await registerExportedApp(
              result.bundle,
              effectiveProjectId,
            );
          } catch (regErr) {
            console.warn(
              `[apps] DB registration failed for ${result.bundle.manifest.id}:`,
              regErr,
            );
          }

          ctx.onToolResult?.("export_app_bundle", {
            appId: result.bundle.manifest.id,
            name: result.bundle.manifest.name,
          });

          return ok({
            appId: result.bundle.manifest.id,
            name: result.bundle.manifest.name,
            savedTo: sapPath ?? `~/.stagent/apps/${result.bundle.manifest.id}/`,
            stats: result.stats,
            message: `Exported "${result.bundle.manifest.name}" with ${result.stats.tablesExported} tables and ${result.stats.totalSeedRows} sanitized seed rows.${result.stats.piiClean ? "" : " Warning: PII scan found potential issues in seed data."}`,
          });
        } catch (e) {
          return err(
            e instanceof Error ? e.message : "Failed to export app bundle",
          );
        }
      },
    ),
  ];
}
