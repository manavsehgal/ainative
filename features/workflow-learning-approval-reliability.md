---
title: Workflow Learning Approval Reliability
status: planned
priority: P1
milestone: post-mvp
source: handoff/table-enrich-context-approval-noise.md
dependencies:
  - workflow-context-batching
  - inbox-notifications
  - learned-context-ux-completion
---

# Workflow Learning Approval Reliability

## Description

ainative already batches learned-context proposals at the workflow level, but the current runtime still leaks individual proposal notifications when child-task pattern extraction finishes after the workflow learning session has already closed. Table enrichment makes this obvious because one workflow can fan out over many rows, but the failure mode belongs to the shared workflow-learning pipeline rather than the enrichment planner itself.

The Inbox also treats responded learning notifications as still-active items. After an operator approves or rejects a context proposal, the underlying notification row is updated, but the default Inbox list continues to render it. That makes the approval queue look stale and undermines trust in the review flow.

This follow-up hardens the shared runtime and notification queue so workflow-scoped learning behaves like one reviewable batch, and responded learning items disappear from the active Inbox immediately without deleting historical records.

## User Story

As an operator running multi-row enrichments or other child-task workflows, I want one workflow-level learning review and immediate Inbox cleanup after I respond, so the approval flow feels trustworthy instead of noisy or stale.

## Technical Approach

- Update `src/lib/agents/claude-agent.ts` so completed task execution and resume paths await `analyzeForLearnedPatterns()` before final execution cleanup, while keeping extraction failures non-fatal and explicitly logged.
- Preserve the current `src/lib/agents/learning-session.ts` batching model, but ensure the learning session stays open long enough for late child-task extraction to buffer proposal row IDs before `closeLearningSession()` flushes the batch notification.
- Keep `src/lib/agents/pattern-extractor.ts` responsible for deciding between workflow-session buffering and standalone proposal creation; this slice changes timing reliability, not extraction quality or proposal formatting.
- Update Inbox data loading and active-list filtering so responded `context_proposal` and `context_proposal_batch` notifications are treated as resolved by default while remaining stored in `notifications`.
- Render `ContextProposalReview` for `context_proposal` and `BatchProposalReview` for `context_proposal_batch` inside the full Inbox item surface so approval behavior matches the pending-approval host.
- Keep existing approval endpoints and payload shapes unchanged:
  - `PATCH /api/profiles/[id]/context`
  - `POST /api/context/batch`

## Acceptance Criteria

- [ ] Completed workflow child tasks await learned-pattern extraction before execution cleanup removes their runtime state.
- [ ] Child-task proposals created while a workflow learning session is still active are buffered into that session instead of creating standalone `context_proposal` notifications.
- [ ] One workflow run produces at most one pending `context_proposal_batch` notification for its buffered proposals.
- [ ] Table enrichment across many rows no longer creates approval spam when workflow child tasks finish close to session shutdown.
- [ ] Responded `context_proposal` notifications do not appear in the default Inbox list or default notifications fetch.
- [ ] Responded `context_proposal_batch` notifications do not appear in the default Inbox list or default notifications fetch.
- [ ] Approving or rejecting an individual context proposal removes it from the visible Inbox immediately after refresh.
- [ ] Approving or rejecting a batch proposal removes it from the visible Inbox immediately after refresh.
- [ ] Existing `permission_required` notification behavior and Inbox rendering remain unchanged.

## Scope Boundaries

**Included:**
- Workflow child-task extraction timing hardening
- Workflow learning-session close behavior
- Active Inbox filtering for responded learning notifications
- Full Inbox review actions for learning notifications
- Regression coverage for runtime batching and Inbox resolution behavior

**Excluded:**
- Table enrichment planner changes
- Proposal extraction heuristics or quality tuning
- Learned-context schema changes
- New approval routes or payload contracts
- Deleting historical responded notifications from the database

## References

- Source: `handoff/table-enrich-context-approval-noise.md`
- Related features: `workflow-context-batching`, `inbox-notifications`, `learned-context-ux-completion`, `tables-enrichment-planner-ux`
