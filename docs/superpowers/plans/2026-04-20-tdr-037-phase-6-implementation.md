# TDR-037 Phase 6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 6 of TDR-037's scope revision — a `create_plugin_spec` chat tool that scaffolds Kind 1 MCP plugins onto the self-extension trust path, a companion skill fall-through in `ainative-app`, and an `ExtensionFallbackCard` chat component (renderable-only in v1; planner wiring is Phase 6.5).

**Architecture:** Additive on top of Phase 4's two-path trust classifier. One new chat-tool module (`plugin-spec-tools.ts`) writes scaffolds atomically to `~/.ainative/plugins/<id>/` with `author: "ainative"` AND `origin: "ainative-internal"` baked in — belt-and-suspenders that trigger `classifyPluginTrust()` signals 1 + 2 simultaneously. One new React component renders a two-path fallback card in the chat transcript. No changes to Phase 4 trust machinery; no changes to the runtime catalog chain.

**Tech Stack:** TypeScript, Next.js 16, React 19, Zod, Vitest, Testing Library, node:fs/path, already-installed `js-yaml`, lucide-react icons, shadcn/ui primitives, Tailwind v4 + Calm Ops design tokens.

---

## File structure

### Create

| Path | Responsibility |
|---|---|
| `src/lib/chat/tools/plugin-spec-tools.ts` | Single-file tool module: error classes, id validator, 4 template renderers, atomic scaffold writer (`scaffoldPluginSpec`), chat tool factory (`pluginSpecTools`). ~350 LOC. |
| `src/lib/chat/tools/__tests__/plugin-spec-tools.test.ts` | Vitest suite covering writer happy-path, atomicity, collision, invalid id, reserved id, node+inprocess TODO stub, classifier integration (scaffold → classify → "self"), chat tool ok/error wrapping. ~200 LOC. |
| `src/components/chat/extension-fallback-card.tsx` | React client component with 3 states (prompt / scaffolded / failed). Calm Ops surface. ~160 LOC. |
| `src/components/chat/__tests__/extension-fallback-card.test.tsx` | Testing Library suite covering render, click handlers, state transitions, retry. ~90 LOC. |

### Modify

| Path | Change |
|---|---|
| `src/lib/chat/ainative-tools.ts` | +1 import, +1 spread in `collectAllTools`. Chat tool count 91 → 92. |
| `.claude/skills/ainative-app/SKILL.md` | Add Phase 2 + Phase 4 fall-through callouts describing dual-target emit (plugins dir + apps manifest) when composition can't express user's ask. |
| `features/changelog.md` | Add `### Shipped — Phase 6` H3 under existing `## 2026-04-20` H2. |

### No changes

- `src/lib/plugins/classify-trust.ts` — consumed as-is by the integration test.
- `src/lib/plugins/sdk/types.ts` — `author` and `origin` fields already optional per TDR-037.
- Phase 4 trust machinery (`capability-check.ts`, `tool-permissions.ts`, `confinement/*`).
- `src/lib/utils/ainative-paths.ts` — `getAinativePluginsDir()` already exists at line 61.

---

## Task 1: Write failing tests for `plugin-spec-tools`

**Files:**
- Create: `src/lib/chat/tools/__tests__/plugin-spec-tools.test.ts`

- [ ] **Step 1: Create the test file with the full suite**

Write the complete test file below. All tests will initially fail (missing module).

