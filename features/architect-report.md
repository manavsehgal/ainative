---
generated: 2026-04-09
mode: review
scope: PR manavsehgal/stagent#6 (fix/workflow-loop-status-crash)
---

# Architect Report

## Architecture Review — 2026-04-09

### Scope

Focused review of PR manavsehgal/stagent#6, opened 2026-04-09 by Stagent Chat running inside the `stagent-growth` instance. The PR is a 2-line defensive fix in `src/components/workflows/workflow-status-view.tsx:404-406` adding optional chaining (`s.state?.result`) to prevent a `TypeError` that crashes the workflow detail page into the React error boundary for loop-pattern workflows (the pattern used by table enrichment).

This is a targeted review, not a full pattern compliance audit. The review's job is to answer three questions: (a) is the hotfix safe to merge as-is, (b) what is the actual root cause, (c) what architectural contract needs to exist to prevent recurrence.

### Verdict

**Accept PR #6 as an interim hotfix. Do not treat it as the fix.** The 2-line guard stops the crash, which is the right thing to ship on the same day the crash was reported. It is not sufficient as a permanent solution because it patches the symptom (one crash site) without fixing the contract violation (one unwritten rule). The permanent fix is tracked by the new feature spec `features/workflow-status-view-pattern-router.md` and codified by the new TDR-031.

Merge order:
1. Merge PR #6 as-is. No further changes requested on the PR itself.
2. Build `workflow-status-view-pattern-router` in a separate branch. That spec removes the optional chaining PR #6 added, because by then the type system enforces the invariant.

There is no need to block PR #6 on the follow-up work. The guard is a no-op for sequence/parallel/swarm workflows (where `state` is always present) and returns an empty `completedStepOutputs` array for loop workflows (which is the same behavior the view currently exhibits in the crash-free code path). Zero regression risk for the interim state.

### Root Cause Analysis

The PR description says loop-pattern workflows return step definitions without a `.state` property. That is accurate but incomplete. The deeper issue is a **contract violation with no contract**: the status API has always returned different shapes for different patterns, but no TDR or type definition ever codified the rule. Three distinct problems compound:

**Problem 1 — Polymorphic response, monomorphic type.** `src/app/api/workflows/[id]/status/route.ts:101-118` (the loop branch) returns `steps: definition.steps` as raw step definitions with no `state` wrapping, plus a top-level `loopState` carrying real progress in `LoopState.iterations[]`. Lines 120-138 (the default branch for sequence/parallel/swarm) return `steps: definition.steps.map((step, i) => ({ ...step, state: state?.stepStates[i] ?? {...} }))` — each step wrapped with `.state`. The default branch also includes `resumeAt` and `workflowState`; the loop branch includes neither. These are genuinely different shapes. The consumer type at `src/components/workflows/workflow-status-view.tsx:43-58` declares a single `StepWithState` interface with `state` required. TypeScript never complained because the route handler's return type was never exported as a union — it was inferred as whatever happens to satisfy `NextResponse.json()`, and the client re-typed the response as a flat `WorkflowStatusData` interface (lines 68-90). **The type has been lying since loop-pattern workflows were added.** PR #6 is simply the first crash that surfaced the lie.

**Problem 2 — Derived computation above the dispatch branch.** `workflow-status-view.tsx` is 895 lines long. The loop branch that dispatches to `LoopStatusView` sits at line 522. The `completedStepOutputs` computation that crashed sits at line 404 — **118 lines upstream of the dispatch**. The view unconditionally computes derived data for all patterns before it decides which pattern it is rendering. This is the proximate cause of the crash: even though `LoopStatusView` would have correctly rendered the loop workflow had execution ever reached line 522, the code at line 404 throws first. This is a god-component anti-pattern — the top-level view mixes data fetching, derived computation, sequence rendering, parallel rendering, swarm rendering, loop dispatch, and sheet dialogs in a single 895-line client component.

**Problem 3 — Silently wrong loop output handling.** With the optional chaining guard, `completedStepOutputs` returns `[]` for loop workflows. The "Full Output" sheet therefore shows nothing for table enrichment runs, even though `loopState.iterations[].result` in `src/lib/workflows/types.ts:105-124` holds the actual per-iteration outputs. The crash is gone, but the feature is quietly broken. A user running a table enrichment will see the workflow complete successfully and then find the Full Output sheet empty. This is strictly worse than the crash in one sense: a crash gets reported; an empty sheet looks like "there was no output." PR #6 fixes the crash but does not fix this downstream symptom.

### Blast Radius

Files affected today by the root cause, beyond PR #6's single file:

