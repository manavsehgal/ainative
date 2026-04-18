---
title: Claude Agent SDK Integration
status: completed
priority: P1
milestone: mvp
source: ideas/mvp-vision.md
dependencies: [database-schema, task-board]
---

# Claude Agent SDK Integration

## Description

The core integration with Claude Code via the Agent SDK (`@anthropic-ai/claude-agent-sdk`). This is what makes ainative more than a task board — it actually executes tasks by delegating them to Claude Code running as a library.

When a user queues a task, this feature picks it up, creates an Agent SDK session, executes the task with appropriate tools and permissions, streams progress to the agent_logs table, and updates the task status on completion or failure. It implements the human-in-the-loop pattern by routing `canUseTool` callbacks and `AskUserQuestion` events to the notification system.

MVP goes depth-first on Claude Code rather than broad across multiple agents. The architecture includes a routing stub for future extensibility.

## User Story

As a user, I want to assign a task to an AI agent and have it actually execute, so that I can delegate real work to Claude Code and monitor its progress from my task board.

## Technical Approach

- **SDK**: `@anthropic-ai/claude-agent-sdk` — Claude Code as a library
- **Execution model**: API route receives "execute task" request → creates Agent SDK session → runs with streaming → logs events → updates task status

### SDK Feature → UX Mapping

| ainative UX | Agent SDK Feature |
|---|---|
| Task execution | `query()` with `allowedTools` |
| Permission requests → Inbox | `canUseTool` callback → notification |
| Clarifying questions → Inbox | `AskUserQuestion` tool → notification |
| Streaming logs → Monitor | `includePartialMessages` streaming |
| Session resume | `resume: sessionId` |

### Core Architecture

```typescript
// src/lib/agents/claude-agent.ts
import { Agent } from "@anthropic-ai/claude-agent-sdk";

async function executeTask(task: Task) {
  const agent = new Agent({
    // Configure with task description as the prompt
    // Set allowedTools based on task type
    // Wire canUseTool to create notifications
    // Stream partial messages to agent_logs
  });

  const result = await agent.query(task.description, {
    includePartialMessages: true,
    canUseTool: async (toolCall) => {
      // Create a notification for the user
      // Wait for user response (allow/deny)
      // Return PermissionResultAllow or PermissionResultDeny
    },
  });

  // Update task status and store result
}
```

### API Routes

- `POST /api/tasks/[id]/execute` — start agent execution for a task
- `POST /api/tasks/[id]/respond` — user responds to a permission request or question
- `GET /api/tasks/[id]/logs` — stream agent logs (SSE endpoint)
- `POST /api/tasks/[id]/cancel` — cancel a running agent

### Human-in-the-Loop Flow

1. Agent encounters a tool call requiring permission
2. `canUseTool` callback creates a notification (type: `permission_required`)
3. Notification appears in the user's Inbox
4. User approves or denies
5. `POST /api/tasks/[id]/respond` sends the decision back
6. Agent continues or adjusts based on response

### Agent Routing Stub

```typescript
// src/lib/agents/router.ts
export function getAgent(agentType: string) {
  switch (agentType) {
    case "claude-code":
      return new ClaudeCodeAgent();
    // Future: case "codex": return new CodexAgent();
    default:
      return new ClaudeCodeAgent();
  }
}
```

### Session Management

- Store `sessionId` in the tasks table for resume capability
- Use `resume: sessionId` when retrying or continuing a task
- Sessions stored in `~/.ainative/sessions/`

## Acceptance Criteria

- [ ] Queued tasks can be executed by clicking "Run" or via API call
- [ ] Agent SDK creates a session and executes the task description as a prompt
- [ ] Agent progress is streamed and stored in the agent_logs table
- [ ] Task status updates automatically (queued → running → completed/failed)
- [ ] Permission requests from `canUseTool` create notifications visible in Inbox
- [ ] Clarifying questions from `AskUserQuestion` create notifications visible in Inbox
- [ ] Users can respond to permission requests (allow/deny) and questions
- [ ] Failed tasks can be retried, resuming the previous session
- [ ] Task result (agent output) is stored and viewable
- [ ] Agent routing stub exists for future multi-agent support

## Scope Boundaries

**Included:**
- Claude Agent SDK integration
- Task execution lifecycle (queue → run → complete/fail)
- `canUseTool` callback → notification pipeline
- `AskUserQuestion` → notification pipeline
- Agent log streaming to database
- Session creation and resume
- Agent routing stub

**Excluded:**
- Workflow orchestration (Sequence, Planner→Executor patterns — see `workflow-engine`)
- Monitoring dashboard UI (see `monitoring-dashboard`)
- Inbox UI for notifications (see `inbox-notifications`)
- Multi-agent routing logic (post-MVP)
- Codex or other agent integrations (post-MVP)

## References

- Source: `ideas/mvp-vision.md` — Agent Integration section, SDK Feature → UX Mapping, Human-in-the-Loop
- Source: `ideas/mvp-vision.md` — Building Effective Agents Principles
- Related features: `task-board` (UI for triggering execution), `inbox-notifications` (displays permission requests), `monitoring-dashboard` (displays streaming logs)
