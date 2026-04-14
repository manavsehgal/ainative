// ─── Claude Agent SDK options shared by chat and task runtimes ──────
//
// Chat (src/lib/chat/engine.ts) and task (src/lib/agents/claude-agent.ts)
// both construct query() options for the `claude-code` runtime. These
// constants are the single source of truth so the two code paths cannot
// drift — a drift that would manifest as "skills work in chat but vanish
// in tasks on the same project." See features/task-runtime-skill-parity.md
// and features/chat-claude-sdk-skills.md.

export const CLAUDE_SDK_SETTING_SOURCES = ["user", "project"] as const;

export const CLAUDE_SDK_ALLOWED_TOOLS = [
  "Skill",
  "Read",
  "Grep",
  "Glob",
  "Edit",
  "Write",
  "Bash",
  "TodoWrite",
] as const;

/**
 * Filesystem tools safe to auto-allow without a permission prompt.
 * Mirrors the existing browser/exa read-only auto-allow pattern.
 */
export const CLAUDE_SDK_READ_ONLY_FS_TOOLS = new Set<string>([
  "Read",
  "Grep",
  "Glob",
]);

/**
 * Build the environment for the Claude Agent SDK subprocess.
 *
 * Always strips CLAUDECODE (prevents nested-session issues) and
 * ANTHROPIC_API_KEY (prevents SDK from using API-key auth when
 * OAuth mode is intended).
 *
 * - API-key mode: authEnv is provided → key gets merged back in via spread.
 * - OAuth mode:   authEnv is undefined → key stays stripped, SDK falls
 *   through to cached OAuth tokens from `claude login`.
 */
export function buildClaudeSdkEnv(
  authEnv?: Record<string, string>
): Record<string, string> {
  const { CLAUDECODE, ANTHROPIC_API_KEY, ...cleanEnv } =
    process.env as Record<string, string>;

  if (authEnv) {
    // API key mode — merge the provided key into clean env
    return { ...cleanEnv, ...authEnv };
  }

  // OAuth mode — return env WITHOUT ANTHROPIC_API_KEY
  // so the SDK subprocess uses cached OAuth tokens from Claude CLI
  return cleanEnv;
}
