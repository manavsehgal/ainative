---
title: Multi-Agent Smart Routing
status: completed
priority: P3
milestone: post-mvp
source: ideas/mvp-vision.md, ideas/stagent-vision.md
dependencies: [agent-integration]
---

# Multi-Agent Smart Routing

## Description

Route tasks to specialized agent configuration profiles within the Claude Agent SDK. Each profile defines a system prompt template, allowed tools, MCP server configs, canUseTool policy, and model hints — enabling a single Claude agent to behave differently per task type.

Profiles cover both work domains (code review, research, document generation) and personal domains (wealth management, health/fitness, travel, shopping). A task type classifier auto-selects the appropriate profile; users can override manually.

This replaces the earlier Codex MCP / multi-provider routing design. Multi-provider routing added high complexity for low user value; profile-based routing delivers meaningful differentiation using the existing Agent SDK surface.

## User Story

As a user, I want Stagent to automatically select the right agent profile for each task — so a code review task gets a thorough, security-focused agent, a research task gets a web-searching explorer, and a document task gets a structured writer — without me configuring each one manually.

## Technical Approach

### Agent Profile Registry

Create `src/lib/agents/profiles/` directory:

- **Profile interface**: Each profile defines `id`, `name`, `description`, `systemPrompt` (template string), `allowedTools` (string[]), `mcpServers` (SDK config), `canUseToolPolicy` (auto-approve list), `temperature` hint, `tags` (for classification matching)
- **Registry module**: `src/lib/agents/profiles/registry.ts` — loads and exports all profiles, provides lookup by ID and tag-based search
- **Starter profiles** (shipped with this feature):
  - `general` — default, balanced profile (current behavior)
  - `code-reviewer` — security-focused, reads files, runs tests, structured findings format
  - `researcher` — web search enabled, citation-focused, summarization prompts
  - `document-writer` — structured output, markdown/report templates, style-consistent

### Task Type Classifier

- **Router expansion**: `src/lib/agents/router.ts` — add `classifyTaskProfile(task)` function
- **Classification strategy**: keyword/intent matching against profile tags (title + description analysis)
- **Fallback**: defaults to `general` if no strong match

### Schema Addition

- Add `agentProfile` text column to tasks table (nullable, defaults to `"general"`)
- Migration + bootstrap DDL update

### Execution Integration

- **Profile injection**: In `claude-agent.ts` (`executeClaudeTask` / `resumeClaudeTask`), resolve the task's profile from the registry → prepend profile system prompt to task prompt, pass `allowedTools` and `mcpServers` to `query()` options
- **Logging**: Log selected profile in agent_logs for monitoring visibility

### Workflow Integration

- Add optional `agentProfile` field to `WorkflowStep` type in `src/lib/workflows/types.ts`
- `engine.ts` passes step-level profile when creating child tasks, falling back to parent task's profile

### UI Integration

- **Task creation**: Profile selector dropdown (populated from registry)
- **Task detail**: Show active profile as badge
- **Monitoring**: Profile name in log entries and filter option

## Acceptance Criteria

- [ ] Profile registry loads 4 starter profiles (general, code-reviewer, researcher, document-writer)
- [ ] Each profile defines system prompt, allowed tools, and tags
- [ ] Task classifier auto-selects a profile based on task title and description
- [ ] Users can manually select a profile during task creation (dropdown)
- [ ] Users can override the auto-selected profile on any task
- [ ] Selected profile's system prompt is prepended to the task prompt during execution
- [ ] Profile's allowed tools and MCP servers are passed to the Agent SDK `query()` call
- [ ] Workflow steps can specify an `agentProfile` that overrides the parent task's profile
- [ ] Profile selection is logged in agent_logs and visible in the monitoring dashboard
- [ ] `agentProfile` column exists on tasks table with default value `"general"`

## Scope Boundaries

**Included:** Profile registry with 4 starter profiles, auto-classification, manual override, workflow step profiles, monitoring integration, schema migration

**Excluded:**
- Multi-provider routing (Codex, Vercel AI SDK) — removed from scope
- Profile marketplace or community sharing
- Profile learning/adaptation (agents modifying their own profiles)
- Domain-specific profiles beyond the 4 starters (see future specs below)

**Future specs (noted, not built here):**
- [`agent-profile-catalog`](agent-profile-catalog.md) — comprehensive domain profiles (wealth, health, travel, shopping, project manager, etc.)
- [`workflow-blueprints`](workflow-blueprints.md) — pre-configured workflow templates paired with agent profiles

## References

- Source: `ideas/mvp-vision.md` — Future Extensibility section
- Source: `ideas/stagent-vision.md` — smart routing concept
- Related features: `agent-integration` (provides execution infrastructure), `workflow-engine` (step-level profile support)
- Architecture: Profile injection at `claude-agent.ts` lines 155-175; router expansion at `router.ts`
