import { defineTool } from "../tool-registry";
import { z } from "zod";
import { ok, err, type ToolContext } from "./helpers";

/* ── Writable settings allowlist ─────────────────────────────────── */

interface WritableSetting {
  validate: (value: string) => string | null; // error message or null
  description: string;
}

const WRITABLE_SETTINGS: Record<string, WritableSetting> = {
  "runtime.sdkTimeoutSeconds": {
    description: "SDK timeout in seconds (10–300)",
    validate: (v) => {
      const n = parseInt(v, 10);
      return isNaN(n) || n < 10 || n > 300 ? "Must be integer 10–300" : null;
    },
  },
  "runtime.maxTurns": {
    description: "Max agent turns per task (1–50)",
    validate: (v) => {
      const n = parseInt(v, 10);
      return isNaN(n) || n < 1 || n > 50 ? "Must be integer 1–50" : null;
    },
  },
  "routing.preference": {
    description: "Routing preference: cost | latency | quality | manual",
    validate: (v) =>
      ["cost", "latency", "quality", "manual"].includes(v)
        ? null
        : "Must be one of: cost, latency, quality, manual",
  },
  "browser.chromeDevtoolsEnabled": {
    description: "Enable Chrome DevTools MCP: true | false",
    validate: (v) =>
      ["true", "false"].includes(v) ? null : "Must be 'true' or 'false'",
  },
  "browser.playwrightEnabled": {
    description: "Enable Playwright MCP: true | false",
    validate: (v) =>
      ["true", "false"].includes(v) ? null : "Must be 'true' or 'false'",
  },
  "web.exaSearchEnabled": {
    description: "Enable Exa web search: true | false",
    validate: (v) =>
      ["true", "false"].includes(v) ? null : "Must be 'true' or 'false'",
  },
  "learning.contextCharLimit": {
    description: "Learning context char limit (2000–32000, step 1000)",
    validate: (v) => {
      const n = parseInt(v, 10);
      return isNaN(n) || n < 2000 || n > 32000 || n % 1000 !== 0
        ? "Must be integer 2000–32000, step 1000"
        : null;
    },
  },
  "ollama.baseUrl": {
    description: "Ollama server base URL",
    validate: (v) => (v.trim().length === 0 ? "Must be non-empty URL" : null),
  },
  "ollama.defaultModel": {
    description: "Default Ollama model name",
    validate: (v) =>
      v.trim().length === 0 ? "Must be non-empty string" : null,
  },
};

const WRITABLE_KEYS_DOC = Object.entries(WRITABLE_SETTINGS)
  .map(([k, v]) => `- "${k}": ${v.description}`)
  .join("\n");

/* ── Tool definitions ────────────────────────────────────────────── */

export function settingsTools(_ctx: ToolContext) {
  return [
    defineTool(
      "get_settings",
      "Get current Stagent settings including auth method, budget limits, active runtime, and workspace context. Read-only.",
      {
        key: z
          .string()
          .optional()
          .describe(
            'Specific setting key (e.g. "auth_method", "budget_max_tokens", "default_runtime", "workspace_cwd", "workspace_is_worktree"). Omit to get all settings.'
          ),
      },
      async (args) => {
        try {
          const { getSetting } = await import("@/lib/settings/helpers");
          const { getWorkspaceContext } = await import(
            "@/lib/environment/workspace-context"
          );

          // Handle workspace_* keys from workspace context
          if (args.key?.startsWith("workspace_")) {
            const ws = getWorkspaceContext();
            const wsEntries: Record<string, string | null> = {
              workspace_cwd: ws.cwd,
              workspace_git_branch: ws.gitBranch,
              workspace_is_worktree: ws.isWorktree ? "true" : "false",
              workspace_folder_name: ws.folderName,
            };
            return ok({
              key: args.key,
              value: wsEntries[args.key] ?? null,
            });
          }

          if (args.key) {
            const value = await getSetting(args.key);
            return ok({ key: args.key, value });
          }

          // Return common settings + workspace context
          const keys = [
            "auth_method",
            "default_runtime",
            "runtime.sdkTimeoutSeconds",
            "budget_max_tokens_per_task",
            "budget_max_cost_per_task",
            "budget_max_daily_cost",
          ];
          const entries: Record<string, string | null> = {};
          for (const key of keys) {
            entries[key] = await getSetting(key);
          }

          // Append workspace context
          const ws = getWorkspaceContext();
          entries.workspace_cwd = ws.cwd;
          entries.workspace_git_branch = ws.gitBranch;
          entries.workspace_is_worktree = ws.isWorktree ? "true" : "false";
          entries.workspace_folder_name = ws.folderName;

          return ok(entries);
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to get settings");
        }
      }
    ),

    defineTool(
      "set_settings",
      `Update a Stagent setting. Requires user approval.\n\nWritable keys:\n${WRITABLE_KEYS_DOC}`,
      {
        key: z.string().describe("Setting key to update"),
        value: z.string().describe("New value (always a string)"),
      },
      async (args) => {
        const spec = WRITABLE_SETTINGS[args.key];
        if (!spec) {
          return err(
            `Key "${args.key}" is not writable. Valid keys: ${Object.keys(WRITABLE_SETTINGS).join(", ")}`
          );
        }
        const validationError = spec.validate(args.value);
        if (validationError) {
          return err(
            `Invalid value for "${args.key}": ${validationError}`
          );
        }
        try {
          const { getSetting, setSetting } = await import(
            "@/lib/settings/helpers"
          );
          const oldValue = await getSetting(args.key);
          await setSetting(args.key, args.value);
          return ok({
            key: args.key,
            oldValue: oldValue ?? "(unset)",
            newValue: args.value,
          });
        } catch (e) {
          return err(
            e instanceof Error ? e.message : "Failed to update setting"
          );
        }
      }
    ),
  ];
}
