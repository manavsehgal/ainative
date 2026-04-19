/**
 * mcp-loader.test.ts — T3 plugin-MCP loader skeleton
 *
 * ~20 assertions covering: happy paths, env/args template resolution,
 * safe-mode short-circuit, runtime filter (Ollama), capability gating,
 * hash-drift, transport determination, file-existence checks,
 * per-plugin isolation, Kind 5 ignore, multi-server plugins,
 * and the T5 catalog invariant for supportsPluginMcpServers.
 *
 * Uses real fs (tmpdir) — no mocked fs. Pattern matches T2 tests.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import {
  loadPluginMcpServers,
  listPluginMcpRegistrations,
} from "../mcp-loader";
import { writePluginsLock } from "../capability-check";
import { deriveManifestHash } from "../capability-check";
import { getRuntimeFeatures } from "@/lib/agents/runtime/catalog";
import type { AgentRuntimeId } from "@/lib/agents/runtime/catalog";

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

let tmpDir: string;
let pluginsDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-loader-test-"));
  pluginsDir = path.join(tmpDir, "plugins");
  fs.mkdirSync(pluginsDir, { recursive: true });
  process.env.AINATIVE_DATA_DIR = tmpDir;
  delete process.env.AINATIVE_SAFE_MODE;
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.AINATIVE_DATA_DIR;
  delete process.env.AINATIVE_SAFE_MODE;
});

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/** Write a minimal valid chat-tools plugin.yaml and return its YAML content string. */
function writePluginYaml(pluginId: string, overrides: Record<string, unknown> = {}): string {
  const dir = path.join(pluginsDir, pluginId);
  fs.mkdirSync(dir, { recursive: true });

  const manifest: Record<string, unknown> = {
    id: pluginId,
    version: "1.0.0",
    apiVersion: "0.15",
    kind: "chat-tools",
    capabilities: ["net"],
    ...overrides,
  };

  // Build YAML manually to avoid js-yaml dependency in fixture helper.
  // Quote strings that look like numbers so YAML parses them as strings.
  const lines: string[] = [];
  for (const [key, val] of Object.entries(manifest)) {
    if (Array.isArray(val)) {
      lines.push(`${key}:`);
      for (const item of val) lines.push(`  - ${item}`);
    } else if (typeof val === "string" && /^\d+(\.\d+)+$/.test(val)) {
      // Quote version-like strings (e.g. "0.15", "1.0.0") so YAML doesn't
      // misparse them as numbers — the Zod schema expects z.string().
      lines.push(`${key}: "${val}"`);
    } else {
      lines.push(`${key}: ${val}`);
    }
  }
  const yamlContent = lines.join("\n") + "\n";
  fs.writeFileSync(path.join(dir, "plugin.yaml"), yamlContent);
  return yamlContent;
}

/** Write .mcp.json for a plugin. */
function writeMcpJson(pluginId: string, mcpServers: Record<string, unknown>): void {
  const dir = path.join(pluginsDir, pluginId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, ".mcp.json"),
    JSON.stringify({ mcpServers }, null, 2)
  );
}

/** Accept capabilities for a plugin (write to plugins.lock). */
function acceptPlugin(pluginId: string, yamlContent: string): void {
  const hash = deriveManifestHash(yamlContent);
  writePluginsLock(pluginId, {
    manifestHash: hash,
    capabilities: ["net"],
    acceptedAt: new Date().toISOString(),
    acceptedBy: "test",
  });
}

/** Create a file so existsSync passes. */
function touchFile(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, "");
}

// ---------------------------------------------------------------------------
// Test 1: Happy path — Kind 1 plugin, accepted, valid stdio .mcp.json
// ---------------------------------------------------------------------------

