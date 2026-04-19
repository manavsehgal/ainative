import fs from "node:fs";
import path from "node:path";
import {
  getAinativePluginsDir,
  getAinativePluginExamplesDir,
} from "@/lib/utils/ainative-paths";

/**
 * Copy `src/lib/plugins/examples/<id>/` into the user's plugins dir on first boot.
 * Only fires when the plugins/ directory has zero subdirectories.
 * Idempotent: a second call with a populated plugins/ is a no-op.
 */
export function seedExamplePluginsIfEmpty(): void {
  const target = getAinativePluginsDir();
  const examples = getAinativePluginExamplesDir();
  if (!fs.existsSync(examples)) return; // npx distribution may strip examples
  fs.mkdirSync(target, { recursive: true });
  const existing = fs.readdirSync(target, { withFileTypes: true }).filter((e) => e.isDirectory());
  if (existing.length > 0) return;
  for (const entry of fs.readdirSync(examples, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    fs.cpSync(
      path.join(examples, entry.name),
      path.join(target, entry.name),
      { recursive: true }
    );
  }
}
