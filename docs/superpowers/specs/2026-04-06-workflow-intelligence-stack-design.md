# Workflow Intelligence Stack — Design Spec

**Date:** 2026-04-06
**Scope:** EXPAND — reactive fixes + proactive optimization
**Source:** `ideas/analysis-chat-issues.md` (9 cascading failures from investor research session)
**Approach:** 4 features, 2 phases (A — Close the Gaps, then Intelligence Stack)

---

## Context

A real user session — researching seed investors for ainative with a 3-step workflow and 6 attached documents — surfaced 9 cascading failures across workflow execution, budget management, model routing, and chat intelligence. Every execution attempt failed. Investigation revealed that much of the required infrastructure already exists but is not wired to user-facing surfaces (dead constants, unexposed DB columns, unused function parameters). Beyond fixing these gaps, we're expanding into proactive workflow optimization: a co-pilot that generates optimal definitions, a live execution dashboard, embedded debugging, and execution-informed learning from past runs.

---

## Phase 1 — Close the Gaps (P1, parallel features)

### Feature 1: Workflow Budget Governance

**Problem:** `WORKFLOW_STEP_MAX_BUDGET_USD = 5.0` is dead code. All steps use `DEFAULT_MAX_BUDGET_USD = 2.0`. Budget settings aren't writable via chat. No pre-flight cost warning exists.

**Design:**

Budget resolution precedence (highest to lowest):
1. Per-task override (future: `workflow.definition.budget`)
2. User setting: `budget_max_cost_per_task`
3. Workflow constant: `WORKFLOW_STEP_MAX_BUDGET_USD` ($5)
4. Default: `DEFAULT_MAX_BUDGET_USD` ($2)

Pre-flight estimation flow:
```
executeWorkflow() → estimateWorkflowCost()
  ├─ For each step: calculate document context size
  ├─ Estimate input tokens via estimateTokens(text)
  ├─ Project cost = tokens × model pricing lookup
  ├─ Compare projected vs budget cap
  │   OVER → store warning in workflow _state.costEstimate
  │          (advisory — does not block execution)
  │          UI: WorkflowStatusView shows warning banner before run
  │          Chat: execute_workflow tool response includes warning text
  │   OK   → proceed
  └─ Store estimate in workflow _state.costEstimate for UI display
```

**Changes:**

| File | Change | Risk |
|------|--------|------|
| `src/lib/workflows/engine.ts` | Import `WORKFLOW_STEP_MAX_BUDGET_USD`, pass as `maxBudgetUsd` to `executeChildTask` | Low |
| `src/lib/agents/claude-agent.ts` | Accept optional `maxBudgetUsd` param in `executeClaudeTask`/`resumeClaudeTask`, override `DEFAULT_MAX_BUDGET_USD` | Low |
| `src/lib/chat/tools/settings-tools.ts` | Add `budget_max_cost_per_task` (positive number, max 50), `budget_max_tokens_per_task` (positive int), `budget_max_daily_cost` (positive number) to `WRITABLE_SETTINGS` | Low |
| `src/lib/workflows/engine.ts` | Add `estimateWorkflowCost()` — pre-flight estimation before execution | Medium |
| `src/lib/documents/context-builder.ts` | Export `estimateStepTokens(workflowId, stepId)` for pre-flight use | Low |
| `src/lib/agents/claude-agent.ts` | Read `budget_max_cost_per_task` setting, use as override when present | Low |

**Acceptance Criteria:**
- [ ] Workflow steps use $5 budget by default (not $2)
- [ ] `budget_max_cost_per_task` is writable via `set_settings` chat tool
- [ ] `budget_max_tokens_per_task` and `budget_max_daily_cost` are writable
- [ ] User budget setting overrides the $5 constant when set
- [ ] Pre-flight estimation calculates per-step token cost from document context
- [ ] Estimation stored in workflow `_state` for UI consumption
- [ ] Chat tool `set_settings` validates budget values (positive, max 50 for cost)

---

### Feature 2: Workflow Runtime & Model Configuration

**Problem:** Workflows can't specify runtime. 5 adapters exist but chat can't discover them. Model IDs are fragmented across 3 registries. Chat hallucinates about models.

**Design:**