it("1. Happy path: accepted chat-tools plugin with stdio command returns server in output", async () => {
  const pluginId = "echo-server";
  const yaml = writePluginYaml(pluginId);
  touchFile(path.join(pluginsDir, pluginId, "bin", "server"));

  writeMcpJson(pluginId, {
    "echo": {
      command: "./bin/server",
      args: ["--port", "3001"],
    },
  });
  acceptPlugin(pluginId, yaml);

  const result = await loadPluginMcpServers();
  expect(result).toHaveProperty("echo");
  expect(result["echo"].command).toBe(
    path.join(pluginsDir, pluginId, "bin", "server")
  );
  expect(result["echo"].args).toEqual(["--port", "3001"]);
});

// ---------------------------------------------------------------------------
// Test 2: Ainative-SDK transport
// ---------------------------------------------------------------------------

it("2. Ainative-SDK transport: accepted plugin with entry file returns transport:ainative-sdk", async () => {
  const pluginId = "sdk-plugin";
  const yaml = writePluginYaml(pluginId);
  touchFile(path.join(pluginsDir, pluginId, "server", "index.js"));

  writeMcpJson(pluginId, {
    "sdk-server": {
      transport: "ainative-sdk",
      entry: "./server/index.js",
    },
  });
  acceptPlugin(pluginId, yaml);

  const result = await loadPluginMcpServers();
  expect(result).toHaveProperty("sdk-server");
  expect(result["sdk-server"].transport).toBe("ainative-sdk");
  expect(result["sdk-server"].entry).toBe(
    path.join(pluginsDir, pluginId, "server", "index.js")
  );
});

// ---------------------------------------------------------------------------
// Test 3: Env template resolution
// ---------------------------------------------------------------------------

it("3. Env template resolution: ${HOME}, ${AINATIVE_DATA_DIR}, ${PLUGIN_DIR} resolved in env values", async () => {
  const pluginId = "template-env-plugin";
  const yaml = writePluginYaml(pluginId);
  touchFile(path.join(pluginsDir, pluginId, "bin", "server"));

  writeMcpJson(pluginId, {
    "tmpl": {
      command: "./bin/server",
      env: {
        HOME_VAR: "${HOME}/.config",
        DATA_VAR: "${AINATIVE_DATA_DIR}/data",
        PLUGIN_VAR: "${PLUGIN_DIR}/config.json",
      },
    },
  });
  acceptPlugin(pluginId, yaml);

  const result = await loadPluginMcpServers();
  expect(result).toHaveProperty("tmpl");
  expect(result["tmpl"].env!["HOME_VAR"]).toBe(`${os.homedir()}/.config`);
  expect(result["tmpl"].env!["DATA_VAR"]).toBe(`${tmpDir}/data`);
  expect(result["tmpl"].env!["PLUGIN_VAR"]).toBe(
    path.join(pluginsDir, pluginId, "config.json")
  );
});

// ---------------------------------------------------------------------------
// Test 4: Args template resolution
// ---------------------------------------------------------------------------

it("4. Args template resolution: ${PLUGIN_DIR} resolved in args elements", async () => {
  const pluginId = "template-args-plugin";
  const yaml = writePluginYaml(pluginId);
  touchFile(path.join(pluginsDir, pluginId, "bin", "server"));

  writeMcpJson(pluginId, {
    "tmpl-args": {
      command: "./bin/server",
      args: ["--config", "${PLUGIN_DIR}/config.json", "--home", "${HOME}"],
    },
  });
  acceptPlugin(pluginId, yaml);

  const result = await loadPluginMcpServers();
  expect(result).toHaveProperty("tmpl-args");
  const expectedConfig = path.join(pluginsDir, pluginId, "config.json");
  expect(result["tmpl-args"].args).toEqual([
    "--config",
    expectedConfig,
    "--home",
    os.homedir(),
  ]);
});

// ---------------------------------------------------------------------------
// Test 5: AINATIVE_SAFE_MODE short-circuit
// ---------------------------------------------------------------------------

