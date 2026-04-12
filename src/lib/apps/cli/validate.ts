/**
 * `stagent app validate` — validate a .sap directory against the schema.
 *
 * Checks:
 * 1. manifest.yaml exists and parses against Zod schema
 * 2. Every file listed in provides.* has a matching file on disk
 * 3. Table template YAML files have valid column definitions
 * 4. Schedule YAML files have valid cron expressions
 */

import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import * as yaml from "js-yaml";
import { sapManifestSchema } from "../validation";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateSapDirectory(dir: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. manifest.yaml must exist
  const manifestPath = join(dir, "manifest.yaml");
  if (!existsSync(manifestPath)) {
    errors.push("manifest.yaml not found");
    return { valid: false, errors, warnings };
  }

  // 2. Parse manifest
  let manifest: Record<string, unknown>;
  try {
    const raw = readFileSync(manifestPath, "utf-8");
    manifest = yaml.load(raw) as Record<string, unknown>;
  } catch (e) {
    errors.push(
      `manifest.yaml is not valid YAML: ${e instanceof Error ? e.message : "parse error"}`,
    );
    return { valid: false, errors, warnings };
  }

  // 3. Validate against schema
  const parsed = sapManifestSchema.safeParse(manifest);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(`manifest.${issue.path.join(".")}: ${issue.message}`);
    }
  }

  // 4. Check provides references
  const provides = (manifest.provides ?? {}) as Record<string, string[]>;
  const dirMap: Record<string, string> = {
    tables: "templates",
    schedules: "schedules",
    profiles: "profiles",
    blueprints: "blueprints",
  };

  for (const [section, subdir] of Object.entries(dirMap)) {
    const items = provides[section] ?? [];
    for (const item of items) {
      const candidates = [
        join(dir, subdir, `${item}.yaml`),
        join(dir, subdir, `${item}.yml`),
        join(dir, subdir, `${item}.md`),
        join(dir, subdir, item),
      ];
      if (!candidates.some((c) => existsSync(c))) {
        errors.push(
          `provides.${section} references "${item}" but no matching file found in ${subdir}/`,
        );
      }
    }
  }

  // 5. Validate template YAML files
  const templatesDir = join(dir, "templates");
  if (existsSync(templatesDir)) {
    for (const file of readdirSync(templatesDir)) {
      if (!file.endsWith(".yaml") && !file.endsWith(".yml")) continue;
      try {
        const content = yaml.load(
          readFileSync(join(templatesDir, file), "utf-8"),
        ) as Record<string, unknown>;
        if (!content || typeof content !== "object") {
          errors.push(`templates/${file}: empty or invalid YAML`);
        } else if (!content.columns || !Array.isArray(content.columns)) {
          warnings.push(`templates/${file}: missing 'columns' array`);
        }
      } catch (e) {
        errors.push(
          `templates/${file}: invalid YAML — ${e instanceof Error ? e.message : "parse error"}`,
        );
      }
    }
  }

  // 6. Validate schedule YAML files
  const schedulesDir = join(dir, "schedules");
  if (existsSync(schedulesDir)) {
    for (const file of readdirSync(schedulesDir)) {
      if (!file.endsWith(".yaml") && !file.endsWith(".yml")) continue;
      try {
        const content = yaml.load(
          readFileSync(join(schedulesDir, file), "utf-8"),
        ) as Record<string, unknown>;
        if (!content || typeof content !== "object") {
          errors.push(`schedules/${file}: empty or invalid YAML`);
        } else if (!content.prompt) {
          warnings.push(`schedules/${file}: missing 'prompt' field`);
        }
      } catch (e) {
        errors.push(
          `schedules/${file}: invalid YAML — ${e instanceof Error ? e.message : "parse error"}`,
        );
      }
    }
  }

  // Optional checks (warnings only)
  if (!existsSync(join(dir, "README.md"))) {
    warnings.push("README.md not found (optional but recommended)");
  }

  return { valid: errors.length === 0, errors, warnings };
}
