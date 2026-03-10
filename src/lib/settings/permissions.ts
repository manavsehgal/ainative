import { getSetting, setSetting } from "./helpers";
import { SETTINGS_KEYS } from "@/lib/constants/settings";

/**
 * Get all saved permission patterns.
 */
export async function getAllowedPermissions(): Promise<string[]> {
  const raw = await getSetting(SETTINGS_KEYS.PERMISSIONS_ALLOW);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Add a permission pattern (no-op if duplicate).
 */
export async function addAllowedPermission(pattern: string): Promise<void> {
  const current = await getAllowedPermissions();
  if (current.includes(pattern)) return;
  current.push(pattern);
  await setSetting(SETTINGS_KEYS.PERMISSIONS_ALLOW, JSON.stringify(current));
}

/**
 * Remove a permission pattern.
 */
export async function removeAllowedPermission(pattern: string): Promise<void> {
  const current = await getAllowedPermissions();
  const filtered = current.filter((p) => p !== pattern);
  await setSetting(SETTINGS_KEYS.PERMISSIONS_ALLOW, JSON.stringify(filtered));
}

/**
 * Check whether a tool invocation is pre-approved by any saved pattern.
 */
export async function isToolAllowed(
  toolName: string,
  input: Record<string, unknown>
): Promise<boolean> {
  const patterns = await getAllowedPermissions();
  return patterns.some((pattern) => matchesPermission(toolName, input, pattern));
}

/**
 * Pure matching function — checks if a tool+input matches a permission pattern.
 *
 * Pattern formats:
 * - "Read" — blanket allow for any Read invocation
 * - "Bash(command:git *)" — allow Bash when command starts with "git "
 * - "mcp__server__tool" — exact tool name match
 */
export function matchesPermission(
  toolName: string,
  input: Record<string, unknown>,
  pattern: string
): boolean {
  const parenIdx = pattern.indexOf("(");

  // No constraint — bare tool name match
  if (parenIdx === -1) {
    return pattern === toolName;
  }

  const patternTool = pattern.slice(0, parenIdx);
  if (patternTool !== toolName) return false;

  // Parse constraint: "key:glob)"
  const constraint = pattern.slice(parenIdx + 1, -1); // strip parens
  const colonIdx = constraint.indexOf(":");
  if (colonIdx === -1) return false;

  const key = constraint.slice(0, colonIdx);
  const glob = constraint.slice(colonIdx + 1);
  const inputValue = String(input[key] ?? "");

  if (glob.endsWith("*")) {
    return inputValue.startsWith(glob.slice(0, -1));
  }
  return inputValue === glob;
}

/**
 * Generate a suggested permission pattern from a tool invocation.
 * Uses smart defaults — Bash gets granular patterns, others get blanket.
 */
export function buildPermissionPattern(
  toolName: string,
  input: Record<string, unknown>
): string {
  if (toolName === "Bash" && typeof input.command === "string") {
    const command = input.command;
    const firstWord = command.split(/\s+/)[0];
    return `Bash(command:${firstWord} *)`;
  }

  // Most tools are safe to blanket-allow
  return toolName;
}
