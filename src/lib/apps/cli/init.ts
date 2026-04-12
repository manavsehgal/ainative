/**
 * `stagent app init` — scaffold a new .sap directory.
 */

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import * as yaml from "js-yaml";

export interface InitOptions {
  name: string;
  id?: string;
  description?: string;
  category?: string;
  author?: string;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export function initSapDirectory(outDir: string, options: InitOptions): string {
  const appId = options.id ?? slugify(options.name);
  const sapDir = join(outDir, `${appId}.sap`);

  // Create directory structure
  for (const subdir of [
    "",
    "templates",
    "schedules",
    "profiles",
    "blueprints",
    "seed-data",
  ]) {
    mkdirSync(join(sapDir, subdir), { recursive: true });
  }

  // Write manifest.yaml
  const manifest = {
    id: appId,
    name: options.name,
    version: "1.0.0",
    description: options.description ?? `${options.name} — a Stagent app`,
    author: {
      name: options.author ?? "App Creator",
    },
    license: "MIT",
    platform: {
      minVersion: "0.9.0",
    },
    marketplace: {
      category: options.category ?? "general",
      tags: [],
      difficulty: "beginner",
      pricing: "free",
    },
    sidebar: {
      label: options.name,
      icon: "Rocket",
      route: `/app/${appId}`,
    },
    provides: {
      profiles: [],
      blueprints: [],
      tables: [],
      schedules: [],
      triggers: [],
      pages: ["overview"],
    },
  };

  writeFileSync(
    join(sapDir, "manifest.yaml"),
    yaml.dump(manifest, { lineWidth: 120 }),
  );

  // Write README.md
  writeFileSync(
    join(sapDir, "README.md"),
    `# ${options.name}\n\n${options.description ?? "A Stagent app."}\n\n## Getting Started\n\n1. Edit \`manifest.yaml\` to configure your app\n2. Add table templates in \`templates/\`\n3. Add schedules in \`schedules/\`\n4. Run \`stagent app validate\` to check your app\n5. Run \`stagent app pack\` to create a distributable package\n`,
  );

  return sapDir;
}
