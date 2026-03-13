# Product Roadmap

## MVP

### Foundation Layer

Features that everything else depends on — CLI distribution, database, and app shell.

| Feature | Priority | Status | Dependencies |
|---------|----------|--------|--------------|
| [cli-bootstrap](cli-bootstrap.md) | P0 | completed | — |
| [database-schema](database-schema.md) | P0 | completed | — |
| [app-shell](app-shell.md) | P0 | completed | — |

### Core Layer

Primary user-facing features that deliver the product's main value: the kanban board, agent execution, notifications, and monitoring.

| Feature | Priority | Status | Dependencies |
|---------|----------|--------|--------------|
| [project-management](project-management.md) | P1 | completed | database-schema, app-shell |
| [task-board](task-board.md) | P1 | completed | database-schema, app-shell, project-management |
| [agent-integration](agent-integration.md) | P1 | completed | database-schema, task-board |
| [inbox-notifications](inbox-notifications.md) | P1 | completed | database-schema, app-shell, agent-integration |
| [monitoring-dashboard](monitoring-dashboard.md) | P1 | completed | database-schema, app-shell, agent-integration |

### Polish Layer

Features that enhance the product but aren't essential for first use — homepage, UX fixes, AI assistance, workflows, rich content, and session management.

| Feature | Priority | Status | Dependencies |
|---------|----------|--------|--------------|
| [homepage-dashboard](homepage-dashboard.md) | P1 | completed | database-schema, app-shell, project-management, task-board, agent-integration, inbox-notifications, monitoring-dashboard |
| [ux-gap-fixes](ux-gap-fixes.md) | P1 | completed | task-board, inbox-notifications, monitoring-dashboard, project-management |
| [task-definition-ai](task-definition-ai.md) | P2 | completed | agent-integration, task-board |
| [workflow-engine](workflow-engine.md) | P2 | completed | agent-integration, task-board |
| [content-handling](content-handling.md) | P2 | completed | task-board, agent-integration |
| [session-management](session-management.md) | P2 | completed | agent-integration |

## Post-MVP

### Document Management

| Feature | Priority | Status | Dependencies |
|---------|----------|--------|--------------|
| [file-attachment-data-layer](file-attachment-data-layer.md) | P1 | completed | content-handling |
| [document-preprocessing](document-preprocessing.md) | P2 | completed | file-attachment-data-layer |
| [agent-document-context](agent-document-context.md) | P1 | completed | file-attachment-data-layer, document-preprocessing |
| [document-manager](document-manager.md) | P2 | completed | file-attachment-data-layer, document-preprocessing |
| [document-output-generation](document-output-generation.md) | P3 | completed | file-attachment-data-layer, agent-document-context |

### Agent Intelligence

| Feature | Priority | Status | Dependencies |
|---------|----------|--------|--------------|
| [multi-agent-routing](multi-agent-routing.md) | P3 | completed | agent-integration |
| [autonomous-loop-execution](autonomous-loop-execution.md) | P3 | completed | workflow-engine, agent-integration |
| [multi-agent-swarm](multi-agent-swarm.md) | P3 | completed | workflow-engine, multi-agent-routing |
| [agent-self-improvement](agent-self-improvement.md) | P3 | planned | workflow-engine, multi-agent-routing, autonomous-loop-execution |

### Agent Profiles

| Feature | Priority | Status | Dependencies |
|---------|----------|--------|--------------|
| [agent-profile-catalog](agent-profile-catalog.md) | P3 | completed | multi-agent-routing |
| [workflow-blueprints](workflow-blueprints.md) | P3 | completed | multi-agent-routing, workflow-engine, agent-profile-catalog |

### UI Enhancement