```typescript
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as yaml from "js-yaml";

describe("plugin-spec-tools — scaffoldPluginSpec + create_plugin_spec chat tool", () => {
  let tmpDataDir: string;
  let originalDataDir: string | undefined;

  beforeEach(() => {
    originalDataDir = process.env.AINATIVE_DATA_DIR;
    tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ainative-plugin-spec-test-"));
    process.env.AINATIVE_DATA_DIR = tmpDataDir;
    fs.mkdirSync(path.join(tmpDataDir, "plugins"), { recursive: true });
  });

  afterEach(() => {
    if (originalDataDir === undefined) delete process.env.AINATIVE_DATA_DIR;
    else process.env.AINATIVE_DATA_DIR = originalDataDir;
    fs.rmSync(tmpDataDir, { recursive: true, force: true });
  });

  const validInput = {
    id: "github-mine",
    name: "GitHub Mine",
    description: "Pulls GitHub issues assigned to me.",
    capabilities: [] as string[],
    transport: "stdio" as const,
    language: "python" as const,
    tools: [
      { name: "list_my_issues", description: "List my assigned GitHub issues." },
    ],
  };

  it("scaffolds all 4 files at ~/.ainative/plugins/<id>/", async () => {
    const { scaffoldPluginSpec } = await import("@/lib/chat/tools/plugin-spec-tools");
    const result = scaffoldPluginSpec(validInput);
    expect(result.ok).toBe(true);
    expect(result.id).toBe("github-mine");
    expect(result.pluginDir).toBe(path.join(tmpDataDir, "plugins", "github-mine"));
    expect(fs.existsSync(path.join(result.pluginDir, "plugin.yaml"))).toBe(true);
    expect(fs.existsSync(path.join(result.pluginDir, ".mcp.json"))).toBe(true);
    expect(fs.existsSync(path.join(result.pluginDir, "server.py"))).toBe(true);
    expect(fs.existsSync(path.join(result.pluginDir, "README.md"))).toBe(true);
    expect(result.tools).toEqual(["list_my_issues"]);
    expect(result.message).toContain("Reload");
  });

  it("writes plugin.yaml with author: ainative AND origin: ainative-internal (belt-and-suspenders)", async () => {
    const { scaffoldPluginSpec } = await import("@/lib/chat/tools/plugin-spec-tools");
    const result = scaffoldPluginSpec(validInput);
    const yamlText = fs.readFileSync(result.files.pluginYaml, "utf-8");
    expect(yamlText).toMatch(/^author: ainative$/m);
    expect(yamlText).toMatch(/^origin: ainative-internal$/m);
    expect(yamlText).toContain("id: github-mine");
    expect(yamlText).toContain('apiVersion: "0.14"');
    expect(yamlText).toContain("kind: chat-tools");
  });

  it("writes .mcp.json with stdio+python config referencing ${PLUGIN_DIR}/server.py", async () => {
    const { scaffoldPluginSpec } = await import("@/lib/chat/tools/plugin-spec-tools");
    const result = scaffoldPluginSpec(validInput);
    const mcp = JSON.parse(fs.readFileSync(result.files.mcpJson, "utf-8"));
    expect(mcp.mcpServers["github-mine"].command).toBe("python3");
    expect(mcp.mcpServers["github-mine"].args).toEqual(["${PLUGIN_DIR}/server.py"]);
    expect(mcp.mcpServers["github-mine"].transport).toBe("stdio");
  });

  it("writes server.py with a handler stub per declared tool", async () => {
    const { scaffoldPluginSpec } = await import("@/lib/chat/tools/plugin-spec-tools");
    const result = scaffoldPluginSpec({
      ...validInput,
      tools: [
        { name: "list_my_issues", description: "List my issues." },
        { name: "close_issue", description: "Close a single issue." },
      ],
    });
    const server = fs.readFileSync(result.files.serverPy, "utf-8");
    expect(server).toContain('"name": "list_my_issues"');
    expect(server).toContain('"name": "close_issue"');
    expect(server).toContain("_TOOL_NAMES");
    expect(server).toContain("#!/usr/bin/env python3");
    expect(server).toContain("PROTOCOL_VERSION");
    expect(server).toMatch(/^import json$/m);
    expect(server).toMatch(/^import sys$/m);
  });

  it("writes README.md referencing the echo-server reference and origin contract", async () => {
    const { scaffoldPluginSpec } = await import("@/lib/chat/tools/plugin-spec-tools");
    const result = scaffoldPluginSpec(validInput);
    const readme = fs.readFileSync(result.files.readme, "utf-8");
    expect(readme).toContain("echo-server");
    expect(readme).toContain("origin: ainative-internal");
    expect(readme.length).toBeGreaterThan(100);
  });

  it("refuses to overwrite existing plugin dir", async () => {
    const { scaffoldPluginSpec, PluginSpecAlreadyExistsError } = await import(
      "@/lib/chat/tools/plugin-spec-tools"
    );
    fs.mkdirSync(path.join(tmpDataDir, "plugins", "github-mine"));
    expect(() => scaffoldPluginSpec(validInput)).toThrow(PluginSpecAlreadyExistsError);
  });

  it("rejects invalid id (uppercase)", async () => {
    const { scaffoldPluginSpec, PluginSpecInvalidIdError } = await import(
      "@/lib/chat/tools/plugin-spec-tools"
    );
    expect(() => scaffoldPluginSpec({ ...validInput, id: "GitHubMine" })).toThrow(
      PluginSpecInvalidIdError
    );
  });

  it("rejects invalid id (leading digit)", async () => {
    const { scaffoldPluginSpec, PluginSpecInvalidIdError } = await import(
      "@/lib/chat/tools/plugin-spec-tools"
    );
    expect(() => scaffoldPluginSpec({ ...validInput, id: "1github" })).toThrow(
      PluginSpecInvalidIdError
    );
  });

  it("rejects reserved id 'echo-server'", async () => {
    const { scaffoldPluginSpec, PluginSpecInvalidIdError } = await import(
      "@/lib/chat/tools/plugin-spec-tools"
    );
    expect(() => scaffoldPluginSpec({ ...validInput, id: "echo-server" })).toThrow(
      PluginSpecInvalidIdError
    );
  });

  it("writes TODO-stub for node+inprocess (v1 doesn't scaffold real bodies)", async () => {
    const { scaffoldPluginSpec } = await import("@/lib/chat/tools/plugin-spec-tools");
    const result = scaffoldPluginSpec({
      ...validInput,
      language: "node",
      transport: "inprocess",
    });
    const server = fs.readFileSync(result.files.serverPy, "utf-8");
    expect(server).toContain("TODO");
    expect(server).toContain("Phase 6.5");
    const mcp = JSON.parse(fs.readFileSync(result.files.mcpJson, "utf-8"));
    expect(mcp.mcpServers[validInput.id]._todo).toContain("Phase 6.5");
  });

  it("integrates with TDR-037 classifier — scaffolded plugin routes to 'self'", async () => {
    const { scaffoldPluginSpec } = await import("@/lib/chat/tools/plugin-spec-tools");
    const { classifyPluginTrust } = await import("@/lib/plugins/classify-trust");
    const result = scaffoldPluginSpec(validInput);
    const manifestText = fs.readFileSync(result.files.pluginYaml, "utf-8");
    const manifest = yaml.load(manifestText) as Record<string, unknown>;
    // Pass a userIdentity that does NOT match to force reliance on origin/author signals
    const trust = classifyPluginTrust(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      manifest as any,
      result.pluginDir,
      {
        userIdentity: "someone-else-entirely",
        appsBaseDir: path.join(tmpDataDir, "apps"),
      }
    );
    expect(trust).toBe("self");
  });

  it("cleans up temp dir when a write fails mid-scaffold", async () => {
    const { scaffoldPluginSpec } = await import("@/lib/chat/tools/plugin-spec-tools");
    // Force mkdirSync failure by pointing plugins dir at a file (not a dir)
    fs.rmSync(path.join(tmpDataDir, "plugins"), { recursive: true });
    fs.writeFileSync(path.join(tmpDataDir, "plugins"), "I am a file, not a dir");
    expect(() => scaffoldPluginSpec(validInput)).toThrow();
    // No partial <id> dir left behind
    expect(fs.existsSync(path.join(tmpDataDir, "plugins", "github-mine"))).toBe(false);
  });

  it("is exposed as 'create_plugin_spec' chat tool and returns ok on happy path", async () => {
    const { pluginSpecTools } = await import("@/lib/chat/tools/plugin-spec-tools");
    const tools = pluginSpecTools({});
    expect(tools).toHaveLength(1);
    const tool = tools[0];
    expect(tool.name).toBe("create_plugin_spec");
    const result = await tool.handler(validInput);
    const text = result.content[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.ok).toBe(true);
    expect(parsed.id).toBe("github-mine");
    expect(parsed.tools).toEqual(["list_my_issues"]);
  });

  it("chat tool returns isError: true with named error when id is invalid", async () => {
    const { pluginSpecTools } = await import("@/lib/chat/tools/plugin-spec-tools");
    const tool = pluginSpecTools({})[0];
    const result = await tool.handler({ ...validInput, id: "BadId" });
    expect((result as { isError?: boolean }).isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toContain("PluginSpecInvalidIdError");
  });
});
```

- [ ] **Step 2: Run the tests — verify they all fail**

Run: `npx vitest run src/lib/chat/tools/__tests__/plugin-spec-tools.test.ts`

Expected: all 13 tests fail with `Cannot find module '@/lib/chat/tools/plugin-spec-tools'`.

---

## Task 2: Implement `plugin-spec-tools.ts`

**Files:**
- Create: `src/lib/chat/tools/plugin-spec-tools.ts`

- [ ] **Step 1: Write the full module**

