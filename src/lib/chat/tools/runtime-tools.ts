import { defineTool } from "../tool-registry";
import { ok, type ToolContext } from "./helpers";
import { listRuntimeCatalog } from "@/lib/agents/runtime/catalog";

export function runtimeTools(_ctx: ToolContext) {
  return [
    defineTool(
      "list_runtimes",
      "List all available AI runtimes with their models and capabilities. Use this to discover which runtimes can be assigned to workflows.",
      {},
      async () => {
        const catalog = listRuntimeCatalog();
        return ok(
          catalog.map((entry) => ({
            id: entry.id,
            label: entry.label,
            provider: entry.providerId,
            description: entry.description,
            models: entry.models,
            capabilities: Object.entries(entry.capabilities)
              .filter(([, v]) => v)
              .map(([k]) => k),
          }))
        );
      }
    ),
  ];
}
