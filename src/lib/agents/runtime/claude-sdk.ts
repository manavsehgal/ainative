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