it("5. Safe mode: AINATIVE_SAFE_MODE=true returns {} even with accepted plugins", async () => {
  const pluginId = "safe-mode-plugin";
  const yaml = writePluginYaml(pluginId);
  touchFile(path.join(pluginsDir, pluginId, "bin", "server"));
  writeMcpJson(pluginId, { "svc": { command: "./bin/server" } });
  acceptPlugin(pluginId, yaml);

  process.env.AINATIVE_SAFE_MODE = "true";
  const result = await loadPluginMcpServers();
  expect(result).toEqual({});
});

// ---------------------------------------------------------------------------
// Test 6: Ollama runtime filter
// ---------------------------------------------------------------------------

it("6. Ollama runtime filter: { runtime: 'ollama' } returns {} + logs per-plugin skip line", async () => {
  const pluginId = "ollama-filter-plugin";
  const yaml = writePluginYaml(pluginId);
  touchFile(path.join(pluginsDir, pluginId, "bin", "server"));
  writeMcpJson(pluginId, { "svc": { command: "./bin/server" } });
  acceptPlugin(pluginId, yaml);

  const result = await loadPluginMcpServers({ runtime: "ollama" });
  expect(result).toEqual({});

  // Spec: "plugin <id> skipped on <runtime> runtime" per plugin, once per session.
  const logPath = path.join(tmpDir, "logs", "plugins.log");
  const logContent = fs.readFileSync(logPath, "utf-8");
  expect(logContent).toMatch(
    new RegExp(`plugin ${pluginId} skipped on ollama runtime`)
  );
});

// ---------------------------------------------------------------------------
// Test 7: Capability not accepted
// ---------------------------------------------------------------------------

it("7. Capability not accepted: plugin with valid .mcp.json but no lock entry is not in output", async () => {
  const pluginId = "unaccepted-plugin";
  writePluginYaml(pluginId);
  touchFile(path.join(pluginsDir, pluginId, "bin", "server"));
  writeMcpJson(pluginId, { "svc": { command: "./bin/server" } });
  // Note: NO acceptPlugin call

  const result = await loadPluginMcpServers();
  expect(result).not.toHaveProperty("svc");

  const regs = await listPluginMcpRegistrations();
  const reg = regs.find((r) => r.pluginId === pluginId);
  expect(reg).toBeDefined();
  expect(reg!.status).toBe("pending_capability_accept");
  expect(reg!.disabledReason).toBe("capability_not_accepted");
});

// ---------------------------------------------------------------------------
// Test 8: Hash drift (capability_accept_stale)
// ---------------------------------------------------------------------------

it("8. Hash drift: plugin accepted under old hash is not in output", async () => {
  const pluginId = "drifted-plugin";
  const oldHash = "sha256:" + "d".repeat(64);
  // Write lock with a stale hash.
  writePluginsLock(pluginId, {
    manifestHash: oldHash,
    capabilities: ["net"],
    acceptedAt: new Date().toISOString(),
    acceptedBy: "test",
  });

  // Write plugin with actual (different) hash.
  writePluginYaml(pluginId);
  touchFile(path.join(pluginsDir, pluginId, "bin", "server"));
  writeMcpJson(pluginId, { "svc": { command: "./bin/server" } });

  const result = await loadPluginMcpServers();
  expect(result).not.toHaveProperty("svc");

  const regs = await listPluginMcpRegistrations();
  const reg = regs.find((r) => r.pluginId === pluginId);
  expect(reg).toBeDefined();
  expect(reg!.status).toBe("pending_capability_reaccept");
  expect(reg!.disabledReason).toBe("capability_accept_stale");
});

// ---------------------------------------------------------------------------
// Test 9: Missing .mcp.json
// ---------------------------------------------------------------------------

it("9. Missing .mcp.json: plugin without .mcp.json emits disabled registration", async () => {
  const pluginId = "no-mcp-plugin";
  const yaml = writePluginYaml(pluginId);
  acceptPlugin(pluginId, yaml);
  // Note: no writeMcpJson call

  const result = await loadPluginMcpServers();
  expect(result).toEqual({});

  const regs = await listPluginMcpRegistrations();
  const reg = regs.find((r) => r.pluginId === pluginId);
  expect(reg).toBeDefined();
  expect(reg!.status).toBe("disabled");
  expect(reg!.disabledReason).toBe("mcp_parse_error");
});

