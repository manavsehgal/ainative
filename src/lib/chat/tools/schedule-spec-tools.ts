/**
 * Chat tools for managing schedule specs loaded from
 * `~/.ainative/schedules/` and the built-in schedules directory.
 *
 * TDR-032 / CLAUDE.md NON-NEGOTIABLE: every handler MUST import
 * `@/lib/schedules/registry` via dynamic `await import()` inside the
 * function body. A static import here would be transitively reachable
 * from `src/lib/agents/runtime/catalog.ts` (via the chat tool aggregator)
 * and would risk the module-load cycle that surfaces at runtime as
 * `ReferenceError: Cannot access 'claudeRuntimeAdapter' before initialization`.
 * Unit tests cannot catch this — only the T18 smoke test will.
 */

import { defineTool } from "../tool-registry";
import { z } from "zod";
import { ok, err, type ToolContext } from "./helpers";

export function scheduleSpecTools(_ctx: ToolContext) {
  return [
    defineTool(
      "list_schedule_specs",
      "List all loaded schedule specs (builtins + user YAML + plugin-injected). Each entry includes id, name, type (scheduled/heartbeat), and interval or cronExpression.",
      {},
      async () => {
        try {
          // Dynamic import — see TDR-032 note at top of file.
          const { listSchedules } = await import("@/lib/schedules/registry");
          return ok(listSchedules());
        } catch (e) {
          return err(
            e instanceof Error ? e.message : "Failed to list schedule specs"
          );
        }
      }
    ),

    defineTool(
      "install_schedule_from_yaml",
      "Install a new user-authored schedule from YAML content. Writes to ~/.ainative/schedules/<id>.yaml and reloads the cache. Fails if id collides with an existing user schedule.",
      {
        yaml: z
          .string()
          .describe(
            "YAML content for a schedule spec (see schedule-spec.ts schema). Must include type, id, name, version, prompt, and exactly one of interval or cronExpression."
          ),
      },
      async (args) => {
        try {
          // Dynamic import — see TDR-032 note at top of file.
          const { createScheduleFromYaml } = await import(
            "@/lib/schedules/registry"
          );
          const spec = createScheduleFromYaml(args.yaml);
          return ok(spec);
        } catch (e) {
          return err(
            e instanceof Error
              ? e.message
              : "Failed to install schedule from YAML"
          );
        }
      }
    ),

    defineTool(
      "reload_schedules",
      "Rescan builtins + user YAML dir and rebuild the in-memory schedule cache. Returns the count of loaded specs.",
      {},
      async () => {
        try {
          // Dynamic import — see TDR-032 note at top of file.
          const { reloadSchedules, listSchedules } = await import(
            "@/lib/schedules/registry"
          );
          reloadSchedules();
          const specs = listSchedules();
          return ok({ loaded: specs.length });
        } catch (e) {
          return err(
            e instanceof Error ? e.message : "Failed to reload schedules"
          );
        }
      }
    ),
  ];
}
