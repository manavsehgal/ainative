/**
 * Environment template management.
 * Capture, list, apply, and delete reusable environment configurations.
 */

import { db } from "@/lib/db";
import {
  environmentTemplates,
  type EnvironmentTemplateRow,
} from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { getArtifacts } from "./data";
import { safeReadFile } from "./parsers/utils";

export interface TemplateManifest {
  skills: Array<{ name: string; content: string; tool: string }>;
  mcpServers: Array<{ name: string; config: Record<string, unknown>; tool: string }>;
  permissions: Array<{ name: string; rules: unknown; tool: string }>;
  instructions: Array<{ name: string; content: string; tool: string }>;
  hooks: Array<{ name: string; content: string }>;
  memory: Array<{ name: string; content: string }>;
}

/** Capture the current scan as a reusable template. */
export function captureTemplate(
  scanId: string,
  name: string,
  description?: string
): EnvironmentTemplateRow {
  const artifacts = getArtifacts({ scanId });

  const manifest: TemplateManifest = {
    skills: [],
    mcpServers: [],
    permissions: [],
    instructions: [],
    hooks: [],
    memory: [],
  };

  for (const artifact of artifacts) {
    const content = safeReadFile(artifact.absPath) || artifact.preview || "";
    const metadata = artifact.metadata ? JSON.parse(artifact.metadata) : {};

    switch (artifact.category) {
      case "skill":
        manifest.skills.push({ name: artifact.name, content, tool: artifact.tool });
        break;
      case "mcp-server":
        manifest.mcpServers.push({ name: artifact.name, config: metadata, tool: artifact.tool });
        break;
      case "permission":
        manifest.permissions.push({ name: artifact.name, rules: metadata.rules, tool: artifact.tool });
        break;
      case "instruction":
        manifest.instructions.push({ name: artifact.name, content, tool: artifact.tool });
        break;
      case "hook":
        manifest.hooks.push({ name: artifact.name, content });
        break;
      case "memory":
        manifest.memory.push({ name: artifact.name, content });
        break;
    }
  }

  const id = crypto.randomUUID();
  const now = new Date();

  db.insert(environmentTemplates)
    .values({
      id,
      name,
      description: description || null,
      manifest: JSON.stringify(manifest),
      scope: "user",
      artifactCount: artifacts.length,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return db
    .select()
    .from(environmentTemplates)
    .where(eq(environmentTemplates.id, id))
    .get()!;
}

/** List all templates. */
export function listTemplates(): EnvironmentTemplateRow[] {
  return db
    .select()
    .from(environmentTemplates)
    .orderBy(desc(environmentTemplates.createdAt))
    .all();
}

/** Get a single template by ID. */
export function getTemplate(id: string): EnvironmentTemplateRow | undefined {
  return db
    .select()
    .from(environmentTemplates)
    .where(eq(environmentTemplates.id, id))
    .get();
}

/** Delete a template. */
export function deleteTemplate(id: string): boolean {
  const result = db
    .delete(environmentTemplates)
    .where(eq(environmentTemplates.id, id))
    .run();
  return result.changes > 0;
}

/** Parse the manifest JSON from a template row. */
export function parseManifest(template: EnvironmentTemplateRow): TemplateManifest {
  return JSON.parse(template.manifest) as TemplateManifest;
}
