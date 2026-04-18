---
title: "Provider Runtimes"
category: "feature-reference"
section: "provider-runtimes"
route: "cross-cutting"
tags: [claude, codex, runtime, oauth, websocket, mcp, providers, ollama, anthropic-direct, openai-direct, smart-router]
features: ["provider-runtime-abstraction", "openai-codex-app-server", "cross-provider-profile-compatibility", "ollama-runtime-provider", "anthropic-direct-runtime", "openai-direct-runtime", "smart-runtime-router", "runtime-validation-hardening", "runtime-capability-matrix"]
screengrabCount: 2
lastUpdated: "2026-04-15"
---

# Provider Runtimes

ainative supports five provider runtimes, allowing tasks, workflows, schedules, and chat to target different AI providers depending on the use case. A smart router can automatically select the best runtime for each task based on content, profile affinity, and cost preferences. Profiles are compatible across providers, so switching runtimes does not require redefining agent behavior.

## Screenshots

![Settings Ollama section](../screengrabs/settings-ollama.png)
*Ollama local runtime configuration in Settings.*

![Ollama connected with models](../screengrabs/settings-ollama-connected.png)
*Ollama connected showing 4 local models available for task execution.*

## Key Features

### Provider Runtime Abstraction

A unified interface sits between the task execution layer and the underlying provider. All five runtimes expose the same lifecycle hooks -- start, poll, resume, cancel -- so the execution manager, workflow engine, and chat engine operate identically regardless of which provider is active.

### Claude Runtime (Agent SDK)

The Claude runtime uses the Anthropic Agent SDK with two authentication modes:

- **OAuth** -- uses Max subscription tokens via the OAuth flow (default, no credit burn).
- **API Key** -- uses `ANTHROPIC_API_KEY` for direct API access.

Capabilities include resumable conversations, human-in-the-loop approvals via the `canUseTool` polling pattern, and MCP server integration for extended tool use.

### Anthropic Direct API Runtime

A lightweight runtime that calls the Anthropic Messages API directly without requiring the Claude Code CLI. Features include:

- Sub-second startup latency (no subprocess spawn)
- Streaming responses with tool use support
- Session resume via database-stored conversation state
- Budget enforcement integrated with the usage ledger

### Codex Runtime (App Server)

The Codex runtime connects to the OpenAI Codex App Server over WebSocket using JSON-RPC. Key characteristics:

- Resumable threads with persistent state across reconnections.
- WebSocket transport for low-latency bidirectional communication.
- Two auth modes for Codex App Server:
  - **ChatGPT** -- browser sign-in tied to your ChatGPT plan, with cached session reuse in ainative's isolated Codex home
  - **API Key** -- direct API-key auth using `OPENAI_API_KEY`
- OpenAI Direct remains a separate API-key-backed runtime even when Codex App Server uses ChatGPT auth.

### OpenAI Direct API Runtime

A direct adapter for the OpenAI Responses API, providing:

- Server-side agentic loop with tool use
- Code interpreter, file search, and image generation support
- `previous_response_id` for session resume
- No Codex binary required

### Ollama Runtime (Local Models)

The Ollama runtime connects to a locally running Ollama instance for private, zero-cost AI execution:

- **NDJSON streaming** -- real-time token streaming via Ollama's native format
- **Model discovery** -- automatically detects all models installed on the local instance
- **Smart router integration** -- Ollama models appear alongside cloud models in all runtime selectors
- **$0 cost tracking** -- all Ollama executions are metered at zero cost in the usage ledger
- **Privacy** -- task content never leaves your machine

### Smart Runtime Router

The smart router automatically selects the best runtime for each task based on multiple signals:

- **Content keywords** -- task descriptions containing code-related terms may favor Codex; research-oriented tasks may favor Claude
- **Profile affinity** -- profiles can declare a preferred runtime
- **User preference** -- choose cost-optimized, latency-optimized, or quality-optimized routing
- **Credential filtering** -- only runtimes with valid credentials are considered

The default selection is "Auto (recommended)" which lets the router decide. You can always override with a specific runtime in task, schedule, or workflow forms.

### Runtime Capability Matrix

Each runtime advertises its capabilities through a central matrix used by the rest of the app to decide whether to show a feature, gate it, or substitute a fallback. The most visible flags today:

- **`supportsSkillComposition`** — whether the runtime accepts multiple concurrent skills on a single conversation. Gates the Chat Skills tab multi-activation behavior.
- **`maxActiveSkills`** — hard cap on the active skill stack. The Chat composer shows "N of M active" against this value.
- **`hasNativeSkills`** / **`stagentInjectsSkills`** / **`autoLoadsInstructions`** — decide whether ainative should inject SKILL.md or trust the runtime's native loader, preventing duplicated context on Codex and Claude.

Reading this matrix before wiring a feature is the canonical way to answer "should ainative do X, or trust the runtime to do X."

### Runtime Validation Hardening

The MCP task-tools surface now validates every incoming `runtimeId` before dispatching work — unknown IDs are rejected at the boundary rather than crashing downstream. This protects the runtime registry from malformed chat-tool calls and surfaces bad configurations with a clean error message instead of a stack trace.

### Cross-Provider Profile Compatibility

Agent profiles are defined independently of the provider runtime. A profile specifies behavioral traits -- system prompt, tool preferences, stop conditions -- that translate cleanly to any of the five runtimes. Switching the runtime dropdown on a task preserves the selected profile and its configuration.

## Related

- [Agent Intelligence](./agent-intelligence.md)
- [Profiles](./profiles.md)
- [Settings](./settings.md)
