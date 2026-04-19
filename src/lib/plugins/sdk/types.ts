import { z } from "zod";

// Shared capability tuple — single source of truth used by Zod schema and
// capability-check.ts hash derivation. Exported so consumers don't need a
// parallel list.
export const CAPABILITY_VALUES = ["fs", "net", "child_process", "env"] as const;
export type Capability = typeof CAPABILITY_VALUES[number];

const PrimitivesBundleManifestSchema = z
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

const ChatToolsPluginManifestSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]*$/, "id must be kebab-case starting with a letter"),
    version: z.string().regex(/^\d+\.\d+\.\d+$/, "version must be semver MAJOR.MINOR.PATCH"),
    apiVersion: z.string().regex(/^\d+\.\d+$/, "apiVersion must be MAJOR.MINOR"),
    kind: z.literal("chat-tools"),
    name: z.string().optional(),
    description: z.string().optional(),
    author: z.string().optional(),
    tags: z.array(z.string()).optional(),
    capabilities: z.array(z.enum(CAPABILITY_VALUES)).default([]),
    confinementMode: z.enum(["none", "seatbelt", "apparmor", "docker"]).optional(),
    dockerImage: z.string().optional(),
    defaultToolApproval: z.enum(["never", "prompt", "approve"]).optional(),
  })
  .strict();

export const PluginManifestSchema = z.discriminatedUnion("kind", [
  PrimitivesBundleManifestSchema,
  ChatToolsPluginManifestSchema,
]);

export type PluginManifest = z.infer<typeof PluginManifestSchema>;

export interface LoadedPlugin {
  id: string;
  manifest: PluginManifest;
  rootDir: string;
  profiles: string[];      // namespaced profile ids: "<plugin-id>/<profile-id>"
  blueprints: string[];    // namespaced blueprint ids
  tables: string[];        // namespaced table template ids: "plugin:<plugin-id>:<table-id>"
  schedules: string[];     // composite DB ids: "plugin:<plugin-id>:<schedule-id>"
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
