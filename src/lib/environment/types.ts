/**
 * Core types for the environment scanner system.
 * Discovers and models CLI artifacts from Claude Code and Codex.
 */

export type ArtifactCategory =
  | "skill"
  | "plugin"
  | "hook"
  | "mcp-server"
  | "permission"
  | "instruction"
  | "memory"
  | "rule"
  | "reference"
  | "output-style";

export type ToolPersona = "claude-code" | "codex" | "shared";

export type ArtifactScope = "user" | "project";

export interface EnvironmentArtifact {
  tool: ToolPersona;
  category: ArtifactCategory;
  scope: ArtifactScope;
  name: string;
  relPath: string;
  absPath: string;
  contentHash: string;
  preview: string;
  metadata: Record<string, unknown>;
  sizeBytes: number;
  modifiedAt: number;
}

export interface ScanError {
  path: string;
  error: string;
}

export interface ScanResult {
  personas: ToolPersona[];
  artifacts: EnvironmentArtifact[];
  errors: ScanError[];
  durationMs: number;
}

export interface ScanOptions {
  projectDir: string;
  userHome: string;
}