// ---------------------------------------------------------------------------
// Test 10: Malformed .mcp.json
// ---------------------------------------------------------------------------

it("10. Malformed .mcp.json: invalid JSON produces mcp_parse_error registration", async () => {
  const pluginId = "malformed-plugin";
  const yaml = writePluginYaml(pluginId);
  acceptPlugin(pluginId, yaml);

  // Write invalid JSON.
  fs.writeFileSync(
    path.join(pluginsDir, pluginId, ".mcp.json"),
    "{ this is not json }"
  );

  const result = await loadPluginMcpServers();
  expect(result).toEqual({});

  const regs = await listPluginMcpRegistrations();
  const reg = regs.find((r) => r.pluginId === pluginId);
  expect(reg).toBeDefined();
  expect(reg!.disabledReason).toBe("mcp_parse_error");
});

// ---------------------------------------------------------------------------
// Test 11: Ambiguous transport
// ---------------------------------------------------------------------------

it("11. Ambiguous transport: both command and transport:ainative-sdk → ambiguous_mcp_transport", async () => {
  const pluginId = "ambiguous-plugin";
  const yaml = writePluginYaml(pluginId);
  touchFile(path.join(pluginsDir, pluginId, "bin", "server"));
  acceptPlugin(pluginId, yaml);

  writeMcpJson(pluginId, {
    "ambig": {
      command: "./bin/server",
      transport: "ainative-sdk",
      entry: "./server/index.js",
    },
  });

  const result = await loadPluginMcpServers();
  expect(result).not.toHaveProperty("ambig");

  const regs = await listPluginMcpRegistrations();
  const reg = regs.find((r) => r.serverName === "ambig");
  expect(reg).toBeDefined();
  expect(reg!.disabledReason).toBe("ambiguous_mcp_transport");
});

// ---------------------------------------------------------------------------
// Test 12: Invalid transport (neither command nor ainative-sdk)
// ---------------------------------------------------------------------------

it("12. Invalid transport: neither command nor transport:ainative-sdk → invalid_mcp_transport", async () => {
  const pluginId = "invalid-transport-plugin";
  const yaml = writePluginYaml(pluginId);
  acceptPlugin(pluginId, yaml);

  writeMcpJson(pluginId, {
    "invalid": {
      url: "http://localhost:8080",
    },
  });

  const result = await loadPluginMcpServers();
  expect(result).not.toHaveProperty("invalid");

  const regs = await listPluginMcpRegistrations();
  const reg = regs.find((r) => r.serverName === "invalid");
  expect(reg).toBeDefined();
  expect(reg!.disabledReason).toBe("invalid_mcp_transport");
});

// ---------------------------------------------------------------------------
// Test 13: Stdio relative command exists → accepted
// ---------------------------------------------------------------------------

it("13. Stdio relative command exists: ./bin/server exists → accepted", async () => {
  const pluginId = "relative-cmd-exists";
  const yaml = writePluginYaml(pluginId);
  touchFile(path.join(pluginsDir, pluginId, "bin", "server"));
  acceptPlugin(pluginId, yaml);

  writeMcpJson(pluginId, {
    "svc": { command: "./bin/server" },
  });

  const result = await loadPluginMcpServers();
  expect(result).toHaveProperty("svc");
  expect(result["svc"].status).toBeUndefined(); // NormalizedMcpConfig has no status field
});

// ---------------------------------------------------------------------------
// Test 14: Stdio relative command missing → server_not_found
// ---------------------------------------------------------------------------