Unified model catalog — extend `RuntimeCatalogEntry`:
```typescript
// catalog.ts — add to RuntimeCatalogEntry interface
models: {
  default: string;           // e.g., "gpt-5.4"
  supported: string[];       // e.g., ["gpt-5.4", "gpt-5.4-mini", "gpt-5.3-codex"]
}
```

Runtime resolution precedence:
1. Step agent profile `preferredRuntime` (existing)
2. `workflow.runtimeId` (new column)
3. System `routing.preference` setting (existing)
4. `DEFAULT_AGENT_RUNTIME` (existing)

**Changes:**

| File | Change | Risk |
|------|--------|------|
| `src/lib/db/schema.ts` | Add `runtimeId` text column to workflows table (nullable) | Low |
| `src/lib/db/bootstrap.ts` | Add `runtime_id` to CREATE TABLE for workflows | Low |
| Migration `00XX_add_workflow_runtime.sql` | `ALTER TABLE workflows ADD COLUMN runtime_id TEXT` | Low |
| `src/lib/agents/runtime/catalog.ts` | Add `models: { default, supported[] }` to `RuntimeCatalogEntry` and each registered runtime | Low |
| `src/lib/agents/runtime/openai-direct.ts` | Replace `?? "gpt-4.1"` with `catalog.models.default` | Low |
| `src/lib/agents/runtime/anthropic-direct.ts` | Replace `?? "claude-sonnet-4-20250514"` with `catalog.models.default` | Low |
| `src/lib/chat/tools/workflow-tools.ts` | Add `runtime` param to `create_workflow` tool, save to `workflows.runtimeId` | Low |
| `src/lib/workflows/engine.ts` | Read `workflow.runtimeId`, pass to `executeTaskWithRuntime(taskId, runtimeId)` | Low |
| `src/lib/chat/tools/` (new file) | New `list_runtimes` tool — returns catalog with models, capabilities | Low |
| `src/lib/chat/tools/settings-tools.ts` | Tag each key in `get_settings` response with `writable: true/false` | Low |
| `src/lib/chat/types.ts` | Derive `CHAT_MODELS` from catalog or validate at startup | Medium |

**Acceptance Criteria:**
- [ ] `RuntimeCatalogEntry` has `models.default` and `models.supported[]`
- [ ] Adapter fallbacks use `catalog.models.default` (no hardcoded model strings)
- [ ] `workflows` table has nullable `runtime_id` column
- [ ] `create_workflow` tool accepts optional `runtime` parameter
- [ ] Workflow execution passes `runtimeId` to `executeTaskWithRuntime`
- [ ] `list_runtimes` chat tool returns all 5 runtimes with models and capabilities
- [ ] `get_settings` response tags each key with `writable: true/false`
- [ ] `CHAT_MODELS` is validated against catalog at startup (no stale model IDs)

---

### Feature 3: Workflow Execution Resilience

**Problem:** 4 compounding state machine failures: step state written before task creation, errors swallowed, re-execution blocked for crashed workflows, `updateWorkflowState` silent on missing workflow. Per-step document binding exists in DB but isn't exposed.

**Design:**

State machine fix — deferred writes + explicit rollback:
```
BEFORE: write state → create task → execute (failure = stuck state)
AFTER:  create task → execute → write state (failure = rollback to "failed")
```

Re-execution from any terminal-ish state:
```
draft → active                          (normal)
completed|failed → reset → draft → active (re-execute)
active (no live tasks) → reset → draft → active (crash recovery)

Reset procedure:
  1. Cancel orphaned tasks (status IN running, queued)
  2. Delete _state and _loopState from definition
  3. Reset ALL step states to "pending"
  4. Set workflow status to "draft"
  5. Atomic claim to "active"
```

Per-step document binding:
```
create_workflow({
  steps: [
    { name: "Step 1", prompt: "...", documentIds: ["doc1", "doc2"] },  // step-scoped
    { name: "Step 2", prompt: "...", documentIds: ["doc3"] }
  ],
  documentIds: ["doc4"]  // global — available to all steps
})

// DB: workflowDocumentInputs
// stepId = null → global, stepId = "step-uuid" → step-scoped
// buildPoolDocumentContext(workflowId, stepId) already handles both!
```

**Changes:**

