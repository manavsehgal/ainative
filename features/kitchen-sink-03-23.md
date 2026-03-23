---
title: Kitchen Sink — Ongoing Improvements & Small Fixes
status: in-progress
priority: P3
milestone: post-mvp
source: user-feedback
dependencies: []
---

# Kitchen Sink — Ongoing Improvements & Small Fixes

## Description

A living document for collecting and tracking small UX improvements, bug fixes, and polish items that don't warrant individual feature specs. Issues are dated and categorized by area (chat, UI, navigation, performance, etc.). Each entry includes reproduction steps, context, and acceptance criteria.

This document is updated incrementally as issues are discovered during active use of Stagent. It serves as a low-friction way to capture gaps before they're groomed into formal sprints.

## User Stories

As a Stagent user, I want small friction points and polish issues to be systematically captured and fixed, so the app feels increasingly polished with each iteration.

As a product manager, I want a dated log of discovered issues so we can identify patterns (e.g., "navigation state is frequently lost") and prioritize high-impact fixes.

---

## Issues

### 1. Chat Conversation Persistence on Navigation (2026-03-23)

**Area**: Chat / Navigation

**Issue**: When actively chatting in the chat view, if the user navigates to any other view (Projects, Tasks, Documents, etc.) and returns to Chat, the conversation is reset and the chat appears blank instead of restoring the active conversation.

**Expected Behavior**:
- The active conversation ID should be persisted in URL or state
- Returning to Chat should restore the last-viewed conversation
- Conversation history should remain accessible

**Reproduction Steps**:
1. Navigate to Chat view
2. Start or load an existing conversation
3. Send a message
4. Click on a different sidebar item (e.g., Projects, Documents)
5. Return to Chat
6. **Actual**: Blank chat with no conversation history
7. **Expected**: Same conversation still displayed

**Root Cause**: Likely missing state persistence (localStorage, URL param, or client-side store) for `activeConversationId` when navigating away from chat.

**Acceptance Criteria**:
- [ ] Chat conversation ID is persisted when user leaves the chat view
- [ ] Returning to Chat restores the previously active conversation
- [ ] Conversation history is visible immediately (no loading spinner)
- [ ] Works across app reload (persists in localStorage or URL)
- [ ] Sidebar chat list shows which conversation is currently active

**Files to Check**:
- `src/app/chat/page.tsx`
- `src/components/chat/` (likely state management)
- Chat data layer hook (if exists)

**Priority**: High (impacts daily workflow)

**Effort**: Small (state management fix)

---

### 2. Configurable Max Turns & Timeout Sliders with Interactive Guidance (2026-03-23)

**Area**: Settings / UX

**Issue**: Max Turns and Max Timeout settings are currently static or unclear. Users need visual, interactive controls (sliders) with real-time guidance explaining what high and low values mean for their use case.

**Expected Behavior**:
- Max Turns slider (e.g., 1–50 turns) with labels showing "Quick Execution" (left) → "Extended Reasoning" (right)
- Max Timeout slider (e.g., 5s–300s) with labels showing "Fast Response" (left) → "Thorough Analysis" (right)
- Hover/focus tooltips explaining implications: "Low timeout = faster but less thorough. High timeout = thorough but slower."
- Current slider values displayed with units (e.g., "12 turns", "45 seconds")
- Optional: Small visual indicator showing "recommended range" for common tasks

**Reproduction Steps**:
1. Navigate to Settings
2. Find Max Turns and Max Timeout controls
3. **Actual**: Control type and guidance unclear
4. **Expected**: Interactive sliders with contextual help text visible

**Root Cause**: Settings lack interactive affordances and contextual guidance about the trade-offs between values.

**Acceptance Criteria**:
- [ ] Max Turns rendered as a slider (min: 1, max: 50, default: 10)
- [ ] Max Timeout rendered as a slider (min: 5s, max: 300s, default: 60s)
- [ ] Current value displayed next to each slider with units
- [ ] Hover tooltip explains left/right implications (speed vs. quality)
- [ ] "Recommended range" visual indicator (optional badge or shading)
- [ ] Changes persist to settings table on blur or explicit save
- [ ] Mobile-friendly slider interaction

**Files to Check**:
- `src/app/settings/page.tsx`
- `src/components/settings/` (likely has settings form components)
- `src/lib/constants/task-*.ts` (default values, ranges)

**Priority**: Medium (improves discoverability & user confidence)

**Effort**: Small (UI component + tooltip additions)

---

### 3. Workflow Resume/Retry Visibility & Task Hierarchy Clarity (2026-03-23)

**Area**: Workflows / Project Detail / Information Architecture

