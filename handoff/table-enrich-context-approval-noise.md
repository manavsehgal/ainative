---
title: Table Enrich Context Approval Noise
audience: stagent-base
status: proposed
source_branch: growth-mgr
handoff_reason: Fix shared workflow learning and inbox notification behavior in the main repo.
---

# Table Enrich Context Approval Noise

## Summary

When `Table > Enrich` runs, operators can get 10+ separate approval requests for context learning proposals instead of one workflow-level batch review. After approving those proposals, the notification can remain visible in the Inbox instead of disappearing immediately.

This is not Growth-specific. The bug lives in shared runtime, workflow-learning, and notification UI code that belongs in base Stagent.

## User-facing symptoms

- running one enrich job across many rows creates many `context_proposal` approvals
- expected behavior is one `context_proposal_batch` review for the workflow run
- approving a context proposal or batch proposal does not make it disappear from the Inbox immediately
- this makes the approval queue look stale or broken even when the DB row has been responded to

## Why this belongs in base

The affected paths are shared:

- workflow child-task execution
- learned-context proposal extraction
- workflow learning-session batching
- inbox notification rendering/filtering

Any workflow that creates child tasks and uses learned-context proposals can hit the same race, but `Table > Enrich` makes it obvious because it fans out over many rows.

## Root cause

### 1. Workflow learning session closes before late proposal extraction finishes

Current flow:

1. enrich launches a row-driven loop workflow
2. workflow engine opens a learning session for that workflow
3. each child task completes
4. Claude runtime kicks off `analyzeForLearnedPatterns(...)` as fire-and-forget work
5. workflow engine sees the task finished and may close the learning session
6. late pattern extraction runs after the session is gone
7. proposal falls back to standalone `context_proposal` notification instead of being buffered into the batch

That produces the approval spam.

This is a timing bug, not a planner bug.

### 2. Inbox keeps responded learning notifications visible

Current inbox behavior loads all notifications and does not treat responded context-learning notifications as auto-resolved for list display.

So after approval:

- the DB row may already have `response` and `respondedAt`
- but the Inbox still renders the notification until a manual delete path is used

This reads to the user as "approval did not take".

## Affected shared areas

- `src/lib/agents/claude-agent.ts`
- `src/lib/agents/pattern-extractor.ts`
- `src/lib/agents/learning-session.ts`
- `src/lib/workflows/engine.ts`
- `src/components/notifications/inbox-list.tsx`
- `src/components/notifications/notification-item.tsx`
- `src/components/profiles/context-proposal-review.tsx`

Depending on main repo drift, equivalent runtime files may differ slightly, but the logic should be in the same shared area.

## Proposed fix

### 1. Keep learned-pattern extraction inside task completion lifecycle

For workflow child tasks, do not launch learned-pattern extraction as fire-and-forget.

Instead:

- `await analyzeForLearnedPatterns(taskId, profileId)` before final task cleanup/removal
- keep the existing `try/catch` so extraction failure never fails the task itself

Goal:

- learning session remains open until proposal extraction has either buffered the proposal or decided there is nothing to propose
- workflow close then produces one batch notification instead of many individual ones

Important constraint:

- this should remain non-fatal
- if learned-pattern extraction errors, log it and continue

### 2. Make responded learning notifications disappear from Inbox

Inbox behavior should treat these as resolved:

- `context_proposal`
- `context_proposal_batch`

Recommended behavior:

- filter out responded learning notifications from the default Inbox list
- after approving/rejecting, refresh the list and remove the notification immediately

This does not require deleting the DB row. It only requires not rendering already-responded learning notifications in the active queue.

### 3. Ensure Inbox item renders review actions for learning notifications

If the full Inbox item component does not already render:

- `ContextProposalReview` for `context_proposal`
- `BatchProposalReview` for `context_proposal_batch`

add those actions there as well, so the behavior is consistent between:

- pending approval host / toast
- full Inbox list

## Non-goals

- changing enrichment planning
- changing proposal extraction quality
- changing the learned-context schema
- deleting historical responded notifications from the database

## Acceptance criteria

- one enrich workflow across many rows produces at most one pending workflow-learning batch approval for that run
- individual `context_proposal` rows are not created for child-task proposals that belong to an active workflow learning session
- approving or rejecting a context proposal removes it from the Inbox without needing manual delete
- approving or rejecting a batch proposal removes it from the Inbox without needing manual delete
- existing permission-required notifications keep their current behavior

## Suggested implementation steps

1. Update Claude task execution/resume path to await learned-pattern extraction before final cleanup
2. Verify workflow learning session stays open long enough for child-task proposals to buffer
3. Update Inbox filtering so responded learning notifications do not render
4. Ensure notification item renders context proposal review controls
5. Add regression tests

## Suggested tests

### Runtime / workflow tests

- child task in a workflow triggers learned-pattern extraction before execution cleanup
- workflow child-task proposals created during active session are buffered instead of creating standalone `context_proposal` notifications
- workflow close creates one `context_proposal_batch` notification containing all buffered proposal IDs

### Inbox tests

- responded `context_proposal` does not appear in Inbox list
- responded `context_proposal_batch` does not appear in Inbox list
- approving a visible context proposal causes it to disappear after refresh
- approving a visible batch proposal causes it to disappear after refresh

## Notes for main repo port

The growth branch already touched shared files to validate the fix, but the proper destination is the main repo because the behavior is part of the base workflow/notification system.

Port the behavior, not necessarily the exact patch, if main has drifted.