| File | Change | Risk |
|------|--------|------|
| `src/lib/workflows/engine.ts` | Defer step state write until after task creation + execution start | **High** — core state machine |
| `src/lib/workflows/engine.ts` | Add explicit rollback in catch: step → "failed", error propagated | Medium |
| `src/lib/workflows/engine.ts` | Make `updateWorkflowState` throw on missing workflow | Medium |
| `src/app/api/workflows/[id]/execute/route.ts` | Allow re-execution from "active" if no live tasks (query tasks table) | Medium |
| `src/app/api/workflows/[id]/execute/route.ts` | On re-execute: reset ALL step states, cancel orphaned tasks | Medium |
| `src/lib/chat/tools/workflow-tools.ts` | Accept per-step `documentIds` in step definitions, write to `workflowDocumentInputs` with stepId | Low |

**Error & Rescue Registry:**

| Error | Trigger | Rescue |
|-------|---------|--------|
| Step stuck "running" | Task creation fails after state write | Deferred state write |
| Error swallowed silently | `executeTaskWithRuntime` throws | Explicit rollback + propagate |
| 409 on crashed workflow | Workflow "active" with no live tasks | Check live task count before blocking |
| State update lost | Workflow deleted mid-execution | `updateWorkflowState` throws |
| All docs every step | No per-step binding in tool | Expose `step.documentIds` |

**Acceptance Criteria:**
- [ ] Step state is NOT written to DB until task creation succeeds
- [ ] If `executeTaskWithRuntime` throws, step state is rolled back to "failed" with error message
- [ ] `updateWorkflowState` throws a named error when workflow is missing
- [ ] Workflows in "active" state with 0 running/queued tasks can be re-executed
- [ ] Re-execution resets ALL step states to "pending" and cancels orphaned tasks
- [ ] `create_workflow` accepts per-step `documentIds` arrays
- [ ] Global `documentIds` and step-scoped `documentIds` coexist correctly
- [ ] `buildPoolDocumentContext` returns global + step-specific docs when both exist

---

## Phase 2 — Intelligence Stack (P2, after Phase 1 stabilizes)

### Feature 4: Workflow Intelligence & Observability

**Dependencies:** Features 1-3 must be stable. Also depends on: `usage-metering-ledger`, `monitoring-dashboard`.

#### Sub-capability A: Workflow Optimizer Co-pilot

**UX:** DetailPane (right-rail panel on desktop, Sheet on mobile) inside WorkflowFormView. Shows real-time suggestions as user edits workflow definition. 4 suggestion types:

1. **Document Binding** — analyzes step prompts vs document content, recommends per-step binding instead of global. Shows reduction: "6 docs × 3 steps = 18 injections → only 7 needed"
2. **Budget Estimate** — progress bar showing projected cost vs cap, per-step breakdown
3. **Runtime Recommendation** — based on past success rates per runtime for similar workflows
4. **Pattern Insight** — compares pattern options with historical performance data

Each suggestion has Apply/Dismiss actions. Apply modifies the form state directly.

**Data source:** `workflowExecutionStats` aggregate table (see Sub-capability D).

**API:** New endpoint `GET /api/workflows/optimize` — accepts partial workflow definition, returns suggestions array.

**Changes:**

| File | Change |
|------|--------|
| `src/components/workflows/workflow-form-view.tsx` | Add optimizer DetailPane panel, wire to suggestions API |
| `src/app/api/workflows/optimize/route.ts` (new) | Optimization suggestions endpoint |
| `src/lib/workflows/optimizer.ts` (new) | `getWorkflowOptimizationHints(definition)` — queries execution stats, generates suggestions |

#### Sub-capability B: Live Execution Dashboard

**UX:** Enhanced step cards in WorkflowStatusView during active execution. Running step expands to show:

- **4 live metric tiles** (reusing TaskBentoCell pattern): tokens (with rate), cost (with budget bar), current tool (with turn count), elapsed (with estimate)
- **Streaming partial results** — truncated agent output, auto-scrolling
- **Step progress indicator** — numbered circles with connecting lines, completed/running/pending states

**Data flow:** SSE stream from `/api/logs/stream?workflowId=X` — existing endpoint, filtered to workflow. Agent log events (`tool_start`, `content_block_delta`, `completed`) drive the metric tiles. Usage ledger entries drive the cost counter.

**Changes:**