**Issue**: When a workflow fails mid-step, resume/retry controls are available from the project details page but are not obvious when viewing the workflow details page itself. Additionally, there's ambiguity about how tasks relate to workflows (task-centric vs. workflow-centric view), and orphaned tasks (tasks not belonging to any workflow) have unclear placement. Users also report seeing duplicate task listings in the project details view.

**Expected Behavior**:
- Workflow details page should prominently display resume/retry controls when in a failed/paused state
- Task hierarchy should be clear: is a task always part of a workflow, or can it exist independently?
- Orphaned tasks should either be hidden, listed separately at project level, or unified into a single task list view
- Each task should appear exactly once in any given list (no duplicates)
- Navigation between project tasks, workflow tasks, and orphaned tasks should be intuitive

**Reproduction Steps**:
1. Create a workflow with multiple steps
2. Execute the workflow and let it fail mid-step
3. Navigate to the workflow details page
4. **Actual**: Resume/retry controls not visible; user must navigate to project details to retry
5. Navigate to project details and observe the tasks list
6. **Actual**: Task appears multiple times or hierarchy is unclear
7. Check if orphaned tasks (not in any workflow) are visible at project level
8. **Expected**: Clear resume controls on workflow page, single task instances, obvious orphaned task handling

**Root Cause Possibilities**:
- Workflow details page layout doesn't account for failed/paused state UI
- Task queries at project level don't properly join workflows or filter duplicates
- Data model doesn't clearly define task-workflow relationship cardinality
- UI doesn't distinguish orphaned vs. workflow-bound tasks

**Architectural Brainstorm**:

**Option A: Unify into Workflow-Centric View**
- Project detail page shows only orphaned tasks
- All workflow-bound tasks live exclusively on workflow detail page
- Resume/retry controls always visible on workflow detail
- Orphaned tasks get a dedicated "Standalone Tasks" section at project level
- **Pro**: Clearer separation, less duplication
- **Con**: Split view might confuse users about where to find tasks

**Option B: Merge Project & Workflow Details into Unified Canvas**
- Single page shows both project-level orphaned tasks AND all workflows with their child tasks
- Resume/retry inline with workflow step view
- All tasks listed once with visual hierarchy (indented under workflow or marked "orphaned")
- **Pro**: Everything visible in one place, single source of truth
- **Con**: Dense UI, may overwhelm for large projects

**Option C: Keep Separate but Link Clearly**
- Workflow details page has prominent "Resume" button in header when failed
- Task duplicates fixed in queries
- Orphaned tasks listed at project level with clear label
- Both pages link to each other intelligently
- **Pro**: Minimal disruption to current structure
- **Con**: Requires navigation, not ideal for workflows

**Acceptance Criteria**:
- [ ] Workflow details page displays resume/retry controls when workflow status is failed/paused
- [ ] No duplicate tasks appear in any list view at project level
- [ ] Data model clearly defines whether tasks can exist outside workflows (nullable workflowId)
- [ ] Orphaned tasks are clearly labeled and placed (either hidden, in project view, or in separate section)
- [ ] Workflow detail page and project detail page don't both show the same task
- [ ] User can navigate from failed workflow to retry without visiting project details
- [ ] Architectural decision documented (which option was chosen and why)

**Files to Check**:
- `src/app/projects/[id]/page.tsx` (project detail layout)
- `src/app/workflows/[id]/page.tsx` (workflow detail layout)
- `src/components/projects/project-detail.tsx`
- `src/components/workflows/workflow-detail.tsx` (if exists)
- `src/lib/db/schema.ts` (task-workflow relationship)
- Task query builders (likely in `src/lib/data/tasks.ts` or similar)
- Workflow engine (how it creates/manages child tasks)

**Priority**: High (architectural decision that affects UX coherence)

**Effort**: Large (requires data model review + UI redesign + query refactoring)

**Notes**: This is a good candidate for a design review before implementation. Choosing between Options A, B, or C will reshape the information architecture significantly.

---

## Template for New Issues

```markdown
### [N]. [Short Title] (YYYY-MM-DD)

**Area**: [Chat / UI / Navigation / Performance / etc.]

**Issue**: [What's broken or suboptimal?]

**Expected Behavior**: [What should happen]

**Reproduction Steps**:
1. Step 1
2. Step 2
3. ...

**Root Cause**: [If known or suspected]

**Acceptance Criteria**:
- [ ] Criteria 1
- [ ] Criteria 2

**Files to Check**:
- `src/path/to/file.tsx`
- `src/path/to/other.ts`

**Priority**: [High / Medium / Low]

**Effort**: [Small / Medium / Large]
```

---

## Summary

| Count | Status |
|-------|--------|
| **Total Issues** | 3 |
| **Blocked** | 0 |
| **In Progress** | 0 |
| **Ready for Triage** | 3 |