```typescript
/**
 * plugin-spec-tools.ts — create_plugin_spec chat tool.
 *
 * Scaffolds a Kind 1 MCP plugin under ~/.ainative/plugins/<id>/ with
 * self-extension metadata baked in (author: "ainative" + origin:
 * "ainative-internal"). Per TDR-037 these two fields route the
 * scaffolded plugin onto the self-extension trust path via classifier
 * signals 1 + 2 (belt-and-suspenders — either alone suffices, both
 * survive future refactors).
 *
 * v1 scaffolds Python + stdio bodies only. language: "node" or
 * transport: "inprocess" writes TODO-stub files; Phase 6.5 fills in
 * the Node / inprocess template bodies.
 *
 * NOT runtime-registry adjacent: no imports from @/lib/plugins/* at
 * module scope. Static imports only touch node builtins and the
 * utility helper getAinativePluginsDir(). CLAUDE.md smoke-test budget
 * does not apply to this module.
 */

import { defineTool } from "../tool-registry";
import { z } from "zod";
import { ok, err, type ToolContext } from "./helpers";
import * as fs from "node:fs";
import * as path from "node:path";
import { getAinativePluginsDir } from "@/lib/utils/ainative-paths";

// ── Errors (every error has a name per CLAUDE.md principle #2) ──────

export class PluginSpecAlreadyExistsError extends Error {
  override name = "PluginSpecAlreadyExistsError" as const;
  constructor(public readonly pluginDir: string) {
    super(
      `Plugin already exists at ${pluginDir}. Delete the directory or choose a different id.`
    );
  }
}

export class PluginSpecInvalidIdError extends Error {
  override name = "PluginSpecInvalidIdError" as const;
  constructor(
    public readonly id: string,
    public readonly reason: string
  ) {
    super(
      `Invalid plugin id "${id}": ${reason}. Ids must be kebab-case slugs (e.g. "github-mine") matching /^[a-z][a-z0-9-]*[a-z0-9]$/ and must not collide with reserved ids.`
    );
  }
}

export class PluginSpecWriteError extends Error {
  override name = "PluginSpecWriteError" as const;
  constructor(
    public readonly targetPath: string,
    public readonly cause: unknown
  ) {
    super(
      `Failed to write plugin scaffold to ${targetPath}: ${
        cause instanceof Error ? cause.message : String(cause)
      }`
    );
  }
}

// ── Id validation ────────────────────────────────────────────────────

const ID_PATTERN = /^[a-z][a-z0-9-]*[a-z0-9]$/;
const RESERVED_IDS = new Set(["echo-server"]);

function validateId(id: string): void {
  if (id.length < 2) {
    throw new PluginSpecInvalidIdError(id, "must be at least 2 chars");
  }
  if (!ID_PATTERN.test(id)) {
    throw new PluginSpecInvalidIdError(
      id,
      "must match /^[a-z][a-z0-9-]*[a-z0-9]$/ (start lowercase, end lowercase/digit, kebab-case only)"
    );
  }
  if (RESERVED_IDS.has(id)) {
    throw new PluginSpecInvalidIdError(id, "id is reserved");
  }
}

// ── Types ────────────────────────────────────────────────────────────

export interface ToolStub {
  name: string;
  description: string;
  inputSchema?: unknown;
}

export interface CreatePluginSpecInput {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  transport: "stdio" | "inprocess";
  language: "python" | "node";
  tools: ToolStub[];
}

export interface CreatePluginSpecResult {
  ok: true;
  id: string;
  pluginDir: string;
  files: {
    pluginYaml: string;
    mcpJson: string;
    serverPy: string;
    readme: string;
  };
  tools: string[];
  message: string;
}

// ── Templates (pure functions, no I/O) ───────────────────────────────

function renderPluginYaml(input: {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  tools: ToolStub[];
}): string {
  const capLines = input.capabilities.length
    ? input.capabilities.map((c) => `  - ${c}`).join("\n")
    : "";
  const toolLines = input.tools
    .map(
      (t) =>
        `  - name: ${t.name}\n    description: ${JSON.stringify(t.description)}`
    )
    .join("\n");

  return [
    `# ainative Kind 1 MCP plugin — self-extension scaffold`,
    `# DO NOT REMOVE 'origin: ainative-internal' — this is the TDR-037 self-extension contract.`,
    `# Stripping it flips this plugin to the third-party trust path, which will prompt capability-accept on load.`,
    ``,
    `id: ${input.id}`,
    `version: 0.1.0`,
    `apiVersion: "0.14"`,
    `kind: chat-tools`,
    `name: ${JSON.stringify(input.name)}`,
    `description: ${JSON.stringify(input.description)}`,
    `author: ainative`,
    `origin: ainative-internal`,
    input.capabilities.length
      ? `capabilities:\n${capLines}`
      : `capabilities: []`,
    input.tools.length ? `tools:\n${toolLines}` : `tools: []`,
    ``,
  ].join("\n");
}

function renderMcpJson(input: {
  id: string;
  transport: "stdio" | "inprocess";
  language: "python" | "node";
}): string {
  if (input.transport === "stdio" && input.language === "python") {
    return (
      JSON.stringify(
        {
          mcpServers: {
            [input.id]: {
              command: "python3",
              args: ["${PLUGIN_DIR}/server.py"],
              transport: "stdio",
            },
          },
        },
        null,
        2
      ) + "\n"
    );
  }
  // Stub for node/inprocess — Phase 6.5 will fill in.
  return (
    JSON.stringify(
      {
        mcpServers: {
          [input.id]: {
            _todo: `Phase 6 v1 only scaffolds python+stdio. Fill in ${input.language}+${input.transport} config manually or wait for Phase 6.5.`,
          },
        },
      },
      null,
      2
    ) + "\n"
  );
}