| File | Change |
|------|--------|
| `src/components/workflows/workflow-status-view.tsx` | Add live metrics grid to running step cards |
| `src/components/workflows/step-live-metrics.tsx` (new) | 4-tile metric display with SSE subscription |
| `src/components/workflows/step-progress-bar.tsx` (new) | Step progress indicator with circle+line pattern |
| `src/lib/workflows/engine.ts` | Emit structured agent_log events for step transitions (step_started, step_completed, step_failed) |

#### Sub-capability C: Workflow-Embedded Debug Panel

**UX:** Collapsible section below step cards on failed/completed workflows. Contains:

1. **Error summary** — red left-border card with failure description and root cause
2. **Error timeline** — vertical timeline with dots (green=success, yellow=warning, red=failure) showing key events from agent_logs
3. **Fix suggestions** — tiered: Quick (raise budget), Better (reduce docs), Best (restructure workflow)
4. **Actions** — Retry Step, Re-run Workflow, View Full Logs buttons

**Data source:** `agent_logs` table filtered to workflow tasks + `_state` from workflow definition.

**Root cause analysis:** Pattern matching on error messages:
- `"Reached maximum budget"` → budget cause, suggest raise/reduce docs
- `"timeout"` / `"max turns"` → complexity cause, suggest split step
- `"connection"` / `"rate limit"` → transient cause, suggest retry

**Changes:**

| File | Change |
|------|--------|
| `src/components/workflows/workflow-debug-panel.tsx` (new) | Debug panel with timeline, suggestions, actions |
| `src/components/workflows/error-timeline.tsx` (new) | Vertical timeline component |
| `src/lib/workflows/error-analysis.ts` (new) | `analyzeWorkflowFailure(workflowId)` — builds timeline, identifies root cause, generates suggestions |
| `src/app/api/workflows/[id]/debug/route.ts` (new) | Debug data endpoint — returns timeline + analysis |

#### Sub-capability D: Execution-Informed Learning

**New table:** `workflowExecutionStats` — materialized rollup updated after each workflow run.

