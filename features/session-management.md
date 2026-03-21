---
title: Agent Session Management
status: completed
priority: P2
milestone: mvp
source: ideas/mvp-vision.md
dependencies: [agent-integration]
---

# Agent Session Management

## Description

Manage Agent SDK sessions — creating, resuming, and cleaning up sessions. When a task is executed, a session is created and its ID is stored with the task. If a task fails or needs continuation, the session can be resumed with `resume: sessionId` to maintain conversation context.

This implements the Hybrid Sessions pattern from the Agent SDK hosting docs: ephemeral sessions hydrated with state, spin down when complete, resume when user returns.

## User Story

As a user, I want to resume a failed or interrupted agent task without losing the agent's previous context, so that I don't have to start over from scratch.

## Technical Approach

- **Session storage**: `~/.stagent/sessions/` directory for Agent SDK session data
- **Session ID**: Stored in `tasks` table (add `sessionId` column)
- **Resume flow**: When retrying a failed task, pass `resume: sessionId` to the Agent SDK
- **Cleanup**: Completed task sessions can be cleaned up after a configurable retention period
- **API**: `POST /api/tasks/[id]/resume` — resume execution from the saved session

### Session Lifecycle

```
Task Created → No Session
Task Executed → Session Created (ID stored in task)
Task Completed → Session retained for reference
Task Failed → Session available for resume
Task Resumed → Same session continues
Session Cleanup → Old completed sessions removed
```

## Acceptance Criteria

- [ ] Each task execution creates an Agent SDK session and stores the session ID
- [ ] Failed tasks can be resumed, continuing from the previous session context
- [ ] Resumed sessions maintain previous conversation history and tool state
- [ ] Session files are stored in `~/.stagent/sessions/`
- [ ] Old sessions (completed tasks >7 days) can be cleaned up
- [ ] Session resume works correctly across app restarts

## Scope Boundaries

**Included:**
- Session creation and ID storage
- Session resume for failed/interrupted tasks
- Session file storage in `~/.stagent/sessions/`
- Basic session cleanup

**Excluded:**
- Session analytics or replay
- Cross-device session sync
- Session forking (branching from a point in history)
- Hosted container sessions (post-MVP)

## References

- Source: `ideas/mvp-vision.md` — Hosting: Local-First with Path to Hosted, Hybrid Sessions pattern
- Source: `ideas/mvp-vision.md` — SDK Feature → UX Mapping (Session resume/continue)
- Related features: `agent-integration` (creates and uses sessions)