| Feature                                                             | Priority | Status    | Dependencies                                                                                             |
| ------------------------------------------------------------------- | -------- | --------- | -------------------------------------------------------------------------------------------------------- |
| [ambient-approval-toast](ambient-approval-toast.md)                 | P1       | completed | app-shell, inbox-notifications, tool-permission-persistence                                              |
| [micro-visualizations](micro-visualizations.md)                     | P2       | completed | homepage-dashboard, monitoring-dashboard, project-management                                             |
| [command-palette-enhancement](command-palette-enhancement.md)       | P2       | completed | app-shell                                                                                                |
| [operational-surface-foundation](operational-surface-foundation.md) | P2       | completed | app-shell, homepage-dashboard, task-board, inbox-notifications, monitoring-dashboard, project-management |
| [profile-surface-stability](profile-surface-stability.md)           | P2       | completed | operational-surface-foundation, agent-profile-catalog                                                    |
| [accessibility](accessibility.md)                                   | P2       | completed | app-shell, task-board, workflow-engine, content-handling                                                |
| [ui-density-refinement](ui-density-refinement.md)                   | P2       | completed | operational-surface-foundation, app-shell, homepage-dashboard, inbox-notifications, project-management   |

### Platform

| Feature | Priority | Status | Dependencies |
|---------|----------|--------|--------------|
| [scheduled-prompt-loops](scheduled-prompt-loops.md) | P2 | completed | workflow-engine, agent-integration |
| [tool-permission-persistence](tool-permission-persistence.md) | P2 | completed | agent-integration, inbox-notifications |
| [provider-runtime-abstraction](provider-runtime-abstraction.md) | P1 | completed | agent-integration, inbox-notifications, monitoring-dashboard, session-management, tool-permission-persistence |
| [openai-codex-app-server](openai-codex-app-server.md) | P1 | completed | provider-runtime-abstraction |
| [npm-publish-readiness](npm-publish-readiness.md) | P3 | deferred | cli-bootstrap, database-schema, app-shell |
| [cross-provider-profile-compatibility](cross-provider-profile-compatibility.md) | P2 | completed | provider-runtime-abstraction, openai-codex-app-server, agent-profile-catalog |
| [parallel-research-fork-join](parallel-research-fork-join.md) | P2 | completed | workflow-engine, multi-agent-routing |
| [tauri-desktop](tauri-desktop.md) | P3 | started | cli-bootstrap, app-shell |

### Governance & Analytics

| Feature | Priority | Status | Dependencies |
|---------|----------|--------|--------------|
| [usage-metering-ledger](usage-metering-ledger.md) | P1 | completed | provider-runtime-abstraction, openai-codex-app-server, monitoring-dashboard |
| [spend-budget-guardrails](spend-budget-guardrails.md) | P1 | completed | usage-metering-ledger, inbox-notifications, provider-runtime-abstraction |
| [cost-and-usage-dashboard](cost-and-usage-dashboard.md) | P2 | completed | usage-metering-ledger, spend-budget-guardrails, micro-visualizations |

## Dependency Graph

Critical path through the MVP:

```
cli-bootstrap ─────────────────────────────────────────────┐
database-schema ──┬── project-management ── task-board ──┬──┤
app-shell ────────┘                                      │  │
                                          agent-integration ┤
                                                │           │
                              ┌─────────────────┼───────────┘
                              │                 │
                    inbox-notifications   monitoring-dashboard
                              │                 │
                    task-definition-ai    workflow-engine
                              │                 │
                    content-handling    session-management
```

Post-MVP document management chain:

```
content-handling (MVP, completed)
    └── file-attachment-data-layer (P1)
            ├── document-preprocessing (P2)
            │       ├── document-manager (P2)
            │       └── agent-document-context (P1)
            │               └── document-output-generation (P3)
            └── agent-document-context (P1)
```

- **Critical path**: database-schema → project-management → task-board → agent-integration → inbox-notifications / monitoring-dashboard
- **Foundation (parallel)**: cli-bootstrap, database-schema, app-shell can all be built simultaneously
- **Polish (parallel)**: P2 features are independent of each other, can be built in any order after agent-integration
- **Document Management**: file-attachment-data-layer unblocks all document features; preprocessing and agent-context can run in parallel
- **UI refinement track**: accessibility remains the active in-progress quality track; the cross-route density/composition follow-up is now completed

Provider runtime chain:

```
agent-integration + inbox-notifications + monitoring-dashboard
        + session-management + tool-permission-persistence
                                │
                                └── provider-runtime-abstraction
                                            ├── openai-codex-app-server
                                            └── cross-provider-profile-compatibility
                                             └── future provider-aware profile expansion
```

