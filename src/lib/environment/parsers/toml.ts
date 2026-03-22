/**
 * Thin wrapper around smol-toml for parsing Codex config.toml files.
 */

import { parse } from "smol-toml";

export function parseTOML(content: string): Record<string, unknown> | null {
  try {
    return parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}
