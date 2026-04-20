/**
 * transport-dispatch.ts — T4 transport validation (TDR-035 §4, §5, §6)
 *
 * Exports three functions for pre-flight MCP validation:
 *
 *   validateStdioMcp(config, pluginId, serverName, opts?)
 *     Spawns the stdio binary, sends MCP initialize, waits up to 10s for a
 *     valid JSON-RPC response, then kills the child (SIGTERM + 5s + SIGKILL).
 *     detached: false is REQUIRED per TDR-035 §6 — never change to true.
 *
 *   validateInProcessSdk(config, pluginId, serverName)
 *     Dynamic `await import()` of the absolute entry path, duck-types the
 *     createServer() export against MCP SDK server shape.
 *
 *   bustInProcessServerCache(absPath)
 *     Wraps require.cache delete in try/catch — safe in ESM/CJS/Windows.
 *
 * Pre-flight model (Option A): validation only, no long-lived children.
 * The SDK / Codex / other adapters spawn their own children at request time.
 *
 * TDR-032 discipline: no static imports from @/lib/chat/* or @/lib/agents/claude-agent.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

import {
  getAinativeLogsDir,
} from "@/lib/utils/ainative-paths";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Subset of NormalizedMcpConfig fields needed by the validators. */
export interface TransportConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  transport?: "ainative-sdk";
  entry?: string; // resolved absolute path
}

export type StdioValidationResult =
  | { ok: true }
  | { ok: false; reason: "stdio_init_timeout" | "stdio_init_malformed"; detail?: string };

export type SdkValidationResult =
  | { ok: true }
  | { ok: false; reason: "sdk_invalid_export"; detail?: string };

// ---------------------------------------------------------------------------
// Logging helper (same pattern as mcp-loader.ts — extracted on 3rd use)
// ---------------------------------------------------------------------------

function logToFile(line: string): void {
  try {
    const logsDir = getAinativeLogsDir();
    fs.mkdirSync(logsDir, { recursive: true });
    fs.appendFileSync(
      path.join(logsDir, "plugins.log"),
      `${new Date().toISOString()} ${line}\n`
    );
  } catch {
    /* swallow log errors — never let logging break dispatch */
  }
}

// ---------------------------------------------------------------------------
// MCP JSON-RPC constants
// ---------------------------------------------------------------------------

const MCP_INITIALIZE_REQUEST = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: {
      name: "ainative-plugin-validator",
      version: "0.1.0",
    },
  },
});

const MCP_INITIALIZED_NOTIFICATION = JSON.stringify({
  jsonrpc: "2.0",
  method: "notifications/initialized",
  params: {},
});

// ---------------------------------------------------------------------------
// Stdio transport validator
// ---------------------------------------------------------------------------

/**
 * Validates a stdio MCP server by:
 * 1. Spawning with detached: false (TDR-035 §6 — invariant, never change).
 * 2. Sending MCP initialize request over stdin.
 * 3. Waiting up to timeoutMs (default 10000) for a valid JSON-RPC response.
 * 4. Killing the child after validation (SIGTERM + 5s SIGKILL fallback).
 *
 * stderr lines during the validation window are streamed to plugins.log.
 */