function renderServerPy(input: {
  id: string;
  tools: ToolStub[];
  language: "python" | "node";
  transport: "stdio" | "inprocess";
}): string {
  if (input.language !== "python" || input.transport !== "stdio") {
    return [
      `# TODO: Phase 6 v1 only scaffolds python+stdio.`,
      `# Fill in ${input.language}+${input.transport} server manually or wait for Phase 6.5.`,
      `# Reference: src/lib/plugins/examples/echo-server/server.py`,
      ``,
    ].join("\n");
  }

  const toolListEntries = input.tools
    .map(
      (t) => `        {
            "name": ${JSON.stringify(t.name)},
            "description": ${JSON.stringify(t.description)},
            "inputSchema": ${JSON.stringify(
              t.inputSchema ?? {
                type: "object",
                properties: {},
                required: [],
              }
            )},
        },`
    )
    .join("\n");

  const toolNameSet = input.tools
    .map((t) => JSON.stringify(t.name))
    .join(", ");

  return `#!/usr/bin/env python3
"""
${input.id} — Kind 1 MCP stdio plugin scaffolded by create_plugin_spec.

Self-extension scaffold: author: ainative, origin: ainative-internal
(see plugin.yaml). TDR-037 classifier routes this to the self-extension
path — no capability-accept ceremony on load.

Each handler below is a TODO stub. Fill in real logic; see
src/lib/plugins/examples/echo-server/server.py for the reference shape.
"""
import json
import sys


PROTOCOL_VERSION = "2024-11-05"
SERVER_NAME = ${JSON.stringify(input.id)}
SERVER_VERSION = "0.1.0"
_TOOL_NAMES = { ${toolNameSet} }


def _reply(obj):
    sys.stdout.write(json.dumps(obj) + "\\n")
    sys.stdout.flush()


def _handle_initialize(request):
    return {
        "jsonrpc": "2.0",
        "id": request.get("id"),
        "result": {
            "protocolVersion": PROTOCOL_VERSION,
            "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION},
            "capabilities": {"tools": {}},
        },
    }


def _handle_tools_list(request):
    return {
        "jsonrpc": "2.0",
        "id": request.get("id"),
        "result": {"tools": [
${toolListEntries}
        ]},
    }


def _handle_tools_call(request):
    params = request.get("params") or {}
    name = params.get("name")
    arguments = params.get("arguments") or {}

    if name not in _TOOL_NAMES:
        return {
            "jsonrpc": "2.0",
            "id": request.get("id"),
            "error": {"code": -32601, "message": f"Unknown tool: {name}"},
        }

    # TODO: implement per-tool logic. Dispatch on 'name' to separate handlers.
    # Echo-server reference: src/lib/plugins/examples/echo-server/server.py:_handle_tools_call
    return {
        "jsonrpc": "2.0",
        "id": request.get("id"),
        "result": {
            "content": [
                {"type": "text", "text": json.dumps({
                    "stub_for": name,
                    "args": arguments,
                })}
            ]
        },
    }


HANDLERS = {
    "initialize": _handle_initialize,
    "tools/list": _handle_tools_list,
    "tools/call": _handle_tools_call,
}


def main():
    for raw in sys.stdin:
        line = raw.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
        except json.JSONDecodeError:
            continue

        method = request.get("method")
        if "id" not in request:
            continue

        handler = HANDLERS.get(method)
        if handler is None:
            _reply({
                "jsonrpc": "2.0",
                "id": request.get("id"),
                "error": {"code": -32601, "message": f"Method not found: {method}"},
            })
            continue
        _reply(handler(request))


if __name__ == "__main__":
    main()
`;
}

function renderReadme(input: {
  id: string;
  name: string;
  description: string;
}): string {
  return `# ${input.name}

${input.description}

## What this is

A Kind 1 MCP plugin scaffolded by ainative's \`create_plugin_spec\` chat tool.
Lives under \`~/.ainative/plugins/${input.id}/\`.

## Self-extension contract (TDR-037)

The \`plugin.yaml\` has:

\`\`\`yaml
author: ainative
origin: ainative-internal
\`\`\`

These two fields route this plugin onto ainative's **self-extension trust path**:

- No capability-accept prompt on load.
- No \`plugins.lock\` entry.
- No confinement wrap (unless \`AINATIVE_PLUGIN_CONFINEMENT=1\` is set).

**Do not remove either field.** Stripping them flips this plugin to the third-party
path, which prompts for capability accept on every load.

## Editing

Edit \`server.py\` to implement your tool logic. Each tool declared in
\`plugin.yaml\` has a stub handler in \`_handle_tools_call\` — dispatch on the
tool name and return a proper MCP result.

Reference implementation: \`src/lib/plugins/examples/echo-server/server.py\`
in the ainative repo.

## Running

Reload ainative to register the plugin (restart \`npm run dev\`, or invoke the
\`reload_plugin\` chat tool if accepting the plugin id). Tools appear in chat
as \`mcp__${input.id}__<tool-name>\`.

## Debugging

- Check \`/api/plugins\` to confirm the plugin shows \`status: "loaded"\`.
- Check the dev log for Python import errors if tools don't appear.
- Test \`server.py\` manually:
  \`\`\`
  echo '{"jsonrpc":"2.0","id":1,"method":"initialize"}' | python3 server.py
  \`\`\`
`;
}

// ── Scaffold writer (atomic via temp-dir + rename) ───────────────────

export function scaffoldPluginSpec(
  input: CreatePluginSpecInput
): CreatePluginSpecResult {
  validateId(input.id);

  const pluginsDir = getAinativePluginsDir();
  const pluginDir = path.join(pluginsDir, input.id);
  const tmpDir = path.join(pluginsDir, `${input.id}.tmp-${Date.now()}`);

  if (fs.existsSync(pluginDir)) {
    throw new PluginSpecAlreadyExistsError(pluginDir);
  }

  try {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "plugin.yaml"),
      renderPluginYaml(input),
      "utf-8"
    );
    fs.writeFileSync(
      path.join(tmpDir, ".mcp.json"),
      renderMcpJson({
        id: input.id,
        transport: input.transport,
        language: input.language,
      }),
      "utf-8"
    );
    fs.writeFileSync(
      path.join(tmpDir, "server.py"),
      renderServerPy({
        id: input.id,
        tools: input.tools,
        language: input.language,
        transport: input.transport,
      }),
      "utf-8"
    );
    fs.writeFileSync(
      path.join(tmpDir, "README.md"),
      renderReadme({
        id: input.id,
        name: input.name,
        description: input.description,
      }),
      "utf-8"
    );

    fs.renameSync(tmpDir, pluginDir);
  } catch (cause) {
    try {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    } catch {
      // best-effort cleanup
    }
    throw new PluginSpecWriteError(pluginDir, cause);
  }

  return {
    ok: true,
    id: input.id,
    pluginDir,
    files: {
      pluginYaml: path.join(pluginDir, "plugin.yaml"),
      mcpJson: path.join(pluginDir, ".mcp.json"),
      serverPy: path.join(pluginDir, "server.py"),
      readme: path.join(pluginDir, "README.md"),
    },
    tools: input.tools.map((t) => t.name),
    message: `Scaffolded ${input.id}. Reload ainative to register.`,
  };
}

// ── Chat tool factory ────────────────────────────────────────────────

const ToolStubSchema = z.object({
  name: z
    .string()
    .regex(/^[a-z][a-z0-9_]*$/)
    .describe(
      "Tool name — snake_case only, must start with a lowercase letter."
    ),
  description: z.string().min(1).describe("One-sentence tool description."),
  inputSchema: z
    .unknown()
    .optional()
    .describe(
      "JSON Schema for the tool's arguments (object schema). Optional — defaults to an empty object schema."
    ),
});

