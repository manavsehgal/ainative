import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { z } from "zod";
import { getAppRoot } from "@/lib/utils/app-root";

const StarterPreviewSchema = z
  .object({
    profiles: z.number().int().nonnegative().default(0),
    blueprints: z.number().int().nonnegative().default(0),
    tables: z.number().int().nonnegative().default(0),
    schedules: z.number().int().nonnegative().default(0),
  })
  .default({ profiles: 0, blueprints: 0, tables: 0, schedules: 0 });

export const StarterTemplateSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().default(""),
    persona: z.string().default(""),
    icon: z.string().default("sparkles"),
    starterPrompt: z.string().min(1),
    preview: StarterPreviewSchema,
  })
  .passthrough();

export type StarterTemplate = z.infer<typeof StarterTemplateSchema>;

export function parseStarter(yamlText: string): StarterTemplate | null {
  try {
    const parsed = yaml.load(yamlText);
    const result = StarterTemplateSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function defaultStartersDir(): string {
  return path.join(
    getAppRoot(import.meta.dirname, 3),
    ".claude",
    "apps",
    "starters"
  );
}

export function listStarters(dir: string = defaultStartersDir()): StarterTemplate[] {
  if (!fs.existsSync(dir)) return [];
  const out: StarterTemplate[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".yaml") && !entry.name.endsWith(".yml")) continue;
    try {
      const text = fs.readFileSync(path.join(dir, entry.name), "utf-8");
      const starter = parseStarter(text);
      if (starter) out.push(starter);
    } catch {
      continue;
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}