Cost governance chain:

```
provider-runtime-abstraction + openai-codex-app-server + monitoring-dashboard
                                │
                                └── usage-metering-ledger
                                           ├── spend-budget-guardrails
                                           └── cost-and-usage-dashboard
                                                     ▲
                                                     └── micro-visualizations
```

Workflow expansion chain:

```
workflow-engine + multi-agent-routing
                │
                └── parallel-research-fork-join
                          └── multi-agent-swarm
```

## Recommended Build Order

1. **Sprint 1 — Foundation**: cli-bootstrap + database-schema + app-shell (parallel)
2. **Sprint 2 — Core Data**: project-management + task-board
3. **Sprint 3 — Agent Core**: agent-integration
4. **Sprint 4 — Human Loop**: inbox-notifications + monitoring-dashboard (parallel)
5. **Sprint 5 — Polish**: homepage-dashboard (P1) + ux-gap-fixes (P1) + workflow-engine + task-definition-ai + content-handling (parallel, any order; session-management already completed)
6. **Sprint 6 — Document Foundation**: file-attachment-data-layer (P1) — unblocks all document features
7. **Sprint 7 — Document Processing**: document-preprocessing (P2) + agent-document-context (P1) (parallel)
8. **Sprint 8 — Document UI**: document-manager (P2)
9. **Sprint 9 — Document Outputs**: document-output-generation (P3, completed)
10. **Sprint 10 — UI Density Refinement**: ui-density-refinement (P2, completed)
11. **Sprint 11 — Runtime Foundation**: provider-runtime-abstraction (P1, completed)
12. **Sprint 12 — OpenAI Runtime**: openai-codex-app-server (P1, completed)
13. **Sprint 13 — Usage Metering Foundation**: usage-metering-ledger (P1, completed)
14. **Sprint 14 — Budget Enforcement**: spend-budget-guardrails (P1, completed)
15. **Sprint 15 — Cost Visibility**: cost-and-usage-dashboard (P2, completed)
16. **Sprint 16 — Profile Compatibility**: cross-provider-profile-compatibility (P2, completed)
17. **Sprint 17 — Human-Loop Attention**: ambient-approval-toast (P1, completed)
18. **Sprint 18 — Parallel Research Foundation**: parallel-research-fork-join (P2, completed)
19. **Sprint 19 — npm Publish Readiness**: npm-publish-readiness (P1, completed)
20. **Sprint 20 — Tauri Desktop Foundation**: tauri-desktop (P3, started)

## Open Questions

- **Agent SDK availability**: Need to verify the exact API surface of `@anthropic-ai/claude-agent-sdk` for `canUseTool`, `AskUserQuestion`, and streaming — feature specs are based on the documented SDK feature mapping in the ideas
- **Provider parity floor**: Define the minimum capability bar before exposing a user-facing runtime switch. Current recommendation: approvals/questions, resume, monitoring logs, workflows/schedules, and MCP compatibility must all be explicit.
- **OpenAI runtime parity**: Codex App Server is now the shipped OpenAI path. The remaining question is what capability floor should be required before exposing future OpenAI-adjacent runtime options or provider-expansion follow-ons.
- **Pricing source of truth**: Need a durable model-pricing strategy for Claude and Codex so historical usage rows preserve derived cost even if provider pricing changes later
- **Parallel workflow UX ceiling**: Need to decide how much branch configurability to expose in the first slice without turning the editor into a graph builder
- **Actionable notification channel policy**: Need to define when Stagent should escalate from in-app approval toast to browser or desktop-native notification delivery, especially for hidden tabs and future Tauri/macOS distributions
- **Drag-and-drop library**: Need to select a React DnD solution for the kanban board (react-beautiful-dnd, dnd-kit, or native HTML5 drag)
- **SSE vs WebSocket**: Monitoring dashboard uses SSE for streaming — need to confirm this works well with Next.js App Router API routes
- **UX design review**: Four features flagged for `/frontend-designer` review before implementation (app-shell, task-board, inbox-notifications, monitoring-dashboard, task-definition-ai, workflow-engine)
