---
title: Smart Runtime Router
status: completed
priority: P1
milestone: post-mvp
source: ideas/direct-api-gap-analysis.md
dependencies: [anthropic-direct-runtime, openai-direct-runtime, multi-agent-routing]
---

# Smart Runtime Router

## Description

With 4 runtimes in the catalog, manual runtime selection becomes a burden. Today, runtime selection is purely manual — users pick from a dropdown or get the default (`claude-code`). Profile auto-detection exists via keyword matching (`classifyTaskProfile()` in `router.ts`), but runtime selection is decoupled from it.

This feature adds `suggestRuntime()` alongside the existing `classifyTaskProfile()` to automatically select the best runtime based on task content, profile affinity, user preferences, and available runtimes. Users always retain manual override capability.

## User Story

As a Stagent user with multiple runtimes configured, I want the system to automatically select the best runtime for each task so that I get optimal cost, latency, and capability matching without manually choosing every time.

## Technical Approach

### Core: `suggestRuntime()` Function

Add to `src/lib/agents/router.ts`:

```typescript
function suggestRuntime(
  title: string,
  description: string | undefined,
  profileId: string,
  availableRuntimes: AgentRuntimeId[],
  preferences: { optimize: "cost" | "latency" | "quality" | "manual" }
): { runtimeId: AgentRuntimeId; reason: string }
```

**Selection algorithm:**
1. If `preferences.optimize === "manual"` → return default runtime (no suggestion)
2. If resolved profile has `preferredRuntime` → use it (profile affinity)
3. Score available runtimes by keyword signals from title/description:
   - File/code keywords ("edit", "file", "refactor", "debug") → `claude-code`
   - Research keywords ("research", "search", "investigate") → `anthropic-direct`
   - Data keywords ("analyze", "compute", "chart", "data") → `openai-direct`
   - Document keywords ("write", "summarize", "report") → `anthropic-direct`
   - Image keywords ("image", "visual", "design") → `openai-direct`
   - Sandbox keywords ("sandbox", "isolated", "safe") → `openai-codex`
4. Apply user preference tiebreaker:
   - `"cost"` → prefer cheapest available (direct APIs with smallest model)
   - `"latency"` → prefer direct APIs (no subprocess)
   - `"quality"` → prefer SDK runtimes (battle-tested prompts)
5. Filter to only runtimes with configured API keys / installed CLIs
6. Return best match with human-readable reason string

### Profile Affinity

Add optional `preferredRuntime` to profile config (`profile.yaml`):

```yaml
# profiles/builtins/researcher/profile.yaml
supportedRuntimes:
  - claude-code
  - anthropic-direct
  - openai-direct
preferredRuntime: anthropic-direct  # NEW — server-side web search + citations
```

Default affinities for built-in profiles:

| Profile | Preferred Runtime | Why |
|---------|------------------|-----|
| `general` | `anthropic-direct` | Fast, cost-effective, no file ops needed |
| `code-reviewer` | `claude-code` | Needs file system tools |
| `researcher` | `anthropic-direct` | Server-side web search + citations |
| `document-writer` | `anthropic-direct` | Extended thinking + prompt caching |

### Workflow Step Routing

Extend workflow step configuration to support `"auto"` as runtime value:
- When a workflow step has `assignedAgent: "auto"`, resolve runtime at execution time via `suggestRuntime()`
- Each step in a workflow can use a different runtime — the mayor plans on a fast/cheap runtime, workers execute on capability-appropriate runtimes

### Settings: Routing Preference

Add a `routingPreference` setting to the settings table:
- Values: `"cost"` | `"latency"` | `"quality"` | `"manual"`
- Default: `"latency"` (most users will appreciate speed)
- Exposed in Settings UI as a radio group with descriptions

### UI Changes

| Component | Change |
|-----------|--------|
| Task create panel (`task-create-panel.tsx`) | Runtime dropdown default → "Auto (recommended)" instead of hardcoded "Claude Code" |
| Runtime dropdown | Show auto-selected runtime with reason: "Anthropic Direct — no file tools needed, optimizing for speed" |
| Workflow step editor | Add "Auto" option to per-step runtime selector |
| Settings page | Add "Runtime Routing Preference" radio group |

### Files to Modify

| File | Change |
|------|--------|
| `src/lib/agents/router.ts` | Add `suggestRuntime()` function |
| `src/lib/agents/profiles/types.ts` | Add optional `preferredRuntime` to `AgentProfile` type |
| `src/lib/agents/profiles/builtins/*/profile.yaml` | Add `preferredRuntime` where appropriate |
| `src/lib/agents/profiles/registry.ts` | Parse `preferredRuntime` from profile.yaml |
| `src/components/tasks/task-create-panel.tsx` | Change default to "Auto", show reason |
| `src/components/workflows/workflow-step-editor.tsx` | Add "Auto" runtime option |
| `src/app/api/tasks/[id]/execute/route.ts` | Call `suggestRuntime()` when runtime is "auto" |
| `src/lib/workflows/engine.ts` | Resolve "auto" runtime per step at execution time |
| Settings schema + UI | Add `routingPreference` setting |

## Acceptance Criteria

- [ ] `suggestRuntime()` returns a runtime ID + human-readable reason for any task
- [ ] Task creation defaults to "Auto (recommended)" instead of "Claude Code"
- [ ] Auto-selected runtime shown in UI with reason text (e.g., "Using Anthropic Direct — research task, optimizing for speed")
- [ ] User can override auto-selection by manually choosing a runtime
- [ ] Profile `preferredRuntime` is respected when set
- [ ] Keyword signals correctly route: file tasks → claude-code, research → anthropic-direct, data → openai-direct
- [ ] User routing preference (cost/latency/quality/manual) affects selection
- [ ] Only runtimes with valid credentials offered (no suggesting unconfigured runtimes)
- [ ] Workflow steps support "auto" runtime with per-step resolution at execution time
- [ ] Existing manual runtime selection still works unchanged

## Scope Boundaries

**Included:**
- `suggestRuntime()` function with keyword + profile affinity + preference logic
- Profile `preferredRuntime` field
- Settings `routingPreference` option
- Task create UI default change
- Workflow step auto-routing

**Excluded:**
- ML/LLM-based task classification (keyword matching is sufficient for v1)
- Runtime fallback/escalation mid-task (future enhancement)
- Cross-runtime A/B testing framework (future feature)
- Runtime comparison dashboard (separate UI feature)

## References

- Source: `ideas/direct-api-gap-analysis.md` — Section 3 "Smart Runtime Selection (Auto-Routing)"
- Existing pattern: `classifyTaskProfile()` in `src/lib/agents/router.ts`
- Existing pattern: `profileSupportsRuntime()` in `src/lib/agents/profiles/compatibility.ts`
- Related features: depends on both direct runtimes being available to route to
