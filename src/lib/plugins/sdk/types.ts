import { z } from "zod";

export const PluginManifestSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]*$/, "id must be kebab-case starting with a letter"),
    version: z.string().regex(/^\d+\.\d+\.\d+$/, "version must be semver MAJOR.MINOR.PATCH"),
    apiVersion: z.string().regex(/^\d+\.\d+$/, "apiVersion must be MAJOR.MINOR"),
    kind: z.literal("primitives-bundle"),
    name: z.string().optional(),
    description: z.string().optional(),
    author: z.string().optional(),
    tags: z.array(z.string()).optional(),
  })
  .strict();

export type PluginManifest = z.infer<typeof PluginManifestSchema>;

export interface LoadedPlugin {
  id: string;
  manifest: PluginManifest;
  rootDir: string;
  profiles: string[];      // namespaced profile ids: "<plugin-id>/<profile-id>"
  blueprints: string[];    // namespaced blueprint ids
  tables: string[];        // namespaced table template ids: "plugin:<plugin-id>:<table-id>"
  status: "loaded" | "disabled";
  error?: string;
}

export interface PluginTableTemplate {
  id: string;              // local id within the bundle, e.g. "transactions"
  name: string;
  description: string;
  category: "business" | "personal" | "pm" | "finance" | "content";
  icon: string;
  columns: Array<{
    name: string;
    displayName: string;
    dataType: string;
    config?: Record<string, unknown>;
  }>;
  sampleRows?: Record<string, unknown>[];
}