```sql
CREATE TABLE IF NOT EXISTS workflow_execution_stats (
  id TEXT PRIMARY KEY,
  pattern TEXT NOT NULL,          -- sequence, parallel, swarm, etc.
  step_count INTEGER NOT NULL,
  avg_docs_per_step REAL,
  avg_cost_per_step_micros INTEGER,
  avg_duration_per_step_ms INTEGER,
  success_rate REAL,              -- 0.0 to 1.0
  common_failures TEXT,           -- JSON: {"budget_exceeded": 4, "timeout": 1}
  runtime_breakdown TEXT,         -- JSON: {"claude-code": 0.92, "openai-direct": 0.71}
  sample_count INTEGER NOT NULL,
  last_updated TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Aggregation trigger:** After `executeWorkflow` completes or fails, call `updateExecutionStats()`:
1. Query `usageLedger` for this workflow's run — per-step cost, tokens, runtime
2. Query `agent_logs` for error types, tool usage, duration
3. Upsert into `workflowExecutionStats` keyed by `(pattern, step_count)` bucket
4. Update running averages and success rate

**Query API:** `getWorkflowOptimizationHints(pattern, stepCount, docCount)` returns:
- `budgetRecommendation` — suggested cap based on historical avg + 1 stddev
- `docBindingStrategy` — "per-step" if avg docs > 3 per step historically
- `runtimeRecommendation` — runtime with highest success rate for this pattern
- `patternComparison` — if alternative pattern has >20% better success rate, suggest it
- `similarWorkflowStats` — raw stats for display

**Changes:**

| File | Change |
|------|--------|
| `src/lib/db/schema.ts` | Add `workflowExecutionStats` table |
| `src/lib/db/bootstrap.ts` | Add bootstrap CREATE TABLE |
| Migration `00XX_add_execution_stats.sql` | CREATE TABLE |
| `src/lib/workflows/execution-stats.ts` (new) | `updateExecutionStats()`, `getWorkflowOptimizationHints()` |
| `src/lib/workflows/engine.ts` | Call `updateExecutionStats()` in finally block after workflow execution |
| `src/lib/data/clear.ts` | Add `workflowExecutionStats` to clear order |

---

## What Already Exists (Reuse)

| Capability | Location | How We Use It |
|---|---|---|
| `WORKFLOW_STEP_MAX_BUDGET_USD = 5.0` | `task-status.ts:58` | Wire into `executeChildTask` |
| `workflowDocumentInputs.stepId` column | `schema.ts` | Expose in `create_workflow` tool |
| `buildPoolDocumentContext(wfId, stepId)` | `context-builder.ts:143-152` | Already handles step-scoped docs |
| `estimateTokens(text)` | `chat/context-builder.ts:16-18` | Reuse for pre-flight estimation |
| `executeTaskWithRuntime(taskId, runtimeId?)` | `runtime/index.ts:77` | Pass workflow's runtimeId |
| `resolveAgentRuntime(runtimeId)` | `catalog.ts:131-136` | Fallback chain already exists |
| `listRuntimeCatalog()` | `catalog.ts:138-140` | Expose via `list_runtimes` tool |
| SSE streaming | `/api/logs/stream/route.ts` | Reuse for live execution metrics |
| Sparkline, DonutRing charts | `src/components/charts/` | Reuse for live dashboard |
| TaskBentoCell metric tiles | `src/components/tasks/` | Pattern for live metric tiles |
| DetailPane right-rail | `src/components/shared/` | Container for optimizer panel |
| ErrorState component | `src/components/shared/` | Pattern for debug panel errors |
| Swarm retry pattern | `swarm-dashboard.tsx:47-68` | Pattern for step-level retry |

## NOT in Scope

| Deferred Item | Rationale |
|---|---|
| LLM-based document summarization | Complex feature, truncation sufficient for now |
| Workflow-level budget pooling (shared across steps) | Requires SDK changes |
| Global model override settings (`openai_direct_model` writable) | Wrong abstraction — per-workflow is the right surface |
| Automatic model selection based on task complexity | Future ML feature |
| Real-time cost streaming from SDK | SDK doesn't expose streaming cost data |
| Parallel execution cost estimation | Sequential is straightforward; parallel adds combinatorial complexity |
| Cross-workflow failure correlation in Monitor | Monitor stays as global overview; debugging lives in workflow detail |

---

## Dependency Graph

```
Phase 1 (P1, parallel):
  Feature 1: Workflow Budget Governance
    ├─ depends: spend-budget-guardrails (completed)
    └─ enables: Feature 4 (cost visibility in optimizer)

  Feature 2: Workflow Runtime & Model Configuration
    ├─ depends: provider-runtime-abstraction (completed)
    └─ enables: Feature 4 (runtime catalog for optimizer)

  Feature 3: Workflow Execution Resilience
    ├─ depends: workflow-engine (completed)
    └─ enables: Feature 4 (reliable metrics + error timelines)

Phase 2 (P2, sequential sub-capabilities):
  Feature 4: Workflow Intelligence & Observability
    ├─ 4D: Execution Learning (table + aggregation — no UI dependency)
    ├─ 4B: Live Execution Dashboard (SSE metrics — needs F3 state fixes)
    ├─ 4C: Embedded Debug Panel (error analysis — needs F1 budget + F3 state)
    └─ 4A: Optimizer Co-pilot (needs 4D stats + F1 budget + F2 runtime catalog)
```

## Verification Plan

**Feature 1 — Budget:**
- Create a workflow with >$2 document context → should use $5 cap, not fail
- Set `budget_max_cost_per_task` to 10 via chat → verify next execution uses $10
- Pre-flight estimation should report per-step cost breakdown before execution

**Feature 2 — Runtime:**
- Create workflow with `runtime: "openai-direct"` → verify tasks use OpenAI adapter
- Call `list_runtimes` in chat → should return all 5 runtimes with models
- `get_settings` response should tag each key with `writable: true/false`

**Feature 3 — Resilience:**
- Force-fail a workflow step → verify step rolls back to "failed" (not stuck "running")
- Re-execute a failed workflow → all steps should reset to "pending"
- Re-execute a crashed "active" workflow (no live tasks) → should succeed
- Create workflow with per-step documentIds → verify each step receives only its docs

**Feature 4 — Intelligence:**
- Run 3+ workflows → check `workflowExecutionStats` table has aggregated data
- Open WorkflowFormView → optimizer panel should show suggestions based on history
- During execution → live metrics should update in real-time (tokens, cost, tool)
- After failure → debug panel should show error timeline and fix suggestions
