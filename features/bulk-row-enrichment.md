---
title: Bulk Row Enrichment API
status: planned
priority: P1
milestone: post-mvp
source: changelog.md#2026-04-08 (split from growth-primitives design spec)
dependencies: [workflow-engine, tables-data-layer, tables-workflow-triggers, multi-agent-routing]
---

# Bulk Row Enrichment API

## Description

Add a first-class API for "run an agent task for every row in a table matching a filter, writing results back to a target column." Today this pattern — research every contact missing a LinkedIn URL, classify every support ticket, generate copy for every product — requires hand-rolling a loop workflow for each use case. This feature exposes it as `POST /api/tables/:id/enrich` and a matching `enrich_table` MCP chat tool, so users can fan out table rows to the agent with one call.

Under the hood, the endpoint generates a **loop workflow** that iterates over matching rows. Each iteration runs an agent task with the row's data bound into the prompt template via `{{row.fieldName}}` substitution. After each task completes, a new `postAction` framework on the workflow engine writes the task result back to the specified column. Rows that already have a non-empty target column are skipped (idempotent re-runs).

This is a general-purpose primitive. Growth uses it for the "Enrich All Contacts" button, but the same endpoint serves batch classification, bulk content generation, per-row scoring, and any table-to-task fan-out pattern.

## User Story

As an operator with a table of rows missing data, I want to point an agent at the table with a filter and a prompt, so that each matching row gets enriched in the background without me creating one task per row by hand.

## Technical Approach

### API Contract

```ts
POST /api/tables/:tableId/enrich
{
  "prompt": "Research {{row.name}} at {{row.company}} and return their LinkedIn URL only, or NOT_FOUND",
  "targetColumn": "linkedin",
  "filter": { "column": "linkedin", "operator": "is_empty" },
  "agentProfile": "sales-researcher",
  "projectId": "proj_123",
  "batchSize": 50
}

// → 202 Accepted
{
  "workflowId": "wf_abc",
  "rowCount": 47,
  "estimatedDuration": "15-30 min",
  "status": "active"
}
```

`batchSize` defaults to 50, capped at 200 at the API boundary. All filter operators that `listRows()` already supports work here — notably `is_empty` / `is_not_empty` via `src/lib/data/query-builder.ts:53-85`.

### LoopConfig Data-Binding (new capability)

The current `LoopConfig` in `src/lib/workflows/types.ts:37-43` supports `maxIterations`, `timeBudgetMs`, `agentProfile`, and `completionSignals` — but there is **no data-binding layer** for iterating over a row array. This feature adds:

- `items?: unknown[]` — optional array of values to iterate
- `itemVariable?: string` — name to bind each item under in the template context (default `"item"`; enrichment uses `"row"`)

`loop-executor.ts` detects the `items` field and iterates directly, binding each entry to `itemVariable` before running the step. Loops without `items` continue using the existing `completionSignals` path — fully backwards compatible.

Template resolution in `src/lib/workflows/template.ts:12-38` currently handles flat `{{variable}}` substitution. This feature extends it to support dot-path access: `{{row.name}}`, `{{row.company.domain}}`, etc. Missing fields resolve to empty string (not `undefined` literals in the rendered prompt).

### postAction Framework (new step concept)

The workflow engine gains a new optional `postAction` field on step definitions. Initial variant — designed as a discriminated union so additional variants can be added purely additively later:

```ts
type StepPostAction =
  | { type: "update_row"; tableId: string; rowId: string; column: string };

interface WorkflowStep {
  // ...existing fields
  postAction?: StepPostAction;
}
```

In `engine.ts` step-completion path, after the task result is available: if `step.postAction?.type === "update_row"`, parse the task result, and if it is non-empty and not the literal `"NOT_FOUND"`, call `updateRow(tableId, rowId, { [column]: result })`. `postAction` failures are logged to `agent_logs` — never silently swallowed.

### Enrichment Workflow Generator

New module `src/lib/tables/enrichment.ts`:

1. `listRows(tableId, { filters: [params.filter], limit: params.batchSize ?? 50 })` — query matching rows (spec called this `queryTable`; actual export is `listRows` at `src/lib/data/tables.ts:272`)
2. Validate target column exists via `getTableColumns()`
3. Skip rows where the target column already has a non-empty value (idempotent)
4. Build a loop workflow definition with:
   - `pattern: loop`
   - `loopConfig.items = filteredRows`
   - `loopConfig.itemVariable = "row"`
   - One step with the user's prompt and `postAction: { type: "update_row", tableId, rowId: "{{row.id}}", column: params.targetColumn }`
5. `createWorkflow(...)` + `executeWorkflow(...)` (fire-and-forget per TDR-001)
6. Return `{ workflowId, rowCount }`

