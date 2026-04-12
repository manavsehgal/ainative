import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import yaml from "js-yaml";
import { satisfies } from "semver";
import {
  sapManifestSchema,
  tableTemplateSchema,
  scheduleTemplateSchema,
} from "./validation";
import type {
  AppBundle,
  AppBundleManifest,
  AppProfileLink,
  AppBlueprintLink,
  AppTableTemplate,
  AppScheduleTemplate,
  AppUiSchema,
  SapManifest,
} from "./types";

// ── Namespace helpers ──

export function applyNamespace(appId: string, key: string): string {
  return key.startsWith(`${appId}--`) ? key : `${appId}--${key}`;
}

export function stripNamespace(appId: string, prefixedKey: string): string {
  const prefix = `${appId}--`;
  return prefixedKey.startsWith(prefix) ? prefixedKey.slice(prefix.length) : prefixedKey;
}

// ── Platform compatibility ──

export function getPlatformVersion(): string {
  // Walk up from module location to find package.json (safe for npx)
  let dir = import.meta.dirname;
  for (let i = 0; i < 10; i++) {
    const pkgPath = join(dir, "package.json");
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      return pkg.version ?? "0.0.0";
    }
    const parent = join(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return "0.0.0";
}

export function checkPlatformCompat(manifest: SapManifest): {
  compatible: boolean;
  reason?: string;
} {
  const platformVersion = getPlatformVersion();
  const min = manifest.platform.minVersion;
  const max = manifest.platform.maxVersion;

  const range = max ? `>=${min} <=${max}` : `>=${min}`;
  if (!satisfies(platformVersion, range)) {
    return {
      compatible: false,
      reason: `Platform ${platformVersion} outside range ${range}`,
    };
  }
  return { compatible: true };
}

// ── File reference validation ──

export function validateFileReferences(
  dir: string,
  manifest: SapManifest
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  for (const table of manifest.provides.tables) {
    const path = join(dir, "templates", `${table}.yaml`);
    if (!existsSync(path)) missing.push(`templates/${table}.yaml`);
  }
  for (const schedule of manifest.provides.schedules) {
    const path = join(dir, "schedules", `${schedule}.yaml`);
    if (!existsSync(path)) missing.push(`schedules/${schedule}.yaml`);
  }
  for (const profile of manifest.provides.profiles) {
    const path = join(dir, "profiles", `${profile}.md`);
    if (!existsSync(path)) missing.push(`profiles/${profile}.md`);
  }
  for (const blueprint of manifest.provides.blueprints) {
    const path = join(dir, "blueprints", `${blueprint}.yaml`);
    if (!existsSync(path)) missing.push(`blueprints/${blueprint}.yaml`);
  }

  return { valid: missing.length === 0, missing };
}

// ── SAP → Bundle conversion ──

export function sapToBundleSync(dir: string): AppBundle {
  const manifestPath = join(dir, "manifest.yaml");
  if (!existsSync(manifestPath)) {
    throw new Error(`Missing manifest.yaml in ${dir}`);
  }

  const raw = readFileSync(manifestPath, "utf-8");
  const parsed = yaml.load(raw);
  const result = sapManifestSchema.safeParse(parsed);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid manifest.yaml:\n${issues}`);
  }

  const manifest = result.data;
  const appId = manifest.id;

  // Validate file references
  const refs = validateFileReferences(dir, manifest as SapManifest);
  if (!refs.valid) {
    throw new Error(
      `Missing files referenced in provides:\n  ${refs.missing.join("\n  ")}`
    );
  }

  // Load tables
  const tables: AppTableTemplate[] = manifest.provides.tables.map((key) => {
    const tableYaml = readFileSync(join(dir, "templates", `${key}.yaml`), "utf-8");
    const tableParsed = yaml.load(tableYaml);
    const tableResult = tableTemplateSchema.safeParse(tableParsed);
    if (!tableResult.success) {
      throw new Error(
        `Invalid table template ${key}.yaml: ${tableResult.error.issues.map((i) => i.message).join(", ")}`
      );
    }
    return {
      ...tableResult.data,
      key: applyNamespace(appId, tableResult.data.key),
    };
  });

  // Load schedules
  const schedules: AppScheduleTemplate[] = manifest.provides.schedules.map((key) => {
    const schedYaml = readFileSync(join(dir, "schedules", `${key}.yaml`), "utf-8");
    const schedParsed = yaml.load(schedYaml);
    const schedResult = scheduleTemplateSchema.safeParse(schedParsed);
    if (!schedResult.success) {
      throw new Error(
        `Invalid schedule ${key}.yaml: ${schedResult.error.issues.map((i) => i.message).join(", ")}`
      );
    }
    return {
      ...schedResult.data,
      key: applyNamespace(appId, schedResult.data.key),
    };
  });

  // Load profile links (metadata from files, not full profile content)
  const profiles: AppProfileLink[] = manifest.provides.profiles.map((id) => {
    const filePath = join(dir, "profiles", `${id}.md`);
    const content = readFileSync(filePath, "utf-8");
    const labelMatch = content.match(/^#\s+(.+)$/m);
    return {
      id: applyNamespace(appId, id),
      label: labelMatch?.[1]?.trim() ?? id.replace(/-/g, " "),
    };
  });

  // Load blueprint links (metadata from files)
  const blueprints: AppBlueprintLink[] = manifest.provides.blueprints.map((id) => {
    const filePath = join(dir, "blueprints", `${id}.yaml`);
    const content = readFileSync(filePath, "utf-8");
    const bpParsed = yaml.load(content) as Record<string, unknown> | null;
    return {
      id: applyNamespace(appId, id),
      label: (bpParsed?.name as string) ?? id.replace(/-/g, " "),
      description: (bpParsed?.description as string) ?? undefined,
    };
  });

  // Build runtime manifest
  const bundleManifest: AppBundleManifest = {
    id: appId,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    category: manifest.marketplace.category,
    tags: manifest.marketplace.tags,
    difficulty: manifest.marketplace.difficulty,
    estimatedSetupMinutes: 5,
    icon: manifest.sidebar.icon,
    trustLevel: "community",
    permissions: derivePermissions(manifest),
    sidebarLabel: manifest.sidebar.label,
  };

  const ui: AppUiSchema = manifest.ui ?? { pages: [] };

  return {
    manifest: bundleManifest,
    setupChecklist: deriveSetupChecklist(manifest),
    profiles,
    blueprints,
    tables,
    schedules,
    ui,
  };
}

export async function sapToBundle(dir: string): Promise<AppBundle> {
  return sapToBundleSync(dir);
}

// ── Bundle → SAP conversion ──

export async function bundleToSap(bundle: AppBundle, outDir: string): Promise<void> {
  const appId = bundle.manifest.id;

  mkdirSync(outDir, { recursive: true });

  // Build SAP manifest
  const sapManifest: SapManifest = {
    id: appId,
    name: bundle.manifest.name,
    version: bundle.manifest.version,
    description: bundle.manifest.description,
    author: { name: "Stagent Team" },
    license: "MIT",
    platform: { minVersion: getPlatformVersion() },
    marketplace: {
      category: (bundle.manifest.category as SapManifest["marketplace"]["category"]) ?? "general",
      tags: bundle.manifest.tags,
      difficulty: bundle.manifest.difficulty,
      pricing: "free",
    },
    sidebar: {
      label: bundle.manifest.sidebarLabel ?? bundle.manifest.name,
      icon: bundle.manifest.icon,
      route: `/app/${appId}`,
    },
    provides: {
      profiles: bundle.profiles.map((p) => stripNamespace(appId, p.id)),
      blueprints: bundle.blueprints.map((b) => stripNamespace(appId, b.id)),
      tables: bundle.tables.map((t) => stripNamespace(appId, t.key)),
      schedules: bundle.schedules.map((s) => stripNamespace(appId, s.key)),
      triggers: (bundle.triggers ?? []).map((t) => stripNamespace(appId, t.key)),
      pages: bundle.ui.pages.map((p) => p.key),
    },
    ui: bundle.ui,
  };

  // Attach tier1 primitives as extra YAML keys (outside SapManifest type, but valid YAML)
  const manifestWithTier1: Record<string, unknown> = { ...sapManifest };
  if (bundle.triggers?.length) manifestWithTier1.triggers = bundle.triggers.map((t) => ({ ...t, key: stripNamespace(appId, t.key), tableKey: stripNamespace(appId, t.tableKey) }));
  if (bundle.documents?.length) manifestWithTier1.documents = bundle.documents.map((d) => ({ ...d, key: stripNamespace(appId, d.key) }));
  if (bundle.notifications?.length) manifestWithTier1.notifications = bundle.notifications;
  if (bundle.savedViews?.length) manifestWithTier1.savedViews = bundle.savedViews.map((v) => ({ ...v, key: stripNamespace(appId, v.key), tableKey: stripNamespace(appId, v.tableKey) }));
  if (bundle.envVars?.length) manifestWithTier1.envVars = bundle.envVars;

  // Write manifest.yaml (includes tier1 primitive data when present)
  writeFileSync(join(outDir, "manifest.yaml"), yaml.dump(manifestWithTier1, { lineWidth: 120 }));

  // Write table templates
  if (bundle.tables.length > 0) {
    const templatesDir = join(outDir, "templates");
    mkdirSync(templatesDir, { recursive: true });
    for (const table of bundle.tables) {
      const key = stripNamespace(appId, table.key);
      const tableData = { ...table, key };
      writeFileSync(join(templatesDir, `${key}.yaml`), yaml.dump(tableData, { lineWidth: 120 }));
    }
  }

  // Write schedule templates
  if (bundle.schedules.length > 0) {
    const schedulesDir = join(outDir, "schedules");
    mkdirSync(schedulesDir, { recursive: true });
    for (const schedule of bundle.schedules) {
      const key = stripNamespace(appId, schedule.key);
      const schedData = { ...schedule, key };
      writeFileSync(join(schedulesDir, `${key}.yaml`), yaml.dump(schedData, { lineWidth: 120 }));
    }
  }

  // Write profile stubs
  if (bundle.profiles.length > 0) {
    const profilesDir = join(outDir, "profiles");
    mkdirSync(profilesDir, { recursive: true });
    for (const profile of bundle.profiles) {
      const id = stripNamespace(appId, profile.id);
      const content = `# ${profile.label}\n\n${profile.description ?? ""}\n`;
      writeFileSync(join(profilesDir, `${id}.md`), content);
    }
  }

  // Write blueprint stubs
  if (bundle.blueprints.length > 0) {
    const blueprintsDir = join(outDir, "blueprints");
    mkdirSync(blueprintsDir, { recursive: true });
    for (const blueprint of bundle.blueprints) {
      const id = stripNamespace(appId, blueprint.id);
      const bpData = {
        name: blueprint.label,
        description: blueprint.description ?? "",
      };
      writeFileSync(join(blueprintsDir, `${id}.yaml`), yaml.dump(bpData));
    }
  }

  // Write README
  writeFileSync(
    join(outDir, "README.md"),
    `# ${bundle.manifest.name}\n\n${bundle.manifest.description}\n`
  );
}

// ── Helpers ──

import type { AppPermission } from "./types";

function derivePermissions(manifest: SapManifest): AppPermission[] {
  const perms: AppPermission[] = ["projects:create"];
  if (manifest.provides.tables.length > 0) {
    perms.push("tables:create", "tables:seed");
  }
  if (manifest.provides.schedules.length > 0) perms.push("schedules:create");
  if (manifest.provides.profiles.length > 0) perms.push("profiles:link");
  if (manifest.provides.blueprints.length > 0) perms.push("blueprints:link");
  return perms;
}

function deriveSetupChecklist(manifest: SapManifest): string[] {
  const items: string[] = [`Install ${manifest.name}`];
  if (manifest.provides.tables.length > 0) items.push("Review sample data in tables");
  if (manifest.provides.schedules.length > 0) items.push("Configure and activate schedules");
  if (manifest.provides.profiles.length > 0) items.push("Review linked agent profiles");
  return items;
}
