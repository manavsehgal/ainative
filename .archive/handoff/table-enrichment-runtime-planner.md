---
title: Table Enrichment Runtime Planner
audience: ainative-base
status: proposed
source_branch: growth-mgr
handoff_reason: Promote enrichment from a growth-specific flow into a generic Table primitive.
---

# Table Enrichment Runtime Planner

## Summary

Promote enrichment into a first-class ainative Table capability:

- plan once per enrichment job
- execute one agent flow per row
- choose the lowest-cost prompt/step strategy that fits the target column
- support both simple single-step lookups and multi-step row pipelines

This should live in base ainative, not in Growth-specific code.

## Why this belongs in base

The core primitive is not "enrich contacts". The primitive is:

> enrich missing or derived values in any ainative table column by running an agent against each row with typed writeback semantics

That applies to:

- CRM tables
- research tables
- support tables
- finance tables
- product ops tables
- imported CSVs

## Scope

### In scope

- generic `POST /api/tables/[id]/enrich`
- optional `GET /api/tables/[id]/enrich` plan preview
- planner contract for choosing row execution strategy
- strict output contracts by column type
- row prompt interpolation for `{{row.field}}`
- multi-step execution inside row-driven loop workflows
- extension point for domain-specific planners/adapters

### Out of scope

- Contacts-specific heuristics
- Growth playbook injection
- sales-specific profile mappings
- Growth-specific enrich dialog copy or badges

## Problem in current base

Today the enrich primitive is too static:

- one fixed prompt
- one fixed profile default
- one fixed single-step row execution path
- weak typing of final output
- no explicit planning layer

That creates two opposite cost/quality failures:

1. simple factual enrichments overpay in prompt verbosity
2. derived/synthesis enrichments underperform because they are forced into one step

## Proposed base design

### 1. Planner runs once per job

Input:

- table schema
- target column definition
- sample rows
- optional caller-supplied prompt override
- optional adapter context

Output:

- `promptMode`: `auto | custom`
- `strategy`: `single-pass-lookup | single-pass-classify | research-and-synthesize`
- `agentProfile`
- `steps[]`
- `reasoning`

Base planner should stay generic. It may use:

- column type
- output type
- row sparsity
- presence of categorical options
- caller hints

It should not hardcode Contacts semantics.

### 2. Outer pattern remains row fan-out

Enrichment should continue to use a row-driven loop as the outer orchestration primitive.

Reason:

- the job is fundamentally "run per row"
- it supports idempotent skip and postAction writeback cleanly

What changes is the **inner row plan**:

- 1 step for direct lookup/classification
- 2+ steps when a row needs research before final synthesis

### 3. Typed output contracts

The final writeback step should append a contract based on target column type:

- `text/url/email`: final value or `NOT_FOUND`
- `select`: exactly one allowed option or `NOT_FOUND`
- `boolean`: exactly `true`, `false`, or `NOT_FOUND`
- `number`: bare numeric value or `NOT_FOUND`

### 4. Prompt interpolation

Prompt templates that reference `{{row.field}}` should be resolved at execution time for row-driven loops.

This is base capability, not domain behavior.

### 5. Adapter hook

Base should expose a hook so domains can supply planner hints without forking the primitive.

Example contract:

```ts
interface TableEnrichmentAdapter {
  id: string;
  supports(input: {
    tableName: string;
    tableId: string;
    projectId?: string | null;
  }): boolean;
  buildPlanHints?(input: {
    table: Table;
    targetColumn: ColumnDef;
    sampleRows: Row[];
  }): Promise<{
    preferredProfile?: string;
    contextNotes?: string[];
    extraPromptSections?: string[];
  }>;
}
```

This keeps base generic while allowing Growth to layer in playbooks or sales heuristics.

## API proposal

### `GET /api/tables/[id]/enrich`

Returns preview only:

- recommended strategy
- generated prompt/steps
- profile
- reasoning

### `POST /api/tables/[id]/enrich`

Accepts:

- `targetColumn`
- `promptMode?: auto | custom`
- `prompt?: string`
- existing filter/profile/batch params

Behavior:

- `custom`: preserve user prompt, run single-step plan
- `auto`: build plan from base planner + optional adapter hints

## Execution changes

Loop executor must support multiple steps inside one row-driven iteration.

Per-row flow:

1. bind row context
2. run step 1
3. pass step 1 output into step 2
4. continue until final step
5. postAction writes only the final output

## Recommended implementation sequence

1. Add prompt interpolation and multi-step row iteration support in base workflow engine
2. Add typed output contracts in generic table enrich plumbing
3. Add generic planner contract and preview API
4. Add adapter mechanism
5. Let Growth consume the adapter hook rather than modifying shared enrich logic directly

## Migration note from growth-mgr branch

The growth branch already proved the value of:

- plan preview
- multi-step row execution
- typed output contracts
- dynamic prompt planning

But the current planner implementation is domain-biased and should not be copied directly into base.
