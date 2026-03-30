---
title: Provider-Agnostic Tool Layer
status: planned
priority: P0
milestone: post-mvp
source: ideas/direct-api-gap-analysis.md
dependencies: [provider-runtime-abstraction]
---

# Provider-Agnostic Tool Layer

## Description

Stagent's 50+ chat tools are currently defined using the Claude Agent SDK's `tool()` function and bundled via `createSdkMcpServer()`. This couples 11 source files to `@anthropic-ai/claude-agent-sdk` even though the tool logic itself is provider-agnostic — each tool is just a name, description, Zod schema, and async handler.

This feature extracts tool definitions into a provider-neutral format so any runtime adapter can consume them. The existing Claude SDK runtime continues to work unchanged by wrapping the neutral definitions back into SDK format. New direct API runtimes can pass tools directly as JSON Schema to the Messages API or Responses API.

This is a prerequisite for both `anthropic-direct-runtime` and `openai-direct-runtime`.

## User Story

As a Stagent developer, I want tool definitions to be runtime-agnostic so that adding new runtimes doesn't require rewriting 50+ tool implementations.

## Technical Approach

- Create `src/lib/chat/tool-registry.ts` with a `defineTool()` helper that produces `{ name, description, inputSchema: JSONSchema, handler }` objects
- The helper uses `zod-to-json-schema` to convert Zod schemas to JSON Schema at definition time
- Replace `import { tool } from "@anthropic-ai/claude-agent-sdk"` in all 10 `src/lib/chat/tools/*.ts` files with `import { defineTool } from "../tool-registry"`
- Each tool's handler signature stays the same: `async (args) => { return ok(result) | err(message) }`
- Replace `createSdkMcpServer()` in `src/lib/chat/stagent-tools.ts` with a `createToolServer()` function that:
  - For Claude SDK runtime: wraps tools back into `tool()` calls and feeds to `createSdkMcpServer()` (backward-compatible)
  - For direct API runtimes: returns the raw tool definitions array for inclusion in `tools` parameter
- Add `zod-to-json-schema` to dependencies (small, well-maintained package)
- Update `src/lib/agents/__tests__/claude-agent.test.ts` mocks to use new format

### Files to Modify

| File | Change |
|------|--------|
| `src/lib/chat/tool-registry.ts` | **New** — `defineTool()` helper + `ToolDefinition` type |
| `src/lib/chat/tools/task-tools.ts` | Replace `tool()` import with `defineTool()` |
| `src/lib/chat/tools/workflow-tools.ts` | Same |
| `src/lib/chat/tools/profile-tools.ts` | Same |
| `src/lib/chat/tools/schedule-tools.ts` | Same |
| `src/lib/chat/tools/document-tools.ts` | Same |
| `src/lib/chat/tools/notification-tools.ts` | Same |
| `src/lib/chat/tools/usage-tools.ts` | Same |
| `src/lib/chat/tools/settings-tools.ts` | Same |
| `src/lib/chat/tools/chat-history-tools.ts` | Same |
| `src/lib/chat/tools/project-tools.ts` | Same |
| `src/lib/chat/stagent-tools.ts` | Replace `createSdkMcpServer()` with `createToolServer()` |
| `src/lib/agents/__tests__/claude-agent.test.ts` | Update mocks |

## Acceptance Criteria

- [ ] `defineTool()` helper exists in `tool-registry.ts` with `ToolDefinition` type exported
- [ ] All 10 `src/lib/chat/tools/*.ts` files import from `tool-registry` instead of `@anthropic-ai/claude-agent-sdk`
- [ ] `createSdkMcpServer()` import removed from `stagent-tools.ts`
- [ ] Claude SDK runtime (`claude-code`) still works identically — tools are re-wrapped for SDK consumption
- [ ] Tool definitions include JSON Schema (not Zod objects) in `inputSchema` field
- [ ] All existing chat tool tests pass without changes to test logic
- [ ] `@anthropic-ai/claude-agent-sdk` is no longer imported in any `tools/*.ts` file

## Scope Boundaries

**Included:**
- Tool definition format extraction
- MCP server creation abstraction
- Backward compatibility with Claude SDK runtime
- `zod-to-json-schema` dependency addition

**Excluded:**
- Changing tool behavior or adding new tools
- Modifying the Claude SDK runtime adapter itself (beyond wrapping)
- Building direct API runtime adapters (separate features)
- Changing the chat engine's tool dispatch logic

## References

- Source: `ideas/direct-api-gap-analysis.md` — Section 4.3 "Prerequisite: Tool Decoupling"
- Related features: enables `anthropic-direct-runtime`, `openai-direct-runtime`
- Existing pattern: `src/lib/chat/tools/task-tools.ts` (current `tool()` usage)
