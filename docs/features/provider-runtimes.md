---
title: "Provider Runtimes"
category: "feature-reference"
section: "provider-runtimes"
route: "cross-cutting"
tags: [claude, codex, runtime, oauth, websocket, mcp, providers]
features: ["provider-runtime-abstraction", "openai-codex-app-server", "cross-provider-profile-compatibility"]
screengrabCount: 0
lastUpdated: "2026-03-21"
---

# Provider Runtimes

Stagent supports two provider runtimes, allowing tasks and workflows to target either Claude or Codex depending on the use case. Profiles are compatible across providers, so switching runtimes does not require redefining agent behavior. Runtime selection is exposed via dropdown in task and workflow creation forms.

## Key Features

### Provider Runtime Abstraction

A unified interface sits between the task execution layer and the underlying provider. Both runtimes expose the same lifecycle hooks — start, poll, resume, cancel — so the execution manager and workflow engine operate identically regardless of which provider is active.

### Claude Runtime (Agent SDK)

The Claude runtime uses the Anthropic Agent SDK with two authentication modes:

- **OAuth** — uses Max subscription tokens via the OAuth flow (default, no credit burn).
- **API Key** — uses `ANTHROPIC_API_KEY` from `.env.local` for direct API access.

Capabilities include resumable conversations, human-in-the-loop approvals via the `canUseTool` polling pattern, and MCP (Model Context Protocol) server integration for extended tool use.

### Codex Runtime (App Server)

The Codex runtime connects to the OpenAI Codex App Server over WebSocket using JSON-RPC. Key characteristics:

- **Resumable threads** — long-running tasks persist across reconnections.
- **WebSocket transport** — low-latency bidirectional communication.
- **Integration point** — `src/lib/agents/runtime/codex-app-server-client.ts`.

Codex SDK reference documentation is captured at `.claude/reference/developers-openai-com-codex-sdk/`.

### Cross-Provider Profile Compatibility

Agent profiles (General, Code Reviewer, Researcher, Document Writer) are defined independently of the provider runtime. A profile specifies behavioral traits — system prompt, tool preferences, stop conditions — that translate cleanly to either Claude or Codex. Switching the runtime dropdown on a task preserves the selected profile and its configuration.

## Related

- [Agent Intelligence](./agent-intelligence.md)
- [Profiles](./profiles.md)
- [Settings](./settings.md)
