---
title: App Extended Primitives — Tier 2
status: planned
priority: P2
milestone: post-mvp
source: brainstorm session 2026-04-11
dependencies: [app-extended-primitives-tier1]
---

# App Extended Primitives — Tier 2

## Description

Tier 1 added 5 primitives that had thin wiring needs. Tier 2 adds 4 more
that require deeper platform integration: channels, memory seeds, chat tools,
and workflows. Each of these touches a platform subsystem with its own
lifecycle — OAuth flows for channels, confidence-scored episodic memory,
permission-gated tool registration, and DAG-based workflow execution.

After this feature, `AppBundle` grows from 12 to 16 primitives, covering the
full surface needed for rich, autonomous app experiences. Combined with the
Tier 1 primitives, apps can declare everything from data tables to
communication channels to behavioral priors — all provisioned on install.

## User Story

As an app creator, I want to declare communication channels, behavioral
memory seeds, custom chat tools, and workflow templates in my app manifest
so that installing my app fully configures the agent's communication,
memory, tool surface, and automation pipelines without manual wiring.

## Technical Approach

### 1. New TypeScript interfaces (`src/lib/apps/types.ts`)

```ts
export interface AppChannelDeclaration {
  key: string;
  name: string;
  description?: string;
  adapter: "slack" | "telegram" | "email" | "sms" | "webhook";
  required: boolean;
  configHints?: Record<string, string>;     // UI hints for OAuth setup
  webhookEvents?: string[];                 // for webhook adapter: event types
}

export interface AppMemorySeed {
  key: string;
  content: string;                          // the behavioral prior text
  category: "behavioral" | "factual" | "procedural";
  confidence: number;                       // 0.0-1.0, initial confidence
  requiresConsent: boolean;                 // user must accept at install
  description?: string;                     // human-readable explanation
}

export interface AppChatToolDefinition {
  key: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;     // JSON Schema for tool input
  handler: "builtin" | "webhook" | "mcp";
  handlerConfig: Record<string, unknown>;   // varies by handler type
  permissionGated: boolean;                 // require user approval per call
  projectScoped: boolean;                   // only available within app's project
}

export interface AppWorkflowTemplate {
  key: string;
  name: string;
  description?: string;
  steps: AppWorkflowStep[];
  trigger?: "manual" | "schedule" | "event";
  scheduleKey?: string;                     // link to AppScheduleTemplate
}

export interface AppWorkflowStep {
  id: string;
  name: string;
  type: "agent_task" | "human_review" | "condition" | "parallel";
  config: Record<string, unknown>;
  dependsOn?: string[];                     // step IDs this step waits for
}
```

Extend `AppBundle`:

```ts
export interface AppBundle {
  // ... existing 12 fields from Tier 1 ...
  // --- Tier 2 additions ---
  channels?: AppChannelDeclaration[];
  memory?: AppMemorySeed[];
  chatTools?: AppChatToolDefinition[];
  workflows?: AppWorkflowTemplate[];
}
```

### 2. New permission types (`src/lib/apps/types.ts`)

Extend `APP_PERMISSIONS` with 4 new entries:

```ts
export const APP_PERMISSIONS = [
  // ... existing 11 from Tier 1 ...
  "channels:register",
  "memory:seed",
  "chat-tools:register",
  "workflows:create",
] as const;
```

### 3. Zod validation schemas (`src/lib/apps/validation.ts`)

```ts
const channelDeclarationSchema = z.object({
  key: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(120),
  description: z.string().max(240).optional(),
  adapter: z.enum(["slack", "telegram", "email", "sms", "webhook"]),
  required: z.boolean(),
  configHints: z.record(z.string().max(500)).optional(),
  webhookEvents: z.array(z.string().max(64)).max(20).optional(),
});

const memorySeedSchema = z.object({
  key: z.string().regex(/^[a-z0-9-]+$/),
  content: z.string().min(1).max(2000),
  category: z.enum(["behavioral", "factual", "procedural"]),
  confidence: z.number().min(0).max(1),
  requiresConsent: z.boolean(),
  description: z.string().max(500).optional(),
});

const chatToolDefinitionSchema = z.object({
  key: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(500),
  inputSchema: z.record(z.unknown()),
  handler: z.enum(["builtin", "webhook", "mcp"]),
  handlerConfig: z.record(z.unknown()),
  permissionGated: z.boolean(),
  projectScoped: z.boolean(),
});

const workflowStepSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  type: z.enum(["agent_task", "human_review", "condition", "parallel"]),
  config: z.record(z.unknown()),
  dependsOn: z.array(z.string().max(64)).max(20).optional(),
});

const workflowTemplateSchema = z.object({
  key: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(120),
  description: z.string().max(240).optional(),
  steps: z.array(workflowStepSchema).min(1).max(50),
  trigger: z.enum(["manual", "schedule", "event"]).optional(),
  scheduleKey: z.string().regex(/^[a-z0-9-]+$/).optional(),
});
```

