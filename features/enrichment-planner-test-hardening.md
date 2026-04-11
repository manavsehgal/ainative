---
title: Enrichment Planner Test Hardening
status: planned
priority: P2
milestone: post-mvp
source: code-review of commit d38a9bc (table enrichment planner and QA fixes)
dependencies: [tables-enrichment-runtime-v2, tables-enrichment-planner-api]
---

# Enrichment Planner Test Hardening

## Description

Commit `d38a9bc` shipped `src/lib/tables/enrichment-planner.ts` (454 lines) as
the planner backing the new "Enrich" action on tables. The logic is reasonable
and the core flows have tests, but a code review surfaced several gaps that
will cause silent failures in edge cases once users start pointing the
planner at real columns with unusual types and prompts:

1. **Type cast happens before validation** (`enrichment-planner.ts:70`). The
   function casts `column.dataType` to the enrichment-compatible union
   *before* calling `assertEnrichmentCompatibleColumn`. If a user picks an
   unsupported column (e.g., `date`), the cast succeeds silently, half a plan
   is constructed, and then the assertion throws — but the caller has
   already observed a partially-hydrated value. Rearranging the order
   eliminates a class of confusing error modes.
2. **No route tests** for `POST /api/tables/[id]/enrich/plan`. The Zod schema
   and error paths are defined but never exercised by a test. The route is
   the only way the UI hits the planner.
3. **Light unit test coverage** — 124 test lines for 454 implementation lines
   = ~27% ratio. The repo's Medium tier target is 60%+ (see MEMORY.md). Gaps:
   `buildReasoning` has zero tests, `selectStrategy` edge cases (empty prompt,
   very long prompt) untested, `normalizeEnrichmentOutput` only tested for a
   subset of data types.
4. **Null-safety uncertainty** in functions accepting optional fields
   (`prompt?`, `agentProfileOverride?`, `filter?`). The interface marks these
   optional but the planner implementation may assume they exist when
   building reasoning strings. Explicit null-path tests would catch any
   latent `undefined.toString()` bugs.

None of these are shipping blockers — the happy path works and 44 tests pass —
but the planner will be exercised by an increasingly diverse set of real
columns and prompts, and the current coverage is thin enough that any edge
case will land directly on users.

## User Story

As an operator enriching a column from a prompt, I want the planner to fail
fast with a clear error on unsupported columns or missing inputs, and to
never half-construct a plan, so that I can correct my input instead of
debugging a partial workflow definition.

## Technical Approach

### 1. Reorder validation-then-cast

In `src/lib/tables/enrichment-planner.ts`, call
`assertEnrichmentCompatibleColumn(column)` **before** any type cast or
plan construction. The assertion throws with a clear message naming the
unsupported type; the cast only runs on validated columns, which is also
a safer type narrowing.

Refactor:

```ts
export function buildEnrichmentPlan(input: BuildEnrichmentPlanInput): EnrichmentPlan {
  const { column, table } = input;
  assertEnrichmentCompatibleColumn(column);          // <-- move here
  const dataType = column.dataType as WorkflowEnrichmentTargetContract["dataType"];
  // ... rest of plan construction
}
```

### 2. Add route tests

Create `src/app/api/tables/[id]/enrich/plan/__tests__/route.test.ts` covering:

- Happy path: valid columnId + prompt + strategy → 200 with plan preview
- Zod validation: missing columnId → 400 with field error
- Zod validation: custom mode without prompt → 400 via superRefine
- Zod validation: batchSize > 200 → 400 with cap message
- Unsupported column type → 400 with assertion message
- Unknown table → 404
- License gate: non-scale tier → 403 (if applicable — check existing gate)

Use the existing test patterns from
`src/app/api/tables/[id]/enrich/__tests__/route.test.ts` for consistency.

### 3. Planner unit test expansion

Extend `src/lib/tables/__tests__/enrichment-planner.test.ts` with:

- **`buildReasoning` direct tests**: for each strategy (lookup, classify,
  research-and-synthesize, custom), assert the reasoning string includes
  the column name, target type, and strategy rationale.
- **`selectStrategy` edge cases**: empty prompt, single-word prompt, prompt
  longer than 2000 chars, boolean column with non-classify prompt, URL
  column with classify-shaped prompt.
- **`normalizeEnrichmentOutput`**: one happy-path assertion per data type
  (`text`, `number`, `url`, `email`, `boolean`, `select`) — currently only
  `text` and `boolean` are covered.
- **Null-path tests**: `buildEnrichmentPlan` with `prompt: undefined` (for
  non-custom strategies), `agentProfileOverride: undefined`, `filter:
  undefined`. Assert reasonable defaults, no throws.

Target: raise test-to-code ratio from 27% to 50%+ for this module.

### 4. Sample binding documentation

The planner samples 2 rows for preview (`enrichment-planner.ts:121-125`).
Add a code comment explaining why 2 (LLM context budget) and when to
revisit (if users report under-prompted strategies on high-cardinality
tables). Not a behavior change — just a signpost for future maintainers.

## Acceptance Criteria

- [ ] `assertEnrichmentCompatibleColumn` runs before any type cast in
      `buildEnrichmentPlan`.
- [ ] Route test file exists for `POST /api/tables/[id]/enrich/plan` with
      at least 6 test cases covering happy path + 5 error cases.
- [ ] Planner unit test file covers `buildReasoning`, `selectStrategy` edge
      cases, all 6 supported data types in `normalizeEnrichmentOutput`, and
      null-input paths.
- [ ] Test-to-code ratio for `enrichment-planner.ts` reaches 50%+.
- [ ] Sample-binding rationale commented in source.
- [ ] `npm test` passes; `npx tsc --noEmit` clean.

## Scope Boundaries

**Included:**
- Reordering validation-then-cast
- Route test file for the plan endpoint
- Planner unit test expansion
- Inline documentation of sample-binding choice

**Excluded:**
- Changing the strategy selection algorithm
- Changing the plan JSON shape or validation schema
- Adding new data types to `normalizeEnrichmentOutput`
- UI changes — the planner sheet is out of scope

## References

- Source: code review of commit `d38a9bc`
- Related: `tables-enrichment-runtime-v2`, `tables-enrichment-planner-api`,
  `tables-enrichment-planner-ux`
- Files to modify:
  - `src/lib/tables/enrichment-planner.ts` — reorder validation, add comment
  - `src/lib/tables/__tests__/enrichment-planner.test.ts` — expand coverage
- Files to create:
  - `src/app/api/tables/[id]/enrich/plan/__tests__/route.test.ts`