export async function validateStdioMcp(
  config: TransportConfig,
  pluginId: string,
  serverName: string,
  opts?: { timeoutMs?: number }
): Promise<StdioValidationResult> {
  const timeoutMs = opts?.timeoutMs ?? 10_000;
  const logPrefix = `[plugin ${pluginId}/${serverName}]`;

  if (!config.command) {
    return {
      ok: false,
      reason: "stdio_init_malformed",
      detail: "no command in config",
    };
  }

  const cmd = config.command;
  const args = config.args ?? [];
  const env: NodeJS.ProcessEnv = config.env
    ? { ...process.env, ...config.env }
    : { ...process.env };

  return new Promise<StdioValidationResult>((resolve) => {
    let settled = false;
    let killTimer: ReturnType<typeof setTimeout> | null = null;

    function settle(result: StdioValidationResult): void {
      if (settled) return;
      settled = true;
      if (killTimer) clearTimeout(killTimer);
      killChild(child, logPrefix, result, resolve);
    }

    // Spawn — detached: false is required. Do NOT change to true.
    const child = spawn(cmd, args, {
      detached: false,
      stdio: ["pipe", "pipe", "pipe"],
      env,
    });

    // Stream stderr to plugins.log with prefix per spec.
    const stderrRl = readline.createInterface({ input: child.stderr! });
    stderrRl.on("line", (line: string) => {
      logToFile(`${logPrefix} stderr: ${line}`);
    });

    // Parse stdout as newline-delimited JSON-RPC.
    const stdoutRl = readline.createInterface({ input: child.stdout! });
    stdoutRl.on("line", (line: string) => {
      if (settled) return;
      if (!line.trim()) return;

      let msg: unknown;
      try {
        msg = JSON.parse(line);
      } catch {
        // Non-JSON line — wait for a proper response.
        return;
      }

      // Validate response shape.
      if (
        msg !== null &&
        typeof msg === "object" &&
        "id" in msg &&
        (msg as Record<string, unknown>)["id"] === 1 &&
        "result" in msg &&
        typeof (msg as Record<string, unknown>)["result"] === "object"
      ) {
        // Valid response — send initialized notification as courtesy.
        try {
          child.stdin!.write(MCP_INITIALIZED_NOTIFICATION + "\n");
          child.stdin!.end();
        } catch {
          /* best-effort — child may have closed stdin */
        }
        settle({ ok: true });
      } else if (
        msg !== null &&
        typeof msg === "object" &&
        "id" in msg &&
        (msg as Record<string, unknown>)["id"] === 1
      ) {
        // Response with matching id but wrong shape.
        settle({
          ok: false,
          reason: "stdio_init_malformed",
          detail: `unexpected response shape: ${JSON.stringify(msg)}`,
        });
      }
      // Other messages (notifications etc.) — keep waiting.
    });

    // Child crash before response.
    child.on("exit", (code: number | null) => {
      if (!settled) {
        settle({
          ok: false,
          reason: "stdio_init_malformed",
          detail: `child exited early with code ${code}`,
        });
      }
    });

    child.on("error", (err: Error) => {
      if (!settled) {
        settle({
          ok: false,
          reason: "stdio_init_malformed",
          detail: `spawn error: ${err.message}`,
        });
      }
    });

    // Send initialize request.
    try {
      child.stdin!.write(MCP_INITIALIZE_REQUEST + "\n");
    } catch (err) {
      settle({
        ok: false,
        reason: "stdio_init_malformed",
        detail: `failed to write initialize: ${err instanceof Error ? err.message : String(err)}`,
      });
      return;
    }

    // Timeout.
    killTimer = setTimeout(() => {
      settle({ ok: false, reason: "stdio_init_timeout" });
    }, timeoutMs);
  });
}

/**
 * Kill a child after validation — SIGTERM first, SIGKILL after 5s if still alive.
 * This is fire-and-collect: we wait for the exit event to close cleanly,
 * but the caller's promise resolves immediately with the validation result.
 */
function killChild(
  child: ReturnType<typeof spawn>,
  logPrefix: string,
  result: StdioValidationResult,
  resolve: (r: StdioValidationResult) => void
): void {
  resolve(result);

  let sigkillTimer: ReturnType<typeof setTimeout> | null = null;

  function onExit(): void {
    if (sigkillTimer) clearTimeout(sigkillTimer);
  }

  child.once("exit", onExit);
  child.once("close", onExit);

  try {
    child.kill("SIGTERM");
  } catch {
    /* already dead */
    return;
  }

  sigkillTimer = setTimeout(() => {
    try {
      child.kill("SIGKILL");
    } catch {
      /* already dead */
    }
    logToFile(`${logPrefix} SIGKILL sent after SIGTERM timeout`);
  }, 5_000);
}

// ---------------------------------------------------------------------------
// In-process SDK transport validator
// ---------------------------------------------------------------------------

/**
 * Validates an ainative-sdk module by:
 * 1. Dynamic await import() of the absolute entry path.
 * 2. Resolving createServer from named or default export.
 * 3. Calling createServer() and duck-typing the return value.
 *
 * Duck-type: return value must have setRequestHandler, connect, or onRequest.
 */
