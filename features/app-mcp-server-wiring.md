---
title: App MCP Server Wiring
status: deferred
priority: P2
milestone: post-mvp
source: brainstorm session 2026-04-11
dependencies: [app-extended-primitives-tier2, marketplace-trust-ladder]
---

# App MCP Server Wiring

> **Deferred 2026-04-14.** Part of the marketplace / apps-distribution vision, which has no active plan after the pivot to 100% free Community Edition. Kept in the backlog pending future product direction.

## Description

Apps today can declare chat tools via `AppChatToolDefinition` (Tier 2), but
tools backed by MCP servers need a dedicated wiring path. MCP (Model Context
Protocol) servers are external processes that expose tools over a standard
protocol — either via stdio (local subprocess) or HTTP (remote endpoint).
Letting apps declare MCP servers unlocks cross-platform portability: the same
app that works inside ainative's chat also works from Claude Desktop, Cursor,
or any MCP-compatible client.

This feature adds `mcpServers` as a new primitive on `AppBundle`. At install
time, the bootstrap handler wires each declared MCP server into the chat tool
catalog, scoped to the app's project. Trust-level enforcement ensures only
`verified` and `official` apps can wire MCP servers — community and private
apps are restricted to declarative primitives only.

## User Story

As an app creator, I want to declare MCP servers in my app manifest so that
installing my app automatically wires external tool servers into the chat
experience — and users of Claude Desktop or Cursor can also connect to the
same MCP servers for a consistent tool surface across platforms.

As a user, I want MCP tools from installed apps to appear only within the
app's project context, with clear trust indicators, so I understand which
tools come from which apps and can control their permissions.

## Technical Approach

### 1. New TypeScript interface (`src/lib/apps/types.ts`)

```ts
export interface AppMcpServerDeclaration {
  key: string;
  name: string;
  description: string;
  transport: "stdio" | "http";
  // stdio transport fields
  command?: string;                         // e.g., "npx -y @modelcontextprotocol/server-github"
  args?: string[];
  cwd?: string;                             // relative to app install dir
  // http transport fields
  url?: string;                             // e.g., "https://api.example.com/mcp"
  headers?: Record<string, string>;         // static headers (auth tokens via envVars)
  // common fields
  envVars?: string[];                       // references AppEnvVarDeclaration.key values
  tools: AppMcpToolExposure[];              // which tools to expose
  healthCheck?: {
    endpoint?: string;                      // for http: health URL
    timeoutMs?: number;                     // default 5000
  };
}

export interface AppMcpToolExposure {
  toolName: string;                         // MCP tool name to expose
  displayName?: string;                     // override display name in UI
  description?: string;                     // override description
  permissionGated: boolean;                 // require user approval per call
}
```

Extend `AppBundle`:

```ts
export interface AppBundle {
  // ... existing 16 fields from Tier 1 + Tier 2 ...
  // --- MCP addition ---
  mcpServers?: AppMcpServerDeclaration[];
}
```

### 2. New permission type

Add to `APP_PERMISSIONS`:

```ts
"mcp:wire",
```

This permission is automatically required when `mcpServers` is non-empty.

### 3. Zod validation schema (`src/lib/apps/validation.ts`)

```ts
const mcpToolExposureSchema = z.object({
  toolName: z.string().min(1).max(120),
  displayName: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  permissionGated: z.boolean(),
});

const mcpServerDeclarationSchema = z.object({
  key: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(500),
  transport: z.enum(["stdio", "http"]),
  command: z.string().max(500).optional(),
  args: z.array(z.string().max(200)).max(20).optional(),
  cwd: z.string().max(500).optional(),
  url: z.string().url().max(500).optional(),
  headers: z.record(z.string().max(1000)).optional(),
  envVars: z.array(z.string().regex(/^[A-Z0-9_]+$/)).max(20).optional(),
  tools: z.array(mcpToolExposureSchema).min(1).max(50),
  healthCheck: z.object({
    endpoint: z.string().url().max(500).optional(),
    timeoutMs: z.number().int().min(1000).max(30000).optional(),
  }).optional(),
}).refine(
  (data) => {
    if (data.transport === "stdio") return !!data.command;
    if (data.transport === "http") return !!data.url;
    return false;
  },
  { message: "stdio transport requires command; http transport requires url" }
);
```

