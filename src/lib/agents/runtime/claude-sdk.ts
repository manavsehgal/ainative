/**
 * Build the environment for the Claude Agent SDK subprocess.
 * Returns undefined when no changes are needed.
 */
export function buildClaudeSdkEnv(
  authEnv?: Record<string, string>
): Record<string, string> | undefined {
  const isNested = "CLAUDECODE" in process.env;
  if (!authEnv && !isNested) return undefined;
  const { CLAUDECODE, ...cleanEnv } = process.env as Record<string, string>;
  return { ...cleanEnv, ...authEnv };
}