export async function validateInProcessSdk(
  config: TransportConfig,
  pluginId: string,
  serverName: string
): Promise<SdkValidationResult> {
  const logPrefix = `[plugin ${pluginId}/${serverName}]`;

  if (!config.entry) {
    return {
      ok: false,
      reason: "sdk_invalid_export",
      detail: "no entry in config",
    };
  }

  const absPath = config.entry;

  if (!path.isAbsolute(absPath)) {
    return {
      ok: false,
      reason: "sdk_invalid_export",
      detail: `entry must be absolute path, got: ${absPath}`,
    };
  }

  // Validate extension — .ts is not supported (must be pre-built).
  const ext = path.extname(absPath);
  if (ext === ".ts") {
    return {
      ok: false,
      reason: "sdk_invalid_export",
      detail: "TypeScript entry files (.ts) are not supported — plugin must be pre-built to .js/.mjs",
    };
  }

  let mod: unknown;
  try {
    // Use require() for .js/.cjs (CJS plugin builds) — it handles absolute
    // paths reliably and avoids Vite/bundler interception in test environments.
    // Fall back to dynamic import() for .mjs (ESM-only plugin builds).
    if (ext === ".mjs") {
      // Dynamic import for ESM modules — never static (TDR-032).
      mod = await import(absPath);
    } else {
      // CJS require — wrapped in eval to avoid static analysis / bundler
      // treating it as a static import. The indirect call also suppresses
      // the ESLint no-require warning without needing inline eslint-disable.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      mod = require(absPath);
    }
  } catch (err) {
    logToFile(
      `${logPrefix} import failed: ${err instanceof Error ? err.message : String(err)}`
    );
    return {
      ok: false,
      reason: "sdk_invalid_export",
      detail: `import error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Resolve createServer — named export takes priority, then default export.
  let createServer: unknown;
  if (
    mod !== null &&
    typeof mod === "object" &&
    "createServer" in (mod as Record<string, unknown>) &&
    typeof (mod as Record<string, unknown>)["createServer"] === "function"
  ) {
    createServer = (mod as Record<string, unknown>)["createServer"];
  } else if (
    mod !== null &&
    typeof mod === "object" &&
    "default" in (mod as Record<string, unknown>)
  ) {
    const def = (mod as Record<string, unknown>)["default"];
    if (
      def !== null &&
      typeof def === "object" &&
      "createServer" in (def as Record<string, unknown>) &&
      typeof (def as Record<string, unknown>)["createServer"] === "function"
    ) {
      createServer = (def as Record<string, unknown>)["createServer"];
    }
  }

  if (typeof createServer !== "function") {
    logToFile(`${logPrefix} no createServer export found`);
    return {
      ok: false,
      reason: "sdk_invalid_export",
      detail: "module does not export createServer (named or default.createServer)",
    };
  }

  let serverInstance: unknown;
  try {
    serverInstance = await (createServer as () => unknown)();
  } catch (err) {
    logToFile(
      `${logPrefix} createServer() threw: ${err instanceof Error ? err.message : String(err)}`
    );
    return {
      ok: false,
      reason: "sdk_invalid_export",
      detail: `createServer() threw: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Duck-type: MCP SDK server must have at least one of these methods.
  if (
    serverInstance === null ||
    typeof serverInstance !== "object"
  ) {
    logToFile(`${logPrefix} createServer() returned non-object: ${typeof serverInstance}`);
    return {
      ok: false,
      reason: "sdk_invalid_export",
      detail: `createServer() returned ${typeof serverInstance}, expected MCP server object`,
    };
  }

  const srv = serverInstance as Record<string, unknown>;
  const hasMcpShape =
    typeof srv["setRequestHandler"] === "function" ||
    typeof srv["connect"] === "function" ||
    "onRequest" in srv;

  if (!hasMcpShape) {
    logToFile(
      `${logPrefix} createServer() return value lacks MCP server shape (setRequestHandler/connect/onRequest)`
    );
    return {
      ok: false,
      reason: "sdk_invalid_export",
      detail: "createServer() return value missing setRequestHandler, connect, or onRequest",
    };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// require.cache bust helper (T15 reload hook)
// ---------------------------------------------------------------------------

/**
 * Bust the CommonJS require.cache entry for an absolute module path.
 *
 * Safe to call from any runtime:
 * - CJS: deletes the cache entry so next require/import sees a fresh load.
 * - ESM: require.cache may not exist or require.resolve may throw — noop.
 * - Windows: no special handling needed; require.cache works on Win32 CJS.
 *
 * Called by T15 reload to invalidate a running SDK plugin before re-import.
 */
export function bustInProcessServerCache(absPath: string): void {
  try {
    // In ESM contexts, require may not exist or require.resolve may fail.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const resolved = require.resolve(absPath);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    delete require.cache[resolved];
  } catch {
    // ESM-only environment or path-resolution failure — noop.
    // Next dynamic import() will load the module fresh regardless.
  }
}