### 4. Trust-level enforcement

Add a trust-level gate in `bootstrapApp()` before MCP wiring:

```ts
function assertMcpTrustLevel(trustLevel: AppTrustLevel): void {
  const allowed: AppTrustLevel[] = ["verified", "official"];
  if (!allowed.includes(trustLevel)) {
    throw new AppRuntimeError(
      `MCP server wiring requires trust level "verified" or "official" ` +
      `(app has "${trustLevel}"). Publish and verify your app first.`
    );
  }
}
```

This check runs at validation time (not just bootstrap) so the error
surfaces immediately in `ainative app validate` and in the marketplace
install dialog.

### 5. Bootstrap handler (`src/lib/apps/service.ts`)

**`bootstrapMcpServers(appId, mcpServers, resourceMap, projectId)`**

For each declared MCP server:

1. **Resolve env vars** — Look up each referenced `envVars` key in the
   app's `resourceMap.envVars`. If any required env var is missing, defer
   bootstrap (same pattern as `bootstrapEnvVars` from Tier 1).

2. **Register server** — Create a server registration entry that the
   chat system can discover at runtime. For stdio transport, store the
   command + args + env. For http transport, store the URL + headers.

3. **Register tools** — For each tool in `tools[]`, create a tool
   definition using the `defineTool()` pattern from
   `src/lib/chat/tool-registry.ts`. The tool's handler delegates to the
   MCP server's protocol:

   ```ts
   // Simplified — actual implementation uses MCP client SDK
   defineTool({
     name: `${appId}--${tool.toolName}`,   // namespaced
     description: tool.description ?? mcpToolDescription,
     inputSchema: mcpToolInputSchema,       // fetched from MCP server
     handler: async (input) => {
       const client = getMcpClient(serverKey);
       return client.callTool(tool.toolName, input);
     },
     permissionGated: tool.permissionGated,
     projectId,                             // scope to app's project
   });
   ```

4. **Store in resourceMap** — Record server registration IDs in
   `resourceMap.mcpServers`.

### 6. Dynamic tool inclusion (`src/lib/chat/ainative-tools.ts`)

Modify `collectAllTools()` to include MCP-backed tools when the active
project matches an installed app's project:

```ts
function collectAllTools(ctx: ToolContext): ToolDefinition[] {
  const tools = [
    ...coreTools(ctx),
    ...tableTools(ctx),
    ...scheduleTools(ctx),
    // ... existing tool groups ...
  ];

  // Dynamic: include MCP tools from installed apps scoped to this project
  if (ctx.projectId) {
    const appMcpTools = getAppMcpToolsForProject(ctx.projectId);
    tools.push(...appMcpTools);
  }

  return tools;
}
```

The `getAppMcpToolsForProject()` function queries `app_instances` for apps
installed in the given project, then returns their registered MCP tool
definitions.

### 7. MCP client management

Create `src/lib/apps/mcp-client.ts` to manage MCP client connections:

- **Connection pooling** — Stdio servers are spawned once and reused.
  HTTP servers use a persistent client instance. Connections are lazily
  initialized on first tool call.
- **Health checks** — If `healthCheck` is configured, run periodic pings.
  Failed health checks mark the server as degraded in the UI.
- **Graceful shutdown** — On app disable/uninstall, terminate stdio
  subprocesses and close HTTP connections.