| Layer | File | Current state | Impact |
|---|---|---|---|
| API | `src/app/api/workflows/[id]/status/route.ts` | Returns polymorphic response; loop branch at 101-118, default at 120-138 | Must return typed union response. Shape unchanged, type annotations added. Low risk. |
| Types | `src/lib/workflows/types.ts` | Has `WorkflowStep`, `LoopState`, `IterationState`; no `WorkflowStatusResponse` export | Add discriminated union export. Additive, non-breaking. |
| Frontend | `src/components/workflows/workflow-status-view.tsx` | 895 lines, god component, unconditional `completedStepOutputs` at 404 | Refactor into thin router (<80 lines). High visual risk — every workflow detail page passes through this view. Needs manual regression on sequence, parallel, loop, swarm. |
| Frontend | `src/components/workflows/loop-status-view.tsx` | Correct renderer for loop-pattern data, already wraps `loopState.iterations` | No changes. Becomes the inner component of the loop subview. |
| Frontend (new) | `src/components/workflows/views/loop-pattern-view.tsx` | Does not exist | New file. Wraps `LoopStatusView`, owns loop-only affordances, reads the loop arm of the union. |
| Frontend (new) | `src/components/workflows/views/sequence-pattern-view.tsx` | Does not exist | New file. Houses today's sequence/parallel/swarm rendering, Full Output sheet, step sheets. Reads the sequence/parallel/swarm arm of the union. |
| Frontend (new) | `src/components/workflows/hooks/use-workflow-status.ts` | Does not exist | New file. Owns polling and fetch; both subviews consume it. |

Consumers of `data.steps[i].state` today, by grep of the view:
- `workflow-status-view.tsx:404-406` — `completedStepOutputs` (crash site, patched by PR #6)
- No other unconditional reads of `.state` as of 2026-04-09

Consumers of `data.loopState` today:
- `workflow-status-view.tsx:522` passes `loopState` to `LoopStatusView` inside the `data.pattern === "loop"` branch — correct, no issue
- No other consumers

**Classification:** Medium blast radius for the durable fix — 2 layers (API types + frontend components), 6-7 files. PR #6 itself is Low (1 file, 2 lines).

### Regression Risk Matrix for the Router Refactor

| Flow | Risk | Mitigation |
|---|---|---|
| Sequence workflow detail page | Medium — most common code path, large surface | Manual QA: run a sequence workflow end-to-end, verify steps, approval prompts, Full Output sheet, step sheets |
| Parallel workflow detail page | Medium — shares rendering with sequence | Same manual QA, plus verify parallel fan-out visualization |
| Loop workflow detail page (table enrichment) | Low — currently broken, any working render is an improvement | Verify iterations render, verify Full Output sheet now shows iteration results |
| Swarm workflow detail page | Low — uses `SwarmDashboard` subcomponent, mostly isolated | Verify swarm runs still render |
| Scheduler-triggered workflows | Low — status endpoint is the same | Existing scheduler tests in `src/lib/schedules/__tests__/` should pass unchanged |
| Workflow polling behavior | Medium — new `use-workflow-status` hook replaces inline `useEffect` polling | Verify polling interval, cancellation on unmount, re-subscribe on workflow ID change |

### TDR Implications

**New TDR created:** [TDR-031: Workflow status API is a pattern-discriminated union; consumers branch before reading](../.claude/skills/architect/references/tdr-031-workflow-status-response-contract.md) — category `api-design`, status `accepted`, date `2026-04-09`. Codifies the contract this review surfaced: single exported union type, mandatory narrowing before reading pattern-specific fields, pattern-specific rendering in pattern-specific components, four-step new-pattern checklist.

**Existing TDRs not affected:** TDR-003 (API design) and TDR-004 (Server Components for reads) are adjacent but not in conflict. TDR-031 refines the response-contract discipline without superseding either.

**Existing TDRs this could have prevented:** None retroactively — the polymorphic response predates the TDR set. TDR-031 prevents the next instance.

### Drift Detection (sub-step)

Scanning the workflow layer for related drift while I am here:

**Negative drift found:**
- `workflow-status-view.tsx` is a 895-line god component. No TDR currently forbids this, but the TDR-031 rule (pattern-specific subviews) implicitly requires the split. Tracked in the feature spec.
- No other status-route consumers currently dereference `data.steps[i].state` without narrowing, but the type currently permits it — latent risk across any future consumer.

**Positive drift worth noting (not codifying yet):**
- `src/components/workflows/loop-status-view.tsx` and `src/components/workflows/swarm-dashboard.tsx` are already pattern-specific subviews. The god component merely fails to delegate to them early enough. The positive pattern exists; the anti-pattern is the top-level view's refusal to commit to it.

**Evolved patterns:** None.

### Recommendations

1. **Merge PR manavsehgal/stagent#6 as-is.** Stops the bleeding. No architectural objection.
2. **Build `workflow-status-view-pattern-router`** (feature spec authored in parallel with this review by `/product-manager`). Implements TDR-031. Follows the router split described in the blast radius table.
3. **Remove the optional chaining PR #6 added** as the final AC of the feature spec. The type system will enforce the invariant instead.
4. **Do not wait on the spec to merge PR #6.** The interim guard is strictly safer than the current `main`.
5. **When adding a new workflow pattern in the future**, follow TDR-031's four-step checklist. The exhaustiveness check on the router's dispatch will catch omissions.

---

*Generated by `/architect` — Architecture Review mode*