export function pluginSpecTools(ctx: ToolContext) {
  return [
    defineTool(
      "create_plugin_spec",
      "Scaffold a Kind 1 MCP plugin under ~/.ainative/plugins/<id>/ with self-extension metadata baked in (author: 'ainative' + origin: 'ainative-internal'). The scaffold is immediately runnable — each declared tool gets a stub handler. Reload ainative to register. v1 supports language: 'python' + transport: 'stdio' only; 'node' or 'inprocess' writes a TODO-stub for Phase 6.5. Refuses to overwrite existing plugin directories.",
      {
        id: z
          .string()
          .regex(/^[a-z][a-z0-9-]*[a-z0-9]$/)
          .describe(
            "Plugin id — kebab-case slug (e.g. 'github-mine'), at least 2 chars, lowercase-only."
          ),
        name: z.string().min(1).describe("Human-readable plugin name."),
        description: z
          .string()
          .min(1)
          .describe("One-sentence plugin description."),
        capabilities: z
          .array(z.string())
          .default([])
          .describe(
            "Declared capability strings (may be empty). Empty caps classify as self-extension regardless of author/origin."
          ),
        transport: z
          .enum(["stdio", "inprocess"])
          .default("stdio")
          .describe(
            "MCP transport. v1 scaffolds real code only for 'stdio'; 'inprocess' writes a TODO-stub."
          ),
        language: z
          .enum(["python", "node"])
          .default("python")
          .describe(
            "Server language. v1 scaffolds real code only for 'python'; 'node' writes a TODO-stub."
          ),
        tools: z
          .array(ToolStubSchema)
          .min(1)
          .describe(
            "List of tool stubs to seed. Each gets a handler dispatch entry in server.py."
          ),
      },
      async (args) => {
        try {
          const result = scaffoldPluginSpec({
            id: args.id,
            name: args.name,
            description: args.description,
            capabilities: args.capabilities,
            transport: args.transport,
            language: args.language,
            tools: args.tools,
          });
          ctx.onToolResult?.("create_plugin_spec", {
            id: result.id,
            pluginDir: result.pluginDir,
            tools: result.tools,
          });
          return ok(result);
        } catch (e) {
          if (
            e instanceof PluginSpecAlreadyExistsError ||
            e instanceof PluginSpecInvalidIdError ||
            e instanceof PluginSpecWriteError
          ) {
            return err(`${e.name}: ${e.message}`);
          }
          return err(
            e instanceof Error ? e.message : "Failed to scaffold plugin spec"
          );
        }
      }
    ),
  ];
}
```

- [ ] **Step 2: Run the tests — verify all pass**

Run: `npx vitest run src/lib/chat/tools/__tests__/plugin-spec-tools.test.ts`

Expected: all 13 tests pass.

---

## Task 3: Register `pluginSpecTools` in the chat tool aggregator

**Files:**
- Modify: `src/lib/chat/ainative-tools.ts` (add import + spread in `collectAllTools`)

- [ ] **Step 1: Add the import alongside existing tool imports**

Add this line after the existing `import { scheduleSpecTools } from "./tools/schedule-spec-tools";`:

```typescript
import { pluginSpecTools } from "./tools/plugin-spec-tools";
```

- [ ] **Step 2: Spread `pluginSpecTools(ctx)` into `collectAllTools`**

In `collectAllTools`, immediately after `...pluginTools(ctx),`, add:

```typescript
    ...pluginSpecTools(ctx),
```

This keeps Kind 1 plugin tools grouped (list/reload/grant/revoke + create_plugin_spec together).

- [ ] **Step 3: Verify typecheck clean**

Run: `npx tsc --noEmit`

Expected: no new errors.

- [ ] **Step 4: Re-run the chat-tools test to confirm no regression**

Run: `npx vitest run src/lib/chat/`

Expected: existing chat tests remain green + new plugin-spec-tools tests green.

---

## Task 4: Write failing tests for `ExtensionFallbackCard`

**Files:**
- Create: `src/components/chat/__tests__/extension-fallback-card.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ExtensionFallbackCard } from "@/components/chat/extension-fallback-card";

const baseProps = {
  explanation:
    "Needs external HTTP access, which composition can't express.",
  composeAltPrompt:
    "Build a weekly reading list that tracks books I'm reading",
  pluginSlug: "github-mine",
  pluginInputs: {
    id: "github-mine",
    name: "GitHub Mine",
    description: "Pulls GitHub issues assigned to me.",
    capabilities: [],
    transport: "stdio" as const,
    language: "python" as const,
    tools: [{ name: "list_my_issues", description: "List issues." }],
  },
};

