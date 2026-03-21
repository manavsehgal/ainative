---
title: AI-Guided Task Definition
status: completed
priority: P2
milestone: mvp
source: ideas/mvp-vision.md
dependencies: [agent-integration, task-board]
---

# AI-Guided Task Definition

## Description

When creating a task or project, an integrated AI assistant helps the user write better task descriptions that agents can execute effectively. It suggests task breakdowns from high-level goals, recommends workflow patterns, estimates complexity, and flags tasks that need human checkpoints.

This uses the Agent SDK's `AskUserQuestion` tool with structured options to create a conversational task definition experience within the create dialog.

## User Story

As a non-technical user, I want AI assistance when defining tasks so that my descriptions are clear enough for agents to execute well, and complex goals get broken down into manageable steps.

## Technical Approach

- **Integration point**: Enhanced task create dialog with an "AI Assist" toggle
- **AI capabilities**:
  - Take a high-level goal and suggest a task breakdown (multiple tasks)
  - Improve a task description for agent clarity
  - Recommend which workflow pattern fits (sequence, planner→executor)
  - Estimate complexity (simple/moderate/complex)
  - Flag tasks needing human checkpoints
- **SDK mechanism**: Use `AskUserQuestion` with structured options for the back-and-forth
- **API route**: `POST /api/tasks/assist` — sends user's draft to the agent, returns suggestions

### UX Flow

1. User starts creating a task, types a rough description
2. Clicks "AI Assist" button
3. Agent analyzes the description and returns suggestions (breakdown, improved description, recommended pattern)
4. User reviews suggestions and accepts/modifies
5. Accepted tasks are created on the board

### Components

- `AIAssistPanel` — side panel in the create dialog showing AI suggestions
- `TaskBreakdownPreview` — shows suggested sub-tasks with accept/reject per item
- `DescriptionImprover` — shows original vs. improved description

### UX Considerations

- Flag for `/frontend-designer` review: AI assist panel interaction flow, suggestion acceptance UX, and how this integrates with the create dialog need design input

## Acceptance Criteria

- [ ] Task create dialog has an "AI Assist" toggle/button
- [ ] AI can suggest a task breakdown from a high-level goal
- [ ] AI can improve a task description for agent execution clarity
- [ ] AI suggests a workflow pattern (sequence, planner→executor) when appropriate
- [ ] User can accept, modify, or reject each suggestion
- [ ] Accepted sub-tasks are created on the board
- [ ] AI assist works without blocking regular task creation (it's an optional enhancement)
- [x] Sub-task creation shows per-task progress toasts and reports failures (I6)
- [x] AI Assist shows animated progress bar with rotating activity messages during loading (I7)

## Scope Boundaries

**Included:**
- AI-assisted task creation within the create dialog
- Task breakdown suggestions
- Description improvement
- Workflow pattern recommendation
- Complexity estimation

**Excluded:**
- Fully autonomous project planning (user always reviews and approves)
- Template library (predefined task templates)
- Learning from past tasks to improve suggestions

## References

- Source: `ideas/mvp-vision.md` — Project & Task Definition (AI-Guided) section
- Source: `ideas/mvp-vision.md` — SDK Feature → UX Mapping (AskUserQuestion)
- Related features: `task-board` (where created tasks appear), `agent-integration` (provides the AI backend)
