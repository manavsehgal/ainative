---
title: Chat Workflow Dedup Variant Tolerance
status: completed
priority: P3
milestone: post-mvp
source: code-review of commit b5ed09b (dedup workflow creation tool)
dependencies: [workflow-create-dedup]
---

# Chat Workflow Dedup Variant Tolerance

## Description

Commit `b5ed09b` added a deduplication guardrail to the chat workflow creation
tool: before creating a new workflow, the LLM is nudged to check for existing
workflows with similar names or steps, and `findSimilarWorkflows` blocks
near-duplicate creation unless the caller passes `force: true`. The similarity
metric uses Jaccard over tokens from name + step titles + tags, with a
threshold of 0.7.

The code review raised a single concern: the threshold may produce **false
positives on legitimate variants** that share keywords. For example:

- "Enrich contacts" vs "Enrich accounts"
- "Daily standup digest" vs "Weekly standup digest"
- "Onboard new hire" vs "Offboard departing hire"

Each pair shares a dominant verb and most of the step structure, so Jaccard
over tokens at 0.7 will likely flag the second-created workflow as a
duplicate and block it. Users will be forced to pass `force: true` even
though the two workflows are legitimately distinct. That erodes trust in
the guardrail — once users are in the habit of bypassing it, the guardrail
stops catching real duplicates.

This feature does not change the threshold speculatively. It adds a
regression test suite for the legitimate-variant scenario, documents the
threshold rationale, and — if the test exposes a concrete false positive —
introduces a weighted scheme (e.g., name-token downweight or step-shape
upweight) to restore tolerance.

## User Story

As a user building several related workflows from chat ("Enrich contacts",
"Enrich accounts", "Enrich companies"), I want each one to be created
without having to pass a `force` flag on every call after the first, so
that the dedup guardrail blocks actual duplicates without blocking
legitimate variants.

## Technical Approach

### 1. Write the failing test first (TDD)

Add to `src/lib/chat/__tests__/tools/workflow-tools-dedup.test.ts`:

```ts
describe("legitimate variant tolerance", () => {
  it("allows Enrich contacts and Enrich accounts as distinct workflows", () => {
    const existing = [
      makeWorkflow({
        name: "Enrich contacts",
        steps: [
          { title: "Load rows from contacts table" },
          { title: "Call enrichment agent" },
          { title: "Write back to table" },
        ],
        tags: ["enrichment", "contacts"],
      }),
    ];
    const proposal = {
      name: "Enrich accounts",
      steps: [
        { title: "Load rows from accounts table" },
        { title: "Call enrichment agent" },
        { title: "Write back to table" },
      ],
      tags: ["enrichment", "accounts"],
    };
    const matches = findSimilarWorkflows(proposal, existing);
    expect(matches).toHaveLength(0);  // legitimate variant, not a duplicate
  });

  it("allows Daily vs Weekly standup digest as distinct workflows", () => { /* similar */ });
  it("still blocks exact case-insensitive name matches", () => { /* guard */ });
  it("still blocks workflows with identical step titles and near-identical names", () => { /* guard */ });
});
```

### 2. Run the test

If the legitimate-variant cases already pass (Jaccard tolerates the
target-table word difference), document the rationale in a comment above
the threshold constant and call the feature done. The test suite locks in
the current behavior as a regression guard.

If they fail (expected), proceed to step 3.

### 3. Weighted similarity

Revise `src/lib/util/similarity.ts` to compute similarity from three
signals with tunable weights:

- **Name tokens** (weight 0.3) — Jaccard over tokenized workflow name
- **Step titles** (weight 0.5) — Jaccard over tokenized, ordered step titles
- **Tags** (weight 0.2) — Jaccard over tags