### MCP Tool

New `enrich_table` tool registered via `defineTool()` in `src/lib/chat/tools/table-tools.ts` (following the existing pattern at lines 34-69 for `list_tables`), then registered in `src/lib/chat/tool-catalog.ts`. Same parameter shape as the API contract. Chat users can trigger enrichment conversationally: *"Enrich all contacts missing LinkedIn URLs using the sales-researcher profile."*

### Chat Context Exposure

Registering `enrich_table` is not enough. The current `STAGENT_SYSTEM_PROMPT` in `src/lib/chat/system-prompt.ts` does **not mention tables at all** — it has sections for Projects, Tasks, Workflows, Schedules, Documents, Notifications, Profiles, Conversations, Usage & Settings, but no Tables section. The existing 30+ table tools (`list_tables`, `query_table`, `update_row`, etc.) are therefore invisible to the LLM in tool-use planning, which is why enrichment-style prompts fall back to hand-rolled workflows today. Closing this gap is part of this feature's scope:

**`src/lib/chat/system-prompt.ts` — STAGENT_SYSTEM_PROMPT:**

- Add a new `### Tables` section listing all currently-registered table tools (`list_tables`, `get_table_schema`, `query_table`, `search_table`, `aggregate_table`, `add_rows`, `update_row`, `delete_rows`, `create_table`, `import_document_as_table`, `export_table`, `add_column`, `update_column`, `delete_column`, `reorder_columns`, `list_triggers`, `create_trigger`, `update_trigger`, `delete_trigger`, `get_table_history`, `save_as_template`, **`enrich_table`**). The new `enrich_table` line: *"enrich_table: Run an agent task for every row in a table matching a filter, writing results to a target column. Use for bulk research, classification, content generation, or any table row fan-out pattern. [requires approval]"*
- Under `## When to Use Which Tools`, add: *"Bulk per-row operations ('research every contact', 'classify all tickets', 'enrich rows missing X') → `enrich_table`. Do NOT hand-roll a loop workflow for this — `enrich_table` already generates the optimal loop with postAction writeback and idempotent skip."*
- Under `## Guidelines`, add: *"`enrich_table` skips rows with existing non-empty values by default. If the user wants to overwrite, note the limitation — force re-enrichment is out of scope in v1 and requires manually clearing the target column first."*

**`src/lib/chat/suggested-prompts.ts`:**

- Add to `buildCreatePrompts()`: *"Enrich a table with an agent" → "I have a table with missing data. Help me use enrich_table to fan out rows to an agent. Ask me which table, which column is missing, what prompt template to use, and which agent profile is best."*
- Add a context-sensitive suggestion in `buildExplorePrompts()`: when a table with empty cells exists, suggest *"Enrich '{tableName}' rows" → "Use enrich_table on {tableName} to fill in missing {columnName} values. Pick a relevant agent profile and draft a prompt template."*

**`src/lib/chat/tools/table-tools.ts` — tool description:**

- The `enrich_table` tool's `description` field must be explicit enough for the LLM to pick it over `query_table` + hand-rolled loops: *"Fan out an agent task to every row in a table matching a filter. Generates a loop workflow, binds each row as `{{row.field}}` in the prompt template, writes task results back to `targetColumn` via a postAction. Skips rows where targetColumn is already populated. Use this instead of creating a loop workflow by hand whenever the pattern is 'for each row, do X and save the result'."*

**`src/lib/chat/tools/workflow-tools.ts` — `create_workflow` tool description:**

- Add a warning clause: *"For the 'run agent on every row of a table' pattern, prefer `enrich_table` over `create_workflow`. `enrich_table` generates the optimal loop configuration, wires up the postAction row writeback, and handles idempotent skip — hand-rolled equivalents miss these safeguards."*

**Why this matters:** The `enrich_table` tool is only useful if the chat LLM picks it over its alternatives. Without explicit system-prompt documentation and an anti-pattern steer on `create_workflow`, the LLM will default to building loop workflows manually — losing idempotency, progress reporting, and the row-data binding layer that this feature introduces.

### Rate Limiting, Budget, and Safety

- **Concurrency:** sequential execution (one row at a time) — avoids budget spikes and simplifies progress reporting
- **Budget:** each row iteration is a separate task, so per-task budget caps from `workflow-budget-governance` apply unchanged
- **Idempotency:** rows with existing non-empty target column values are skipped in the generator, not at the engine layer
- **Progress:** standard `WorkflowStatusView` surfaces loop progress as "Row 15/47" (comes for free once loop-executor reports iteration count)

## Acceptance Criteria