it("14. Stdio relative command missing: ./bin/missing → server_not_found", async () => {
  const pluginId = "relative-cmd-missing";
  const yaml = writePluginYaml(pluginId);
  acceptPlugin(pluginId, yaml);

  writeMcpJson(pluginId, {
    "svc": { command: "./bin/missing" },
  });

  const result = await loadPluginMcpServers();
  expect(result).not.toHaveProperty("svc");

  const regs = await listPluginMcpRegistrations();
  const reg = regs.find((r) => r.serverName === "svc");
  expect(reg).toBeDefined();
  expect(reg!.disabledReason).toBe("server_not_found");
});

// ---------------------------------------------------------------------------
// Test 15: PATH-only stdio command → assume present, accepted
// ---------------------------------------------------------------------------

it("15. PATH-only stdio command: 'python' (no slash) → assumed present, accepted", async () => {
  const pluginId = "path-cmd-plugin";
  const yaml = writePluginYaml(pluginId);
  acceptPlugin(pluginId, yaml);

  writeMcpJson(pluginId, {
    "py-svc": {
      command: "python",
      args: ["./server.py"],
    },
  });

  const result = await loadPluginMcpServers();
  expect(result).toHaveProperty("py-svc");
  expect(result["py-svc"].command).toBe("python");
});

// ---------------------------------------------------------------------------
// Test 16: SDK entry missing → sdk_entry_not_found
// ---------------------------------------------------------------------------

it("16. SDK entry missing: transport:ainative-sdk with missing entry → sdk_entry_not_found", async () => {
  const pluginId = "sdk-missing-entry";
  const yaml = writePluginYaml(pluginId);
  acceptPlugin(pluginId, yaml);

  writeMcpJson(pluginId, {
    "sdk-svc": {
      transport: "ainative-sdk",
      entry: "./missing.js",
    },
  });

  const result = await loadPluginMcpServers();
  expect(result).not.toHaveProperty("sdk-svc");

  const regs = await listPluginMcpRegistrations();
  const reg = regs.find((r) => r.serverName === "sdk-svc");
  expect(reg).toBeDefined();
  expect(reg!.disabledReason).toBe("sdk_entry_not_found");
});

// ---------------------------------------------------------------------------
// Test 17: Per-plugin isolation
// ---------------------------------------------------------------------------

it("17. Per-plugin isolation: broken plugins A+B don't prevent plugin C from loading", async () => {
  // Plugin A: broken .mcp.json
  writePluginYaml("iso-a");
  fs.writeFileSync(path.join(pluginsDir, "iso-a", ".mcp.json"), "{{NOT JSON");

  // Plugin B: missing .mcp.json entirely
  writePluginYaml("iso-b");
  acceptPlugin("iso-b", fs.readFileSync(path.join(pluginsDir, "iso-b", "plugin.yaml"), "utf-8"));

  // Plugin C: fully valid
  const yamlC = writePluginYaml("iso-c");
  touchFile(path.join(pluginsDir, "iso-c", "bin", "server"));
  writeMcpJson("iso-c", { "c-svc": { command: "./bin/server" } });
  acceptPlugin("iso-c", yamlC);

  const result = await loadPluginMcpServers();
  expect(result).toHaveProperty("c-svc");
  expect(result).not.toHaveProperty("a-svc");
  expect(result).not.toHaveProperty("b-svc");
});

// ---------------------------------------------------------------------------
// Test 18: Kind 5 plugins (primitives-bundle) ignored
// ---------------------------------------------------------------------------

it("18. Kind 5 plugins (primitives-bundle) are ignored by the MCP loader", async () => {
  const pluginId = "my-primitives";
  const dir = path.join(pluginsDir, pluginId);
  fs.mkdirSync(dir, { recursive: true });

  // Write a primitives-bundle manifest.
  const primitiveYaml = [
    `id: ${pluginId}`,
    "version: 1.0.0",
    "apiVersion: 0.15",
    "kind: primitives-bundle",
  ].join("\n");
  fs.writeFileSync(path.join(dir, "plugin.yaml"), primitiveYaml);

  // Write a .mcp.json (should be ignored).
  writeMcpJson(pluginId, { "primitive-svc": { command: "node" } });

  const result = await loadPluginMcpServers();
  expect(result).not.toHaveProperty("primitive-svc");

  // No PluginMcpRegistration should be emitted for Kind 5.
  const regs = await listPluginMcpRegistrations();
  const reg = regs.find((r) => r.pluginId === pluginId);
  expect(reg).toBeUndefined();
});