Lower the name weight specifically because shared verbs ("Enrich", "Onboard",
"Fetch") dominate name tokens without implying duplication. Step-title
Jaccard already differs between legitimate variants because the step that
names the target entity ("Load rows from contacts table" vs "Load rows from
accounts table") differs by one token.

Keep the combined threshold at 0.7. Re-run the test suite and adjust until
all legitimate-variant cases pass and all exact-duplicate cases still fail.

### 4. Documentation

Add a comment above `SIMILARITY_THRESHOLD` explaining:
- Why 0.7
- The three weighted components and what each protects against
- How to tune if new false-positive cases emerge

Update the workflow-tools system prompt guardrail line to mention that the
dedup guardrail tolerates target-entity variants, so the LLM understands
when `force: true` is and isn't required.

## Acceptance Criteria

- [ ] New test block "legitimate variant tolerance" in
      `workflow-tools-dedup.test.ts` with at least 4 test cases (2
      positive-variant cases, 2 guard cases).
- [ ] All positive-variant cases pass (either unchanged, or after weighted
      similarity adjustment).
- [ ] All guard cases still fail `findSimilarWorkflows` (exact dupes still
      blocked).
- [ ] `SIMILARITY_THRESHOLD` has an explanatory comment including rationale,
      component weights, and tuning guidance.
- [ ] Existing 25 similarity tests still pass — no regressions.
- [ ] `npm test` passes; `npx tsc --noEmit` clean.

## Scope Boundaries

**Included:**
- Regression test suite for legitimate-variant scenarios
- Weighted similarity scheme (if tests require it)
- Threshold rationale documentation

**Excluded:**
- Embedding-based similarity (too heavy; dedup is a cheap pre-check)
- User-configurable thresholds — single value is sufficient
- Cross-project dedup — scope remains per-project

## References

- Source: code review of commit `b5ed09b`
- Related: `workflow-create-dedup`, `chat-engine`, `workflow-engine`
- Files modified in the closeout pass:
  - `src/lib/chat/tools/workflow-tools.ts` — replaced single pooled
    `workflowComparableText` with a `workflowSignals` helper returning
    `{nameText, stepsText}`. `findSimilarWorkflows` now computes
    separate name and step Jaccards and combines with 0.5/0.5
    weights (constants `WORKFLOW_NAME_WEIGHT` / `WORKFLOW_STEPS_WEIGHT`)
    against the existing 0.7 threshold. Extensive block comment above
    `WORKFLOW_DEDUP_THRESHOLD` documents the rationale and tuning.
    Kept logic local rather than generalizing into
    `src/lib/util/similarity.ts` — the other caller (profile dedup)
    does not need weighted math and should not pay the complexity.
  - `src/lib/chat/tools/__tests__/workflow-tools-dedup.test.ts` —
    added four tests under `describe("legitimate variant tolerance")`:
    two positive-variant cases (Enrich contacts/accounts, Daily/Weekly
    standup digest) and two guard cases (exact case-insensitive name
    match; near-identical steps with renamed workflow). All 11 tests
    in the file green; 88/88 chat-tool tests green.
  - `create_workflow` tool's `force` param description — added guidance
    that the guardrail already tolerates target-entity variants so the
    LLM does not default to `force: true`. No dedicated system-prompt
    file change was needed; the guidance lives where the LLM reads it.

## Verification run — 2026-04-14

**Empirical tuning table** (combined similarity with 0.5 name / 0.5 steps):

| Pair | Name Jaccard | Step Jaccard | Combined | Outcome |
|---|---:|---:|---:|---|
| Enrich contacts ↔ Enrich accounts | 0.33 | 0.86 | **0.60** | ≤0.7 → allowed ✓ |
| Daily standup digest ↔ Weekly standup digest | 0.50 | 0.87 | **0.68** | ≤0.7 → allowed ✓ |
| Customer Discovery Pipeline ↔ …Workflow v2 (redesign w/ identical steps) | 0.50 | 1.00 | **0.75** | ≥0.7 → flagged ✓ |
| Classify customer segments v1 ↔ v2 (guard) | 1.00 | 1.00 | **1.00** | ≥0.7 → flagged ✓ |
| Deploy frontend ↔ Customer interview (unrelated) | 0.00 | 0.00 | **0.00** | ≤0.7 → allowed ✓ |

The 0.7 threshold cleanly separates variants from duplicates in this corpus with ~0.07–0.10 of headroom on each side. If a future false-positive case surfaces, add a regression test in `workflow-tools-dedup.test.ts → "legitimate variant tolerance"` before re-tuning.
