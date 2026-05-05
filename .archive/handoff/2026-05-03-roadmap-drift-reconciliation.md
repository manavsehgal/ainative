# Handoff: Roadmap-vs-spec drift reconciliation (post Phase 2) — planned-spec roster at 0

**Created:** 2026-05-03 (drift reconciliation session — single-file commit pending)
**Status:** Working tree has uncommitted edits to `features/roadmap.md` only (15 inserts / 9 deletes). Ready for a single docs commit.
**Predecessor:** `chat-conversation-branches` Phase 2 handoff archived at `.archive/handoff/2026-05-03-chat-conversation-branches-phase-2.md` (Phase 2 was committed as `17a6fc5b` earlier today).

---

## TL;DR for the next agent

1. **The planned-spec roster is now genuinely empty.** Final roadmap status distribution: 207 completed / 28 deferred / 5 shipped (SEM milestones) / 4 in-progress / 0 planned. Every previously-planned row was either promoted to its true state (completed/in-progress) or had already shipped via earlier commits today (`composed-app-manifest-authoring-tools` 712fe62c, `schedule-collision-prevention` 245d7165, `workflow-learning-approval-reliability` ac411cbc, `task-turn-observability` 3a971be9, `onboarding-runtime-provider-choice` 996a727c, plus the 2 chat-branches phases). The drift-detection grep heuristic for "next-up planned spec" no longer returns anything — pick from in-progress closeouts or net-new ideation instead.

2. **9 roadmap rows promoted; 6 missing rows added.** Drift caught: ship-verifications today flipped spec frontmatter `status` to completed/in-progress without updating the corresponding roadmap row. Fixed both directions: (a) 5 rows promoted `planned → completed` (`composed-app-kit-inbox-and-research`, `entity-relationship-detail-views`, `relationship-summary-cards`, `sidebar-ia-route-restructure`, `workflow-document-pool`); (b) 4 rows promoted `planned → in-progress` (`composed-app-auto-inference-hardening`, `direct-runtime-advanced-capabilities`, `direct-runtime-prompt-caching`, `upgrade-session`); (c) 6 missing rows added (`routing-cascade-dual-provider`, `chat-polish-bundle-v1`, `instance-bootstrap-local-branch-shim`, `profile-runtime-default-resolution`, `workflow-editing`, `row-trigger-blueprint-execution`). 3 specs correctly excluded from roadmap (audit reports + external-repo doc).

3. **The 4 remaining in-progress closeouts are the recommended next moves**, in priority order with concrete remaining scope:

   - **`upgrade-session`** (P1) — ~60% shipped per its own ship-verification block. Still missing: dedicated `upgrade-session-view.tsx` (currently re-uses generic `/tasks/[id]`), upgrade history list, abort confirmation dialog with rollback, "Restart dev server" success banner, integration tests on temp-dir clone. Substantial multi-step build — write a plan first.
   - **`direct-runtime-advanced-capabilities`** (P2) — ~55% shipped. Remaining: thinking-block collapsible UI in `chat-message.tsx`, context compaction (no `compactContext` references yet), `/v1/models` discovery, Anthropic-side server-tool toggles. Concrete and bounded.
   - **`direct-runtime-prompt-caching`** (P2) — partially shipped. Remaining: ledger persistence, dashboard surfacing, Batch API path. Smallest remaining scope of the four.
   - **`composed-app-auto-inference-hardening`** (P2) — first cut shipped via `composed-app-manifest-view-field`. Remaining: explicit `column.config.semantic` field, expanded decision-table test suite (20-30 cases), `/apps/[id]/inference` diagnostic page.

4. **Two non-drift findings worth carrying forward:**
   - **`board-context-persistence` uses bullet-list metadata, not YAML frontmatter.** Status is `completed` (matches roadmap) so no functional drift, but the format inconsistency causes a parser miss in any tooling that reads `awk '/^---$/{flag++} flag==1 ...'`. Out of scope for this pass; flag for a future style-consistency PR.
   - **SEM milestone `shipped` ≠ `completed` is intentional and load-bearing.** 5 rows show `roadmap=shipped, spec=completed` — this encodes the "shipped to GitHub origin AND part of the SEM batched npm release" state via the spec's `shipped-date:` frontmatter field. Do NOT normalize these to a single value. See memory note `project-self-extending-machine-npm-deferred.md`.

---

## What landed this session

Single-file change to `features/roadmap.md` (15 inserts / 9 deletes):

### Status promotions (9)

| Feature | Section | Before | After |
|---|---|---|---|
| workflow-document-pool | Document Management | planned | completed |
| sidebar-ia-route-restructure | UI Enhancement | planned | completed |
| direct-runtime-prompt-caching | Direct API Runtime Expansion | planned | in-progress |
| direct-runtime-advanced-capabilities | Direct API Runtime Expansion | planned | in-progress |
| entity-relationship-detail-views | Entity Relationships | planned | completed |
| relationship-summary-cards | Entity Relationships | planned | completed |
| upgrade-session | Clone Lifecycle & Self-Upgrade | planned | in-progress |
| composed-app-kit-inbox-and-research | Composed Apps — Domain-Aware View | planned | completed |
| composed-app-auto-inference-hardening | Composed Apps — Domain-Aware View | planned | in-progress |

### New rows added (6)