### 4. Bootstrap handlers (`src/lib/apps/service.ts`)

Four new handler functions, called from `bootstrapApp()` after the Tier 1
handlers:

- **`bootstrapChannels(appId, channels)`** — For each channel declaration,
  register it in the channel adapter registry (`src/lib/channels/registry.ts`).
  If `required: true` and the adapter is not yet configured (e.g., Slack
  OAuth not completed), mark the app as needing setup — status stays
  `bootstrapping` until the channel is connected. Store channel registration
  IDs in `resourceMap.channels`.

  The existing channel registry (`src/lib/channels/registry.ts`) supports
  `registerAdapter()` with `slack-adapter.ts`, `telegram-adapter.ts`, and
  `webhook-adapter.ts`. The bootstrap handler checks which adapters are
  already configured and prompts for missing ones.

- **`bootstrapMemory(appId, memorySeeds)`** — For each memory seed, create
  an episodic memory entry via the memory system
  (`src/lib/agents/memory/extractor.ts`). Seeds with `requiresConsent: true`
  are stored in a pending state — the install wizard shows them for
  accept/decline. Accepted seeds are written with the declared confidence
  score. Declined seeds are recorded as rejected (never resurface).

  The existing memory system (`src/lib/agents/memory/types.ts`,
  `retrieval.ts`, `decay.ts`) supports confidence scoring and category
  tagging. Seeds integrate as pre-loaded episodic entries.

- **`bootstrapChatTools(appId, chatTools, projectId)`** — For each chat tool
  definition, register it using the `defineTool()` pattern from
  `src/lib/chat/tool-registry.ts`. Tools marked `projectScoped: true` are
  only returned by `collectAllTools()` (in `src/lib/chat/stagent-tools.ts`)
  when the active project matches the app's project. Permission-gated tools
  require explicit user approval on each call.

  Handler routing by `handler` field:
  - `"builtin"` — maps to an existing platform tool by name
  - `"webhook"` — creates a tool that POSTs to a configured URL
  - `"mcp"` — delegates to MCP server wiring (see `app-mcp-server-wiring`)

- **`bootstrapWorkflows(appId, workflows, resourceMap)`** — For each workflow
  template, create a workflow instance via the workflow engine
  (`src/lib/workflows/engine.ts`). Steps are mapped to the engine's step
  types. If `trigger` is `"schedule"` and `scheduleKey` is set, link the
  workflow to the schedule ID from `resourceMap.schedules`.

  The existing workflow engine (`src/lib/workflows/engine.ts`,
  `src/lib/workflows/types.ts`) supports DAG execution with `agent_task`,
  `human_review`, `condition`, and `parallel` step types.

### 5. AppResourceMap extensions

```ts
export interface AppResourceMap {
  tables: Record<string, string>;
  schedules: Record<string, string>;
  triggers?: Record<string, string>;       // from Tier 1
  documents?: Record<string, string>;      // from Tier 1
  notifications?: Record<string, string>;  // from Tier 1
  savedViews?: Record<string, string>;     // from Tier 1
  envVars?: Record<string, string>;        // from Tier 1
  // --- Tier 2 ---
  channels?: Record<string, string>;
  memory?: Record<string, string>;
  chatTools?: Record<string, string>;
  workflows?: Record<string, string>;
}
```

### 6. Built-in app examples (`src/lib/apps/builtins.ts`)

**wealth-manager additions:**

- Channel: Slack channel for trade alerts (`required: false`)
- Memory seeds:
  - "When discussing positions, prioritize tax implications over short-term
    gains" (behavioral, confidence 0.8, requires consent)
  - "User prefers index funds for core allocation" (factual, confidence 0.6,
    requires consent)
- Chat tool: `calculateTaxImpact` — takes ticker + shares + cost basis,
  returns estimated tax liability (builtin handler, project-scoped)
- Workflow: "Quarterly Rebalance Review" — 3-step DAG: agent analyzes drift,
  human reviews recommendations, agent generates trade list

**growth-module additions:**

- Channel: Webhook for experiment event notifications
- Memory seed: "Prefer statistically significant results (p < 0.05) before
  declaring experiment winners" (procedural, confidence 0.9)
