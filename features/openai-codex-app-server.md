---
title: OpenAI Codex App Server Runtime
status: completed
priority: P1
milestone: post-mvp
source: ideas/mvp-vision.md, ideas/tech-stack-ainative.md
dependencies: [provider-runtime-abstraction]
---

# OpenAI Codex App Server Runtime

## Description

Add OpenAI as ainative's second governed execution runtime by integrating with Codex App Server. The intent is to support the same operational surface ainative already has for Claude: project-scoped execution, inbox approvals, monitoring, workflow child tasks, and schedule-driven runs. This is a runtime integration feature, not a generic routing experiment.

Codex App Server is the preferred OpenAI path because it exposes lifecycle and approval semantics that fit ainative's governance model better than a thin SDK-only integration. ainative should treat the app server as the OpenAI execution backend and map its thread/run lifecycle into the app's existing tasks, notifications, and logs.

## User Story

As a team using ainative, I want to run tasks through OpenAI Codex in the same governed workspace I already use for Claude so that provider choice does not force me onto a separate tool or a separate supervision model.

## Technical Approach

- Implement an `openai-codex-app-server` runtime adapter behind the provider runtime abstraction.
- Map ainative task execution to Codex thread/run semantics:
  - start task -> create thread/run
  - resume task -> continue or resume the thread
  - cancel task -> terminate the active run
- Normalize Codex App Server events into ainative's runtime event model, then persist them into `agent_logs` and task state using the same tables used by Claude-backed tasks.
- Route approval requests and user questions from Codex runs into the existing `notifications` + Inbox response flow. The runtime adapter should translate inbox responses back into the app server's continuation mechanism.
- Preserve ainative execution context:
  - project working directory
  - task description + document context
  - selected profile/provider instructions when compatible
  - saved permission patterns where the runtime supports equivalent approval shortcuts
- Extend auth/settings to support OpenAI credentials and app-server health checks without conflating them with Anthropic-specific state.
- Allow workflows and schedules to launch Codex-backed tasks through the shared runtime layer once the runtime is registered.
- Label monitoring output with provider/runtime identity so operators can distinguish Claude and Codex executions without learning provider-specific event names.

## Acceptance Criteria

- [x] `openai-codex-app-server` is a registered runtime option that can be assigned to tasks
- [x] A Codex-backed task can execute from ainative and update task status, result, and `agent_logs` through the shared runtime pipeline
- [x] Approval requests or agent questions from Codex runs appear in the Inbox and user responses continue the run
- [x] Interrupted or failed Codex runs can be resumed when the runtime reports resume support
- [x] Workflow child tasks and scheduled firings can target the Codex runtime through the shared runtime layer
- [x] Monitoring surfaces provider-labeled Codex events without relying on Claude-specific event names
- [x] OpenAI connectivity/auth health can be tested from settings using provider-aware runtime checks
- [x] Unsupported runtime capabilities fail with explicit operator-facing messaging instead of silently degrading

## Implementation Notes

- Added an `openai-codex-app-server` adapter under `src/lib/agents/runtime/` backed by a lightweight `codex app-server` WebSocket JSON-RPC client.
- Codex task runs now preserve project cwd, document context, profile instructions, resumable thread IDs, and provider-labeled agent logs.
- Codex approval requests and user-input prompts flow through the existing Inbox notifications system, including stored "always allow" permission behavior where equivalent.
- Settings now support provider-aware OpenAI API-key storage plus runtime-specific connectivity checks.
- Task creation, task assist, schedule creation, and workflow step/loop configuration now expose runtime selection so OpenAI-backed executions can be targeted end-to-end.

## Verification

- On March 12, 2026, ship verification re-checked the feature against the implementation and acceptance criteria.
- Automated verification passed with the full Vitest suite (`167` passing tests) and a successful production build.
- Browser verification confirmed:
  - OpenAI runtime connectivity test succeeds from Settings when `OPENAI_API_KEY` is configured
  - A browser-created task assigned to `openai-codex-app-server` can execute successfully and complete with a persisted result
- Ship verification also surfaced and fixed a runtime startup issue where Codex rejected an unsupported history-persistence flag during thread creation.

## Scope Boundaries

**Included:**
- OpenAI runtime adapter via Codex App Server
- Task execution, resume, cancel, approvals, monitoring, workflows, and schedules
- Provider-aware auth/health checks for OpenAI

**Excluded:**
- Bare `@openai/codex-sdk` integration as the primary path
- Automatic provider fallback or price-aware routing
- Feature parity guarantees for every existing Claude profile
- Full hosted container management inside ainative

## References

- Depends on: [provider-runtime-abstraction](provider-runtime-abstraction.md)
- Related features: [agent-integration](agent-integration.md), [inbox-notifications](inbox-notifications.md), [monitoring-dashboard](monitoring-dashboard.md), [scheduled-prompt-loops](scheduled-prompt-loops.md), [workflow-engine](workflow-engine.md)
- Official docs: [Codex App Server](https://developers.openai.com/codex/app-server), [Codex SDK](https://developers.openai.com/codex/sdk)