| Feature | Section | Status | Why missing |
|---|---|---|---|
| routing-cascade-dual-provider | Runtime Quality | completed | Verified shipped 2026-05-03 today; never had a roadmap row |
| chat-polish-bundle-v1 | Chat Context Experience | completed | Bundle umbrella for Phase 3 chat-advanced-ux close-out |
| instance-bootstrap-local-branch-shim | Clone Lifecycle & Self-Upgrade | completed | Spawned from incident memory note 2026-04-17 |
| profile-runtime-default-resolution | Platform Hardening | completed | Phase-5 derived; closes a row-trigger-blueprint-execution bug |
| workflow-editing | Platform Hardening | completed | Verified shipped 2026-05-03 today; never had a roadmap row |
| row-trigger-blueprint-execution | Composed Apps — Domain-Aware View | completed | Phase-5 milestone; depends on inbox-and-research kit |

### Excluded from roadmap (3)

- `quality-audit-report` — generated MVP audit document, not a feature
- `supervisor-report` — generated supervisor output (frontmatter has `generated:` not `title:`/`status:`)
- `marketing-site-pricing-reference` — implementation reference for the external `ainative.github.io` repo, not a ainative feature

### Verification

```
$ join -t '|' -j 1 /tmp/spec-status.txt /tmp/roadmap-status-after.txt | awk -F'|' '$2 != $3'
board-context-persistence    spec=             roadmap=completed   # bullet-list format, parser miss only
chat-tools-plugin-kind-1     spec=completed    roadmap=shipped     # SEM (intentional)
install-parity-audit         spec=completed    roadmap=shipped     # SEM (intentional)
nl-to-composition-v1         spec=completed    roadmap=shipped     # SEM (intentional)
primitive-bundle-plugin-kind-5 spec=completed  roadmap=shipped     # SEM (intentional)
schedules-as-yaml-registry   spec=completed    roadmap=shipped     # SEM (intentional)
```

All 6 remaining "mismatches" are expected and load-bearing — no further drift to fix.

---

## Patterns reinforced this session

- **Drift creeps back fast.** The prior roadmap-drift handoff (4 commits, 2026-05-03 morning) reduced planned-row count to 7 "truly planned." Within the same day, ship-verifications baked into 5 separate feature commits flipped spec frontmatter without touching roadmap rows, regenerating 9 new drift cases by evening. **Lesson:** any commit that flips a spec's `status:` frontmatter MUST also update its corresponding roadmap row in the same commit. Worth codifying as a commit-time check (a hooked grep that fails the commit if `features/<name>.md` status changed but `features/roadmap.md` row for `<name>` did not). The `commit-push-pr` skill's automation surface is the natural home for this.

- **`shipped` and `completed` are semantically distinct in this project.** `shipped` is reserved for SEM (Self-Extending Machine) milestones M1–M5, encoding "on origin AND part of the deferred batched npm release." Spec frontmatter uses `completed` + `shipped-date:` to encode the same state at finer granularity. Anyone running a "normalize statuses" pass will be tempted to collapse these — don't. The semantic split is referenced in `project-self-extending-machine-npm-deferred.md`.

- **Excluding non-feature specs from roadmap is correct, not a bug.** `quality-audit-report`, `supervisor-report`, `marketing-site-pricing-reference` all live in `features/` but aren't features. The frontmatter shape is the tell — `generated:` instead of `status:`, or no frontmatter at all. Future drift-detection scripts should special-case these (e.g., skip files without a `status:` field).

- **The "no planned rows" milestone reveals the project's cadence.** With everything either completed, deferred, in-progress, or shipped, the next session's "what to work on" decision is simpler: pick an in-progress closeout, write a plan for a previously-deferred feature being un-deferred, or pull from the ideas/ pipeline. There's no longer an ambient "planned backlog" to draw from. This is healthy for a single-developer cadence but means each session must do a small ideation step before starting work.

---

## How to commit this session's work

```
git add features/roadmap.md HANDOFF.md .archive/handoff/2026-05-03-chat-conversation-branches-phase-2.md
git commit -m "docs(features): reconcile roadmap drift — 9 promotions + 6 missing rows"
```

Single-file feature-data change. Per the commit-style guidance in CLAUDE.md, `docs(features)` is correct because the only code-affecting surface is the roadmap source-of-truth, not runtime behavior. This commit is bisectable and self-contained — no test surface required (the file is data, validated by the `join`-based diff above).

---

*End of handoff. Three reasonable next moves, in priority order:*

1. ***P1 in-progress closeout — `upgrade-session`*** (largest scope of the four; needs a plan first per CLAUDE.md "plan-first for non-trivial features"). Concrete remaining ACs in the spec's ship-verification block at `features/upgrade-session.md` line 10.
2. ***P2 in-progress closeout — `direct-runtime-prompt-caching`*** (smallest scope; ledger persistence + cost dashboard cache hit-rate + Batch API). Good candidate if seeking a finishable-in-one-session task.
3. ***Net-new from `ideas/`*** (the planned roster is empty — need ideation to refill). Run `/supervisor` for project-state-aware recommendations or scan `ideas/` for un-specced concepts.

*If picking option 1 or 2: skim the `direct-api-gap-analysis.md` idea doc and the predecessor's roadmap-drift handoff for context on what's already mapped.*