// ---------------------------------------------------------------------------
// Test 19: Multiple servers per plugin
// ---------------------------------------------------------------------------

it("19. Multiple servers per plugin: both servers appear in output", async () => {
  const pluginId = "multi-server-plugin";
  const yaml = writePluginYaml(pluginId);
  touchFile(path.join(pluginsDir, pluginId, "bin", "alpha"));
  touchFile(path.join(pluginsDir, pluginId, "bin", "beta"));
  acceptPlugin(pluginId, yaml);

  writeMcpJson(pluginId, {
    "alpha": { command: "./bin/alpha" },
    "beta": { command: "./bin/beta" },
  });

  const result = await loadPluginMcpServers();
  expect(result).toHaveProperty("alpha");
  expect(result).toHaveProperty("beta");
  expect(result["alpha"].command).toBe(path.join(pluginsDir, pluginId, "bin", "alpha"));
  expect(result["beta"].command).toBe(path.join(pluginsDir, pluginId, "bin", "beta"));
});

// ---------------------------------------------------------------------------
// Test 20: T5 catalog invariant — supportsPluginMcpServers values
// ---------------------------------------------------------------------------

describe("T5 catalog invariant — supportsPluginMcpServers per runtime", () => {
  it("20. supportsPluginMcpServers matches TDR-035 §1 declarations for all 5 runtimes", () => {
    const expected: Record<AgentRuntimeId, boolean> = {
      "claude-code": true,
      "openai-codex-app-server": true,
      "anthropic-direct": true,
      "openai-direct": true,
      "ollama": false,
    };

    for (const [runtimeId, expectedValue] of Object.entries(expected)) {
      expect(
        getRuntimeFeatures(runtimeId as AgentRuntimeId).supportsPluginMcpServers,
        `${runtimeId}.supportsPluginMcpServers should be ${expectedValue}`
      ).toBe(expectedValue);
    }
  });
});

// ---------------------------------------------------------------------------
// Bonus: listPluginMcpRegistrations returns full list including disabled entries
// ---------------------------------------------------------------------------

it("Bonus: listPluginMcpRegistrations includes disabled entries not in loadPluginMcpServers", async () => {
  // Unaccepted plugin.
  const pluginId = "bonus-unaccepted";
  writePluginYaml(pluginId);
  touchFile(path.join(pluginsDir, pluginId, "bin", "server"));
  writeMcpJson(pluginId, { "b-svc": { command: "./bin/server" } });
  // No accept.

  const loadResult = await loadPluginMcpServers();
  expect(loadResult).not.toHaveProperty("b-svc");

  const listResult = await listPluginMcpRegistrations();
  const reg = listResult.find((r) => r.pluginId === pluginId);
  expect(reg).toBeDefined();
  expect(reg!.status).toBe("pending_capability_accept");
});

// ---------------------------------------------------------------------------
// Bonus: plugins.log receives entries on parse errors
// ---------------------------------------------------------------------------

it("Bonus: plugins.log contains plugin id and reason after mcp_parse_error", async () => {
  const pluginId = "log-test-plugin";
  const yaml = writePluginYaml(pluginId);
  acceptPlugin(pluginId, yaml);
  // Write invalid JSON to force mcp_parse_error.
  fs.writeFileSync(
    path.join(pluginsDir, pluginId, ".mcp.json"),
    "INVALID"
  );

  await loadPluginMcpServers();

  const logPath = path.join(tmpDir, "logs", "plugins.log");
  expect(fs.existsSync(logPath)).toBe(true);
  const logContent = fs.readFileSync(logPath, "utf-8");
  expect(logContent).toMatch(new RegExp(pluginId));
  expect(logContent).toMatch(/mcp_parse_error/);
});