- Chat tool: `analyzeExperiment` — takes experiment ID, returns statistical
  summary (builtin handler, project-scoped)
- Workflow: "Experiment Lifecycle" — 4-step DAG: setup, run, analyze, report

### 7. Cross-reference validation

- `channelDeclaration.adapter` must correspond to a known adapter in the
  platform channel registry
- `chatToolDefinition.handler === "mcp"` requires the app to also declare
  `mcpServers` (enforced at validation time, cross-referencing
  `app-mcp-server-wiring`)
- `workflowTemplate.scheduleKey` must reference a declared
  `schedules[].key`
- `workflowStep.dependsOn` IDs must reference other steps within the same
  workflow template (DAG cycle detection)

## Acceptance Criteria

- [ ] Four new interfaces added to `src/lib/apps/types.ts` with JSDoc.
- [ ] Four new Zod schemas in `src/lib/apps/validation.ts` with
      cross-reference checks.
- [ ] `AppBundle` extended with 4 optional fields; existing bundles validate
      unchanged.
- [ ] `APP_PERMISSIONS` extended with 4 new permission strings.
- [ ] `AppResourceMap` extended to track channels, memory, chatTools,
      workflows.
- [ ] `bootstrapApp()` calls 4 new handlers in correct order (channels
      before chatTools, workflows last).
- [ ] Channel bootstrap correctly detects missing OAuth and defers to
      install wizard.
- [ ] Memory seeds with `requiresConsent: true` are surfaced in install
      wizard; only accepted seeds are persisted.
- [ ] Chat tools registered via `defineTool()` appear in
      `collectAllTools()` output scoped to app's project.
- [ ] Workflow templates create valid workflow instances in the engine.
- [ ] `wealth-manager` and `growth-module` builtins include examples of all
      4 new primitives.
- [ ] DAG cycle detection rejects workflows with circular step dependencies.
- [ ] `npm test` passes; `npx tsc --noEmit` clean.

## Scope Boundaries

**Included:**
- TypeScript interfaces for 4 new primitives
- Zod validation schemas with cross-reference checks
- Bootstrap handlers wiring to existing platform subsystems
- Permission type and AppResourceMap extensions
- Built-in app examples for both apps
- DAG validation for workflow step dependencies

**Excluded:**
- New channel adapters (use existing Slack, Telegram, webhook)
- New memory system features (use existing episodic memory with decay)
- MCP server wiring for chat tools (separate spec: `app-mcp-server-wiring`)
- Trust-level enforcement per primitive (covered by `marketplace-trust-ladder`)
- Workflow execution monitoring UI (use existing workflow page)
- Budget policies for schedule-linked workflows (separate spec:
  `app-budget-policies`)

## References

- Source: brainstorm session 2026-04-11, plan `flickering-petting-hammock.md`
  section 3b
- Related: `app-extended-primitives-tier1`, `app-mcp-server-wiring`,
  `app-budget-policies`, `marketplace-trust-ladder`
- Files to modify:
  - `src/lib/apps/types.ts` — 4 new interfaces, extend AppBundle,
    extend AppResourceMap, extend APP_PERMISSIONS
  - `src/lib/apps/validation.ts` — 4 new Zod schemas
  - `src/lib/apps/service.ts` — 4 new bootstrap handlers
  - `src/lib/apps/builtins.ts` — examples in wealth-manager and growth-module
- Platform code already in place:
  - `src/lib/channels/registry.ts` — adapter registration
  - `src/lib/channels/slack-adapter.ts` — Slack channel adapter
  - `src/lib/channels/telegram-adapter.ts` — Telegram channel adapter
  - `src/lib/channels/webhook-adapter.ts` — Webhook channel adapter
  - `src/lib/agents/memory/types.ts` — episodic memory types
  - `src/lib/agents/memory/extractor.ts` — memory creation
  - `src/lib/agents/memory/retrieval.ts` — memory retrieval with confidence
  - `src/lib/agents/memory/decay.ts` — confidence decay over time
  - `src/lib/chat/tool-registry.ts` — `defineTool()` pattern
  - `src/lib/chat/stagent-tools.ts` — `collectAllTools()` aggregation
  - `src/lib/workflows/engine.ts` — DAG workflow execution
  - `src/lib/workflows/types.ts` — workflow type definitions
- Files to create:
  - `src/lib/apps/__tests__/tier2-primitives.test.ts` — unit tests for all
    4 bootstrap handlers
  - `src/lib/apps/__tests__/tier2-validation.test.ts` — cross-reference
    and DAG cycle detection tests
