import { existsSync } from "fs";
import { dirname, join } from "path";

export const SIDECAR_LOOPBACK_HOST = "127.0.0.1";

export function wasPortExplicitlyRequested(argv: string[]): boolean {
  return argv.some(
    (argument) =>
      argument === "-p" ||
      argument === "--port" ||
      argument.startsWith("--port="),
  );
}

export async function resolveSidecarPort({
  argv,
  requestedPort,
  findAvailablePort,
}: {
  argv: string[];
  requestedPort: number;
  findAvailablePort: (preferred: number) => Promise<number>;
}): Promise<number> {
  if (wasPortExplicitlyRequested(argv)) {
    return requestedPort;
  }

  return findAvailablePort(requestedPort);
}

function findClosestPath(
  cwd: string,
  segments: string[],
  exists: (targetPath: string) => boolean = existsSync,
): string | null {
  let dir = cwd;

  while (true) {
    const candidate = join(dir, ...segments);
    if (exists(candidate)) {
      return candidate;
    }

    const parent = dirname(dir);
    if (parent === dir) {
      return null;
    }

    dir = parent;
  }
}

export function resolveNextEntrypoint(
  cwd: string,
  exists: (targetPath: string) => boolean = existsSync,
): string {
  const nextEntrypoint = findClosestPath(cwd, ["node_modules", "next", "dist", "bin", "next"], exists);
  if (nextEntrypoint) {
    return nextEntrypoint;
  }

  throw new Error(
    `Could not resolve Next.js CLI entrypoint from ${cwd}. Expected node_modules/next/dist/bin/next.`,
  );
}

export function buildNextLaunchArgs({
  isPrebuilt,
  port,
  host = SIDECAR_LOOPBACK_HOST,
  turbopack = true,
}: {
  isPrebuilt: boolean;
  port: number;
  host?: string;
  turbopack?: boolean;
}): string[] {
  if (isPrebuilt) {
    return ["start", "--hostname", host, "--port", String(port)];
  }

  const args = ["dev", "--hostname", host, "--port", String(port)];
  if (turbopack) args.push("--turbopack");
  return args;
}

export function buildSidecarUrl(port: number, host = SIDECAR_LOOPBACK_HOST): string {
  return `http://${host}:${port}`;
}