- **Tool schema discovery** — On first connect, fetch the MCP server's
  tool list and validate that all declared `tools[]` actually exist.
  Warn (don't fail) if the server exposes tools not declared in the
  manifest.

### 8. Cross-platform portability

Generate a `claude_desktop_config.json` fragment for each MCP server so
users can add the same tools to Claude Desktop:

```ts
export function generateClaudeDesktopConfig(
  servers: AppMcpServerDeclaration[]
): Record<string, unknown> {
  return {
    mcpServers: Object.fromEntries(
      servers.map((s) => [
        s.key,
        s.transport === "stdio"
          ? { command: s.command, args: s.args, env: resolveEnvVars(s.envVars) }
          : { url: s.url, headers: s.headers },
      ])
    ),
  };
}
```

Expose via `GET /api/apps/[appId]/mcp-config` for easy copy-paste.

### 9. Built-in app examples (`src/lib/apps/builtins.ts`)

**wealth-manager:**

```ts
mcpServers: [
  {
    key: "market-data",
    name: "Market Data Server",
    description: "Real-time and historical market data via MCP",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@ainative/mcp-market-data"],
    envVars: ["MARKET_DATA_API_KEY"],
    tools: [
      {
        toolName: "get_quote",
        displayName: "Get Stock Quote",
        permissionGated: false,
      },
      {
        toolName: "get_historical",
        displayName: "Historical Prices",
        permissionGated: false,
      },
    ],
  },
],
```

Note: The MCP server package is hypothetical — the builtin example
demonstrates the wiring pattern. The server declaration is only active
when the app's trust level is `official` (which it is for builtins).

## Acceptance Criteria

- [ ] `AppMcpServerDeclaration` and `AppMcpToolExposure` interfaces added
      to `src/lib/apps/types.ts`.
- [ ] Zod schema validates transport-specific required fields (command for
      stdio, url for http).
- [ ] Trust-level gate rejects MCP wiring for `community` and `private`
      apps with a clear error message.
- [ ] `bootstrapMcpServers()` resolves env vars, registers servers, and
      creates tool definitions.
- [ ] MCP tools appear in `collectAllTools()` only when the active project
      matches the app's project.
- [ ] Tool names are namespaced with `{appId}--` prefix to prevent
      collisions.
- [ ] Stdio MCP servers are spawned lazily on first tool call and
      terminated on app disable/uninstall.
- [ ] HTTP MCP servers use persistent clients with configurable health
      checks.
- [ ] `GET /api/apps/[appId]/mcp-config` returns a valid Claude Desktop
      configuration fragment.
- [ ] `wealth-manager` builtin includes an example MCP server declaration.
- [ ] Unit tests cover: trust-level gate, env var resolution, tool
      registration, project scoping, namespace collision prevention.
- [ ] `npm test` passes; `npx tsc --noEmit` clean.

## Scope Boundaries

**Included:**
- `AppMcpServerDeclaration` type and Zod schema
- Trust-level enforcement (verified+ only)
- Bootstrap handler for MCP server wiring
- Dynamic tool inclusion in `collectAllTools()`
- MCP client management (spawn, health, shutdown)
- Claude Desktop config export endpoint
- Builtin example in wealth-manager

**Excluded:**
- Building actual MCP server packages (apps declare, platform wires)
- MCP server sandboxing / process isolation (future security hardening)
- Remote MCP server marketplace (servers are declared per-app)
- MCP resource/prompt primitives (only tools are wired in this feature)
- OAuth proxy for MCP servers requiring authentication (use envVars)
- UI for MCP server health monitoring (use existing app settings page)

## References

- Source: brainstorm session 2026-04-11, plan `flickering-petting-hammock.md`
  section 3c
- Related: `app-extended-primitives-tier2`, `marketplace-trust-ladder`
- Files to modify:
  - `src/lib/apps/types.ts` — new interfaces, extend AppBundle
  - `src/lib/apps/validation.ts` — new Zod schema with transport refinement
  - `src/lib/apps/service.ts` — MCP bootstrap handler, trust-level gate
  - `src/lib/apps/builtins.ts` — wealth-manager MCP example
  - `src/lib/chat/ainative-tools.ts` — dynamic MCP tool inclusion in
    `collectAllTools()`
  - `src/lib/chat/tool-registry.ts` — extend `defineTool()` for MCP-backed
    tools
- Files to create:
  - `src/lib/apps/mcp-client.ts` — MCP client lifecycle management
  - `src/app/api/apps/[appId]/mcp-config/route.ts` — Claude Desktop config
    export
  - `src/lib/apps/__tests__/mcp-wiring.test.ts` — unit tests for MCP
    bootstrap, trust gate, tool scoping