describe("ExtensionFallbackCard", () => {
  it("renders in prompt state with both paths visible", () => {
    render(
      <ExtensionFallbackCard
        {...baseProps}
        onTryAlt={vi.fn()}
        onScaffold={vi.fn()}
      />
    );
    expect(
      screen.getByText(/I can't build this with composition alone/)
    ).toBeInTheDocument();
    expect(screen.getByText(baseProps.composeAltPrompt)).toBeInTheDocument();
    expect(
      screen.getByText(/~\/\.ainative\/plugins\/github-mine\//)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /try this/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /scaffold/i })
    ).toBeInTheDocument();
  });

  it("calls onTryAlt with the compose-alt prompt when 'Try this' is clicked", () => {
    const onTryAlt = vi.fn();
    render(
      <ExtensionFallbackCard
        {...baseProps}
        onTryAlt={onTryAlt}
        onScaffold={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /try this/i }));
    expect(onTryAlt).toHaveBeenCalledWith(baseProps.composeAltPrompt);
  });

  it("calls onScaffold with plugin inputs and transitions to scaffolded state", async () => {
    const onScaffold = vi.fn(async () => ({
      ok: true as const,
      id: "github-mine",
      pluginDir: "/home/u/.ainative/plugins/github-mine",
      tools: ["list_my_issues"],
    }));
    render(
      <ExtensionFallbackCard
        {...baseProps}
        onTryAlt={vi.fn()}
        onScaffold={onScaffold}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /scaffold/i }));
    expect(onScaffold).toHaveBeenCalledWith(baseProps.pluginInputs);
    await waitFor(() =>
      expect(screen.getByText(/Scaffolded/)).toBeInTheDocument()
    );
    expect(screen.getByText(/server\.py/)).toBeInTheDocument();
  });

  it("transitions to failed state on scaffold error and shows retry", async () => {
    const onScaffold = vi.fn(async () => {
      throw new Error("disk full");
    });
    render(
      <ExtensionFallbackCard
        {...baseProps}
        onTryAlt={vi.fn()}
        onScaffold={onScaffold}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /scaffold/i }));
    await waitFor(() =>
      expect(screen.getByText(/Scaffold failed/)).toBeInTheDocument()
    );
    expect(screen.getByText(/disk full/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /retry/i })
    ).toBeInTheDocument();
  });

  it("retry returns to prompt state", async () => {
    const onScaffold = vi.fn(async () => {
      throw new Error("boom");
    });
    render(
      <ExtensionFallbackCard
        {...baseProps}
        onTryAlt={vi.fn()}
        onScaffold={onScaffold}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /scaffold/i }));
    await waitFor(() =>
      screen.getByRole("button", { name: /retry/i })
    );
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(
      screen.getByText(/I can't build this with composition alone/)
    ).toBeInTheDocument();
  });

  it("honors initialState='scaffolded'", () => {
    render(
      <ExtensionFallbackCard
        {...baseProps}
        onTryAlt={vi.fn()}
        onScaffold={vi.fn()}
        initialState="scaffolded"
      />
    );
    expect(screen.getByText(/Scaffolded/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests — verify they fail**

Run: `npx vitest run src/components/chat/__tests__/extension-fallback-card.test.tsx`

Expected: all 6 tests fail with `Cannot find module '@/components/chat/extension-fallback-card'`.

---

## Task 5: Implement `ExtensionFallbackCard`

**Files:**
- Create: `src/components/chat/extension-fallback-card.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useState } from "react";
import { AlertCircle, FolderOpen, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface CreatePluginSpecInputForCard {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  transport: "stdio" | "inprocess";
  language: "python" | "node";
  tools: Array<{ name: string; description: string; inputSchema?: unknown }>;
}

export interface ScaffoldResultForCard {
  ok: true;
  id: string;
  pluginDir: string;
  tools: string[];
}

export interface ExtensionFallbackCardProps {
  explanation: string;
  composeAltPrompt: string;
  pluginSlug: string;
  pluginInputs: CreatePluginSpecInputForCard;
  onTryAlt: (prompt: string) => void;
  onScaffold: (
    inputs: CreatePluginSpecInputForCard
  ) => Promise<ScaffoldResultForCard>;
  initialState?: "prompt" | "scaffolded" | "failed";
  className?: string;
}

type CardState =
  | { kind: "prompt" }
  | { kind: "scaffolded"; pluginDir: string }
  | { kind: "failed"; message: string };

/**
 * Inline chat card rendered when the chat planner determines that
 * composition alone cannot fulfill the user's ask. Two paths only, not
 * three (frontend-designer §3): compose-alt OR scaffold a plugin.
 *
 * Phase 6 v1: renderable-only. Planner wiring — the logic that decides
 * WHEN to emit this card — lands in Phase 6.5, mirroring how
 * app-materialized-card.tsx shipped renderable-first.
 *
 * Scaffolded plugins carry author: "ainative" + origin: "ainative-internal"
 * so classifyPluginTrust() routes them to the self-extension path (no
 * capability-accept ceremony on load).
 */
export function ExtensionFallbackCard({
  explanation,
  composeAltPrompt,
  pluginSlug,
  pluginInputs,
  onTryAlt,
  onScaffold,
  initialState,
  className,
}: ExtensionFallbackCardProps) {
  const [state, setState] = useState<CardState>(() => {
    if (initialState === "scaffolded") {
      return {
        kind: "scaffolded",
        pluginDir: `~/.ainative/plugins/${pluginSlug}/`,
      };
    }
    if (initialState === "failed") {
      return { kind: "failed", message: "Previous scaffold failed." };
    }
    return { kind: "prompt" };
  });
  const [scaffolding, setScaffolding] = useState(false);

  const handleScaffold = async () => {
    if (scaffolding) return;
    setScaffolding(true);
    try {
      const result = await onScaffold(pluginInputs);
      setState({ kind: "scaffolded", pluginDir: result.pluginDir });
    } catch (e) {
      setState({
        kind: "failed",
        message: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setScaffolding(false);
    }
  };

  const handleRetry = () => {
    setState({ kind: "prompt" });
  };

  if (state.kind === "scaffolded") {
    return (
      <div
        className={cn(
          "rounded-xl border bg-card p-4 my-2 flex items-start gap-3",
          className
        )}
        data-slot="extension-fallback-card"
        data-state="scaffolded"
      >
        <Sparkles
          className="h-4 w-4 text-primary shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium">
            Scaffolded{" "}
            <code className="text-xs font-mono">{pluginSlug}</code>.
          </p>
          <p className="text-xs text-muted-foreground">
            Edit{" "}
            <code className="font-mono">{state.pluginDir}server.py</code> to
            fill in logic, then reload ainative.
          </p>
        </div>
      </div>
    );
  }

  if (state.kind === "failed") {
    return (
      <div
        className={cn(
          "rounded-xl border border-destructive/50 bg-card p-4 my-2 flex items-start gap-3",
          className
        )}
        data-slot="extension-fallback-card"
        data-state="failed"
      >
        <AlertCircle
          className="h-4 w-4 text-destructive shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-medium">Scaffold failed.</p>
          <p className="text-xs text-muted-foreground font-mono break-all">
            {state.message}
          </p>
          <Button size="sm" variant="outline" onClick={handleRetry}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // prompt state
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 my-2 space-y-3",
        className
      )}
      data-slot="extension-fallback-card"
      data-state="prompt"
    >
      <div className="flex items-start gap-3">
        <AlertCircle
          className="h-4 w-4 text-amber-600 shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            I can't build this with composition alone
          </p>
          <p className="mt-1 text-xs text-muted-foreground italic">
            &ldquo;{explanation}&rdquo;
          </p>
        </div>
      </div>

      <div className="space-y-2 pl-7">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            Closest compose-only version:
          </p>
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm flex items-start gap-1.5 min-w-0 flex-1">
              <ArrowRight
                className="h-3 w-3 mt-1 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="truncate">{composeAltPrompt}</span>
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onTryAlt(composeAltPrompt)}
            >
              Try this
            </Button>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            Scaffold a plugin for it:
          </p>
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm flex items-start gap-1.5 min-w-0 flex-1">
              <ArrowRight
                className="h-3 w-3 mt-1 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="font-mono text-xs truncate">
                ~/.ainative/plugins/{pluginSlug}/
              </span>
            </p>
            <Button
              size="sm"
              variant="default"
              onClick={handleScaffold}
              disabled={scaffolding}
            >
              <FolderOpen
                className="h-3 w-3 mr-1.5"
                aria-hidden="true"
              />
              {scaffolding ? "Scaffolding…" : "Scaffold + open"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run the tests — verify all pass**

Run: `npx vitest run src/components/chat/__tests__/extension-fallback-card.test.tsx`

Expected: all 6 tests pass.

---

## Task 6: Update `ainative-app` SKILL.md with fall-through

**Files:**
- Modify: `.claude/skills/ainative-app/SKILL.md`

- [ ] **Step 1: Read the current SKILL.md to identify the Phase 2 and Phase 4 anchors**

Run: `cat .claude/skills/ainative-app/SKILL.md | head -80`

Locate the "Phase 2" and "Phase 4" section headings (these came from the Phase 4 manifest-location fix).

- [ ] **Step 2: Add the fall-through callout near the end of Phase 2**

Find the end of the "Phase 2 — Match-or-author primitives" section. Immediately before the next phase heading, append this block (use `Edit` to insert after the last paragraph of Phase 2):

```markdown
### Fall-through: when composition can't express the ask

If any required primitive can't be composed from the existing kit (profiles,
blueprints, tables, schedules), **do not** declare the app incomplete. Instead,
call the `create_plugin_spec` chat tool to scaffold a Kind 1 MCP plugin that
fills the gap, then compose around it.

Examples of asks that need a plugin fall-through:

- External HTTP API reads (GitHub, Linear, Notion) — composition has no
  outbound HTTP primitive.
- Custom file parsers or non-PDF document extractors.
- Domain-specific CLI wrappers (git, kubectl) that aren't in the built-in
  tool set.

When you invoke `create_plugin_spec`, always pass:

- `id`: kebab-case, derived from the app slug with a suffix (e.g. for
  `wealth-tracker`, plugin might be `wealth-tracker-tools`).
- `language: "python"`, `transport: "stdio"` — v1 scaffolds these only;
  node + inprocess writes a TODO stub until Phase 6.5.
- `tools: [...]` — one entry per gap-filling tool; each gets a handler
  stub in `server.py` the user (or a follow-up chat turn) fills in.

The scaffold carries `author: ainative` AND `origin: ainative-internal`,
routing it onto the TDR-037 self-extension trust path — **no
capability-accept prompt, no `plugins.lock` entry**.
```

- [ ] **Step 3: Extend Phase 4 "Emit Artifacts" with dual-target behavior**

Find the Phase 4 section (the one that instructs writing manifests to `~/.ainative/apps/<app-id>/`). Immediately after the existing callout that warns against writing to `.claude/apps/*`, append this block:

```markdown
### Dual-target emit when a plugin is scaffolded

When Phase 2 fall-through invoked `create_plugin_spec`, the app emits **two**
artifact targets:

1. **Plugin dir** — `~/.ainative/plugins/<plugin-id>/{plugin.yaml,.mcp.json,server.py,README.md}`
   (written by `create_plugin_spec`; do not duplicate).

2. **App manifest** — `~/.ainative/apps/<app-id>/manifest.yaml` that *references*
   the plugin id under a `plugins:` key, so the `/apps` registry surfaces the
   composed app (not just the bare plugin).

Example app manifest with a plugin reference:

\`\`\`yaml
id: wealth-tracker
name: Wealth Tracker
description: Weekly portfolio check-in with external API data.
profiles: [wealth-analyst]
blueprints: [weekly-checkin]
tables: [positions, holdings]
schedules: [monday-7am]
plugins:
  - wealth-tracker-tools   # scaffolded by create_plugin_spec
\`\`\`

**Do NOT** collapse plugins and apps into a single directory — `~/.ainative/plugins/`
is for executable code, `~/.ainative/apps/` is for composition manifests.
The `/apps` registry scan only reads from `apps/`.
```

- [ ] **Step 4: Verify SKILL.md still lints as Markdown**

Run: `npx markdownlint-cli2 .claude/skills/ainative-app/SKILL.md 2>&1 | head -20 || true`

Expected: the command runs (may warn, that's fine). No catastrophic syntax errors.

---

## Task 7: Update `features/changelog.md`

**Files:**
- Modify: `features/changelog.md`

- [ ] **Step 1: Locate the existing `## 2026-04-20` H2**

Run: `grep -n "^## 2026-04-20" features/changelog.md`

Expected: one match (created by Phase 4 session).

- [ ] **Step 2: Add a new H3 under the existing H2**

Find the `## 2026-04-20` section. Immediately after the existing H3 sections (the last one in that date's block), append this H3:

```markdown
### Shipped — Phase 6 (`create_plugin_spec` + `ainative-app` fall-through + `ExtensionFallbackCard`)

- **New chat tool `create_plugin_spec`** (`src/lib/chat/tools/plugin-spec-tools.ts`): scaffolds Kind 1 MCP plugins under `~/.ainative/plugins/<id>/` with `author: "ainative"` AND `origin: "ainative-internal"` baked in — belt-and-suspenders (signals 1 + 2 from `classifyPluginTrust`) so future refactors can't accidentally flip the scaffold to the third-party trust path. Chat tool count: 91 → 92. v1 scaffolds Python + stdio bodies; `language: "node"` or `transport: "inprocess"` writes a TODO-stub with a Phase 6.5 pointer. Atomic write via temp-dir + rename; refuses to overwrite existing plugin dirs.
- **`ainative-app` skill fall-through**: Phase 2 now falls through to `create_plugin_spec` when composition can't express the ask; Phase 4 emits dual-target artifacts (plugin dir + `~/.ainative/apps/<app-id>/manifest.yaml` with a `plugins:` reference).
- **`ExtensionFallbackCard`** (`src/components/chat/extension-fallback-card.tsx`): renderable-only chat card with three states (`prompt`, `scaffolded`, `failed`), two paths not three (compose-alt vs. scaffold). Planner wiring deferred to Phase 6.5 per the `app-materialized-card` precedent.
- **Tests**: 13 Vitest cases for `plugin-spec-tools` (scaffold, atomicity, collision, invalid id, reserved id, TODO stub, classifier integration asserting `scaffold → classifyPluginTrust → "self"`, chat tool ok/error wrapping); 6 Testing Library cases for `ExtensionFallbackCard` (render, click handlers, state transitions, retry).
- **No CLAUDE.md smoke-test budget triggered** — verified `plugin-spec-tools.ts` has no static imports transitively reachable from `@/lib/agents/runtime/catalog.ts`.
```

- [ ] **Step 3: Verify the file still parses**

Run: `head -60 features/changelog.md`

Expected: new H3 appears under `## 2026-04-20` block without breaking surrounding structure.

---

## Task 8: Final verification + single commit

**Files:** none modified in this task — verification only.

- [ ] **Step 1: Typecheck clean**

Run: `npx tsc --noEmit 2>&1 | tail -20`

Expected: no errors reference Phase 6 files. (Pre-existing unrelated errors, if any, should match the main baseline.)

- [ ] **Step 2: Run both new test files**

Run: `npx vitest run src/lib/chat/tools/__tests__/plugin-spec-tools.test.ts src/components/chat/__tests__/extension-fallback-card.test.tsx`

Expected: 13 + 6 = 19 tests pass.

- [ ] **Step 3: Run the broader chat-tools suite to catch regressions**

Run: `npx vitest run src/lib/chat/ src/components/chat/`

Expected: all tests green. No chat-tool regressions from the ainative-tools.ts registration change.

- [ ] **Step 4: Grep-verify no runtime-registry reachability**

Run:
```bash
grep -rn "from .@/lib/agents/runtime/catalog" src/lib/chat/tools/plugin-spec-tools.ts src/components/chat/extension-fallback-card.tsx 2>&1 || echo "PASS: no catalog imports"
```

Expected: `PASS: no catalog imports` (the command finds no matches, so grep exit 1 triggers the echo).

- [ ] **Step 5: Grep-verify scaffold contract fields are present**

Run:
```bash
grep -nE "author:\s*ainative|origin:\s*ainative-internal" src/lib/chat/tools/plugin-spec-tools.ts
```

Expected: at least 2 matches per pattern (in `renderPluginYaml` template AND the README template).

- [ ] **Step 6: Stage all Phase 6 changes**

Run:
```bash
git status --short
git add src/lib/chat/tools/plugin-spec-tools.ts \
        src/lib/chat/tools/__tests__/plugin-spec-tools.test.ts \
        src/components/chat/extension-fallback-card.tsx \
        src/components/chat/__tests__/extension-fallback-card.test.tsx \
        src/lib/chat/ainative-tools.ts \
        .claude/skills/ainative-app/SKILL.md \
        features/changelog.md
git status --short
```

Expected: the 7 listed paths appear under "Changes to be committed", nothing else.

- [ ] **Step 7: Create the single Phase 6 commit**

Run:
```bash
git commit -m "$(cat <<'EOF'
feat(plugins): TDR-037 Phase 6 — create_plugin_spec + ainative-app fall-through + ExtensionFallbackCard

Additive on Phase 4's self-extension trust path. Three deliverables in one
atomic commit per design spec §Acceptance:

1. create_plugin_spec chat tool (src/lib/chat/tools/plugin-spec-tools.ts):
   scaffolds Kind 1 MCP plugins under ~/.ainative/plugins/<id>/ with
   author: "ainative" AND origin: "ainative-internal" baked in —
   belt-and-suspenders across classifyPluginTrust signals 1 + 2. v1 emits
   Python + stdio bodies; node/inprocess combinations get TODO-stubs pointing
   to Phase 6.5. Atomic write via temp-dir + rename. Refuses to overwrite
   existing plugin dirs. Chat tool count: 91 → 92.

2. ainative-app skill fall-through (.claude/skills/ainative-app/SKILL.md):
   Phase 2 now falls through to create_plugin_spec when composition can't
   express the user's ask; Phase 4 emits dual-target artifacts (plugin dir +
   app manifest referencing the plugin under a plugins: key).

3. ExtensionFallbackCard chat component (src/components/chat/extension-
   fallback-card.tsx): renderable-only in v1 — three states (prompt,
   scaffolded, failed), two paths not three. Planner wiring deferred to
   Phase 6.5 per the app-materialized-card precedent.

Tests:
 - 13 Vitest cases for plugin-spec-tools: scaffold happy-path, atomicity
   (temp-dir cleanup on write failure), collision refusal, invalid id
   (uppercase, leading digit, reserved), node+inprocess TODO stub,
   classifier integration (scaffold → classifyPluginTrust → "self"), chat
   tool ok/error envelope.
 - 6 Testing Library cases for ExtensionFallbackCard: render, click
   handlers, state transitions (prompt → scaffolded, prompt → failed →
   prompt via retry), initialState honoring.

No CLAUDE.md smoke-test budget triggered — plugin-spec-tools has no static
imports transitively reachable from @/lib/agents/runtime/catalog.ts (the
chain that triggers runtime-registry module-load cycles).

No changes to Phase 4 trust machinery (capability-check, confinement,
tool-permissions). No TDR status changes (TDR-037 stays accepted). No
feature spec status changes (chat-tools-plugin-kind-1 stays shipped).

Design spec: docs/superpowers/specs/2026-04-20-tdr-037-phase-6-design.md
Implementation plan: docs/superpowers/plans/2026-04-20-tdr-037-phase-6-implementation.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 8: Verify commit landed and tree is clean**

Run:
```bash
git log --oneline -3
git status
```

Expected: new commit on `main`, working tree clean, `origin/main` ahead by 2 commits (spec commit + Phase 6 commit).

---

## Self-review (executed before handoff)

**Spec coverage check** — each design-spec section maps to a task:

| Spec section | Task(s) |
|---|---|
| Piece 1 — `create_plugin_spec` | Task 1 (tests), Task 2 (impl), Task 3 (register) |
| Piece 2 — skill fall-through | Task 6 |
| Piece 3 — `ExtensionFallbackCard` | Task 4 (tests), Task 5 (impl) |
| Error handling (3 named errors) | Task 2 Step 1 (error classes), Task 1 (test coverage for each) |
| Atomicity (temp-dir + rename) | Task 2 Step 1 (impl), Task 1 test #11 (cleanup on failure) |
| Classifier integration | Task 1 test #10 |
| Changelog entry | Task 7 |
| Verification (typecheck, test, grep) | Task 8 Steps 1–5 |
| Single commit on main | Task 8 Steps 6–8 |

No uncovered spec sections.

**Placeholder scan** — full file read-through shows no "TBD" / "TODO later" / "implement appropriately" phrases in any task body. Every step has either complete code or an exact shell command with expected output.

**Type consistency** — `CreatePluginSpecInput` and `CreatePluginSpecResult` exported from `plugin-spec-tools.ts` (Task 2) match the test file's imports (Task 1). `ExtensionFallbackCardProps` in Task 5 matches `baseProps` shape in Task 4 (including the `pluginInputs` field). `ScaffoldResult` / `ScaffoldResultForCard` intentionally defined on the component side (Task 5) to decouple the UI from the tool module's imports — the test (Task 4) uses a structural literal matching the shape. This is by design.

**Scope check** — single feature, ~600 LOC across 4 new files + 3 modifications, one atomic commit. Fits in a single session.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-20-tdr-037-phase-6-implementation.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

Which approach?
