/**
 * Known Claude Code / Agent SDK tools for autocomplete in profile forms.
 */
export const KNOWN_TOOLS = [
  "Read",
  "Write",
  "Edit",
  "Bash",
  "Grep",
  "Glob",
  "WebSearch",
  "WebFetch",
  "TodoRead",
  "TodoWrite",
  "NotebookEdit",
  "NotebookRead",
] as const;

export type KnownTool = (typeof KNOWN_TOOLS)[number];
