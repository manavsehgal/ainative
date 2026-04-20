/**
 * mcp-sync.test.ts — T7 plugin-MCP Codex sync
 *
 * Tests for preparePluginMcpCodexSync:
 *   1. Happy path: accepted stdio registrations produce correct sections
 *   2. Strip disabled: a disabled registration's section is removed
 *   3. Skip ainative-sdk: transport=ainative-sdk emits no section
 *   4. Namespace format: dash separator used (not dot or underscore)
 *   5. Non-plugin entries preserved: existing user entries survive a sync
 *   6. No registrations: empty array leaves config.toml unchanged
 *
 * Uses real fs (tmpdir) — no mocked fs. Pattern matches mcp-loader tests.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { preparePluginMcpCodexSync } from "../mcp-sync";
import type { PluginMcpRegistration } from "@/lib/plugins/mcp-loader";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;
let configPath: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-sync-test-"));
  configPath = path.join(tmpDir, "config.toml");
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeReg(
  overrides: Partial<PluginMcpRegistration> & {
    pluginId: string;
    serverName: string;
  }
): PluginMcpRegistration {
  return {
    transport: "stdio",
    status: "accepted",
    config: {
      command: "/usr/bin/node",
      args: ["server.js"],
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("preparePluginMcpCodexSync", () => {
  it("1. happy path: accepted stdio registrations produce correct sections", () => {
    const regs: PluginMcpRegistration[] = [
      makeReg({
        pluginId: "plugin-a",
        serverName: "server1",
        config: { command: "/usr/bin/node", args: ["a.js", "--port", "3001"] },
      }),
      makeReg({
        pluginId: "plugin-b",
        serverName: "server2",
        config: { command: "/usr/bin/python3", args: ["b.py"] },
      }),
    ];

    const op = preparePluginMcpCodexSync(regs, configPath);
    expect(op.targetPath).toBe(configPath);
    expect(op.content).toContain("[mcp_servers.plugin-a-server1]");
    expect(op.content).toContain('command = "/usr/bin/node"');
    expect(op.content).toContain('"a.js", "--port", "3001"');
    expect(op.content).toContain("[mcp_servers.plugin-b-server2]");
    expect(op.content).toContain('command = "/usr/bin/python3"');
  });

  it("2. strip disabled: disabled registration's section is removed from existing config", () => {
    // Seed config.toml with a plugin section that will be disabled.
    const seed = `
[mcp_servers.plugin-x-srv]
command = "/old/cmd"

[mcp_servers.user-external]
command = "/usr/bin/ext"
`.trimStart();
    fs.writeFileSync(configPath, seed, "utf8");

    const regs: PluginMcpRegistration[] = [
      makeReg({
        pluginId: "plugin-x",
        serverName: "srv",
        status: "disabled",
        disabledReason: "capability_not_accepted",
      }),
    ];

    const op = preparePluginMcpCodexSync(regs, configPath);
    expect(op.content).not.toContain("[mcp_servers.plugin-x-srv]");
    expect(op.content).not.toContain("/old/cmd");
    // Non-plugin entry must survive.
    expect(op.content).toContain("[mcp_servers.user-external]");
  });

  it("3. skip ainative-sdk transport: no section emitted", () => {
    const regs: PluginMcpRegistration[] = [
      makeReg({
        pluginId: "plugin-sdk",
        serverName: "myserver",
        transport: "ainative-sdk",
        config: { transport: "ainative-sdk", entry: "/abs/path/server.js" },
      }),
    ];

    const op = preparePluginMcpCodexSync(regs, configPath);
    expect(op.content).not.toContain("[mcp_servers.plugin-sdk-myserver]");
    expect(op.content).not.toContain("ainative-sdk");
  });

  it("4. namespace format: dash separator used (not dot or underscore)", () => {
    const regs: PluginMcpRegistration[] = [
      makeReg({ pluginId: "myplugin", serverName: "myserver" }),
    ];

    const op = preparePluginMcpCodexSync(regs, configPath);
    expect(op.content).toContain("[mcp_servers.myplugin-myserver]");
    expect(op.content).not.toContain("[mcp_servers.myplugin.myserver]");
    expect(op.content).not.toContain("[mcp_servers.myplugin_myserver]");
  });

  it("5. non-plugin entries preserved: user-external section survives sync", () => {
    const seed = `[profile]
name = "test"

[mcp_servers.user-github]
command = "/usr/bin/gh-mcp"
args = ["serve"]
`.trimStart();
    fs.writeFileSync(configPath, seed, "utf8");

    const regs: PluginMcpRegistration[] = [
      makeReg({ pluginId: "plugin-c", serverName: "srv" }),
    ];

    const op = preparePluginMcpCodexSync(regs, configPath);
    expect(op.content).toContain("[profile]");
    expect(op.content).toContain("[mcp_servers.user-github]");
    expect(op.content).toContain("/usr/bin/gh-mcp");
    expect(op.content).toContain("[mcp_servers.plugin-c-srv]");
  });

  it("6. no registrations: existing config.toml content is unchanged", () => {
    const seed = `[mcp_servers.user-existing]
command = "/usr/bin/existing"
`.trimStart();
    fs.writeFileSync(configPath, seed, "utf8");

    const op = preparePluginMcpCodexSync([], configPath);
    // Content should be effectively the same as seed (modulo trailing newline).
    expect(op.content.trim()).toBe(seed.trim());
  });

  it("7. env block: accepted registration with env produces [mcp_servers.<key>.env] section", () => {
    const regs: PluginMcpRegistration[] = [
      makeReg({
        pluginId: "plugin-env",
        serverName: "envsrv",
        config: {
          command: "/usr/bin/node",
          args: ["srv.js"],
          env: { FOO: "bar", BAZ: "qux" },
        },
      }),
    ];

    const op = preparePluginMcpCodexSync(regs, configPath);
    expect(op.content).toContain("[mcp_servers.plugin-env-envsrv]");
    expect(op.content).toContain("[mcp_servers.plugin-env-envsrv.env]");
    expect(op.content).toContain('FOO = "bar"');
    expect(op.content).toContain('BAZ = "qux"');
  });

  it("8. five-source conceptual check: existing non-plugin sections coexist with plugin sections", () => {
    // Simulate config.toml that already has profile, browser, external sections.
    const seed = `[profile]
name = "default"

[mcp_servers.ainative]
command = "/usr/bin/ainative"

[mcp_servers.ext-tool]
command = "/usr/bin/ext"
`.trimStart();
    fs.writeFileSync(configPath, seed, "utf8");

    const regs: PluginMcpRegistration[] = [
      makeReg({ pluginId: "myplugin", serverName: "srv" }),
    ];

    const op = preparePluginMcpCodexSync(regs, configPath);
    // Profile preserved
    expect(op.content).toContain("[profile]");
    // Ainative entry preserved
    expect(op.content).toContain("[mcp_servers.ainative]");
    // External entry preserved
    expect(op.content).toContain("[mcp_servers.ext-tool]");
    // Plugin entry added
    expect(op.content).toContain("[mcp_servers.myplugin-srv]");
  });
});