- [ ] `POST /api/tables/:id/enrich` validates request body with Zod and returns 202 with `{ workflowId, rowCount, estimatedDuration }`
- [ ] `batchSize` enforced at 50 default, 200 maximum at API boundary
- [ ] Missing or invalid `targetColumn` returns 400 with actionable error
- [ ] `listRows()` query uses the provided filter; enrichment iterates only matching rows
- [ ] Rows with non-empty target column values are filtered out before workflow creation (idempotent re-runs)
- [ ] LoopConfig gains optional `items` and `itemVariable` fields without breaking existing loops
- [ ] `loop-executor.ts` iterates over `items` when present, binding each entry to `itemVariable`
- [ ] Template resolver supports `{{row.field}}` and `{{row.nested.field}}` dot-path access
- [ ] Missing template fields render as empty string, not literal `undefined`
- [ ] `WorkflowStep.postAction` field added with discriminated union type (single `update_row` variant)
- [ ] Engine step-completion path dispatches `postAction.type === "update_row"` to `updateRow()`
- [ ] Task results equal to `"NOT_FOUND"` or empty string are **not** written to the target column
- [ ] `postAction` failures are logged to `agent_logs` and surfaced as step warnings in workflow status view
- [ ] `enrich_table` MCP tool registered in `table-tools.ts` and `tool-catalog.ts`, with the same parameter shape as the API
- [ ] `enrich_table` tool description is explicit enough that the LLM picks it over `create_workflow` + hand-rolled loops for "for each row" prompts
- [ ] `STAGENT_SYSTEM_PROMPT` has a new `### Tables` section listing all registered table tools, including `enrich_table`
- [ ] `STAGENT_SYSTEM_PROMPT` `When to Use Which Tools` section steers bulk per-row operations to `enrich_table`
- [ ] `create_workflow` tool description includes an anti-pattern steer pointing users to `enrich_table` for row fan-out
- [ ] `suggested-prompts.ts` Create category includes an "Enrich a table with an agent" prompt
- [ ] `suggested-prompts.ts` Explore category surfaces a context-sensitive suggestion when tables with empty cells exist
- [ ] `WorkflowStatusView` shows loop iteration progress (e.g., "Row 15/47") for enrichment workflows
- [ ] Per-task budget caps (from `workflow-budget-governance`) are respected per row
- [ ] Existing loop workflows without `items` field continue to execute unchanged (regression check)

## Scope Boundaries

**Included:**

- `POST /api/tables/:id/enrich` endpoint
- `enrichment.ts` workflow generator
- LoopConfig `items` / `itemVariable` data-binding extension
- Template dot-path resolution (`{{row.field}}`)
- `postAction` framework on workflow steps (single `update_row` variant)
- `enrich_table` MCP chat tool
- Sequential row execution with idempotent skip-if-populated
- Chat system-prompt updates: new Tables section, intent-routing rules, anti-pattern steer on `create_workflow`
- Suggested-prompts updates: Create-category enrichment prompt, context-sensitive Explore suggestion

**Excluded:**

- Parallel row enrichment — sequential only for v1 (budget safety)
- Multi-column output in a single pass — one target column per enrichment call
- Per-row retry on failure — standard workflow re-execute handles this
- Periodic re-enrichment scheduling — users can combine `scheduled-prompt-loops` with this API manually
- `postAction` variants beyond `update_row` (`create_task`, `notify`, `append_document`) — additive future work
- Custom progress UI beyond what the existing loop status view renders
- Force re-enrich flag for already-populated rows — out of scope for v1

## References

- Source: split from the 2026-04-08 Growth-Enabling Primitives design spec (removed after grooming — see `changelog.md` 2026-04-08 entry for provenance)
- Existing table CRUD: `src/lib/data/tables.ts:272` (`listRows`), `src/lib/data/tables.ts:295` (`updateRow`)
- Existing filter operators: `src/lib/data/query-builder.ts:53-85` (includes `is_empty`)
- Existing loop pattern: `src/lib/workflows/loop-executor.ts`
- Existing template resolver: `src/lib/workflows/template.ts:12-38`
- Existing MCP table tools: `src/lib/chat/tools/table-tools.ts:34-69` (`defineTool` pattern)
- Existing MCP catalog: `src/lib/chat/tool-catalog.ts`
- Default agent profile: `src/lib/agents/profiles/builtins/sales-researcher/`
- Related TDRs: TDR-001 (fire-and-forget), TDR-011 (JSON-in-TEXT), TDR-022 (N:M junction tables pattern)
- Related features: `workflow-step-delays` (independent sibling from same design spec), `tables-workflow-triggers` (per-row trigger evaluator, distinct but related pattern), `workflow-budget-governance` (per-task budget caps)
- Proposed follow-up TDRs: TDR-031 workflow step postAction framework, TDR-032 loop workflow data binding
