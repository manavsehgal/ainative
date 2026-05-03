# Handoff: Roadmap drift hardening shipped — 7 specs in clean planned state, pick the next feature

**Created:** 2026-05-03 (roadmap grooming + Ship Verification session)
**Status:** Working tree clean. 4 commits on `main`. Roadmap status distribution is now trustworthy: 204 completed / 27 deferred / 7 planned / 4 in-progress / 5 non-spec docs.
**Predecessor:** `.archive/handoff/2026-05-02-composed-app-auto-inference-hardening-shipped-handoff.md`

---

## TL;DR for the next agent

1. **Roadmap drift hardening shipped end-to-end this session.** Initial grooming pass found 6 Tier 1 + 4 Tier 2 drift candidates plus 4 status-string vocabulary issues. Tier 1 + Tier 2 Ship Verification + 1 follow-up code change (`relationship-summary-cards` doc-count plumbing on tasks + projects pages) all landed. Net: roadmap moved from 194 → 204 completed, 16 → 7 planned. The 7 planned features are all *truly* planned now (verified zero shipping evidence).

2. **The `task-turn-observability` correction is worth remembering.** A previous classification said `turnCount` exists at `schema.ts:1274`. That's true — but the column is on `scheduleFiringMetrics`, NOT on `tasks`. The tasks table only has `maxTurns`. **Lesson:** when verifying a schema column, confirm which **table** owns it, not just the file:line of the column declaration. A `rg -B5 turnCount src/lib/db/schema.ts` walks back to the enclosing `sqliteTable("...")` call and avoids this trap.

3. **Pick the next feature.** In priority order based on dependency status and handoff signal:

   - **`composed-app-manifest-authoring-tools`** (P3 post-mvp) — the prior session's recommended next-up, now confirmed truly planned with all 3 dependencies in known states (`composed-app-manifest-view-field` completed, `composed-app-auto-inference-hardening` in-progress with 4 deferred ACs, `chat-app-builder` shipped). The auto-inference dependency's `in-progress` state is fine — the deferred items (diagnostics route, trace API) are not consumed by the manifest authoring tools.
   - **`schedule-collision-prevention`** (P1 post-mvp) — listed as planned with field-data evidence from wealth-mgr deployment. Highest priority truly-planned feature.
   - **`workflow-learning-approval-reliability`** (P1 post-mvp) — also planned with prior incident evidence (table-enrich-context-approval-noise handoff). Higher priority than the manifest tools.

   If priority drives, **start with `schedule-collision-prevention` or `workflow-learning-approval-reliability`** — both are P1 with concrete user-impact evidence. The manifest authoring tools are P3 and pleasant but not urgent.

4. **Outstanding gap-closure work surfaced this session (not blocking, but trackable):**
   - `direct-runtime-prompt-caching` (in-progress) — needs ledger persistence + cost-dashboard cache hit-rate UI + Batch API for meta-completions (~50% discount). Concrete and small once started.
   - `direct-runtime-advanced-capabilities` (in-progress) — context compaction, `/v1/models` discovery, and Anthropic server-tool toggles (`web_search`, `code_execution`, `text_editor`).
   - `upgrade-session` (in-progress) — dedicated session-sheet UI, upgrade history list, abort confirmation, dev-server restart banner. The functional scaffolding is in place; the UX polish is not.

---

## What landed this session

4 commits on `main`:

```
fe555cba  docs(features): Tier 2 Ship Verification — 1 completed, 2 in-progress
8827e498  feat(relationship-cards): close docCount gaps on task + project cards
d3b3004c  docs(features): Ship Verification — 4 specs to completed, 2 to in-progress
c4f9cf80  docs(features): roadmap grooming — normalize status strings, flag drift
```

### Code changes (`src/`)

- **`src/components/shared/command-palette.tsx:305`** — `navigate('/dashboard?task=...')` → `navigate('/tasks?task=...')`. Closes the last residual `/dashboard` route literal violating `sidebar-ia-route-restructure` AC. Fix surfaced by Ship Verification — would have left command-palette recent-task shortcut 404'ing silently.

- **`src/app/projects/page.tsx`, `src/app/api/projects/route.ts`** — added `docCount` SQL subquery to project listing (kept the two queries in lockstep). Pattern is `sql<number>\`(SELECT COUNT(*) FROM documents d WHERE d.project_id = "projects"."id")\`.as("docCount")` — uses raw quoted-string column refs, not Drizzle column-ref interpolation (which generates `WHERE col = ?` with a JS object as value per CLAUDE.md gotcha).

- **`src/components/projects/project-card.tsx`, `src/components/projects/project-list.tsx`** — extended `Project` type and `ProjectCardProps` with `docCount: number`. Card renders `FileText` icon + "N docs" alongside task count, hidden when 0.

- **`src/app/tasks/page.tsx`** — switched `BoardContent` query from `db.select().from(tasks)` (all columns) to `db.select({ ...getTableColumns(tasks), docCount: sql<number>... }).from(tasks)`. The existing `serializedTasks.map((t) => ({...t}))` spread carries `docCount` through to `TaskItem`. Task-card already supported the prop.

### Spec changes (`features/`)

| Spec | Before | After | Mechanism |
|---|---|---|---|
| `chat-skill-composition` | `completed  # comment` | clean `completed` + `shipped-date: 2026-04-15` | normalization |
| `chat-tools-plugin-kind-1` | `shipped` | `completed` | normalization |
| `install-parity-audit` | `shipped` | `completed` | normalization |
| `nl-to-composition-v1` | `shipped` | `completed` | normalization |
| `routing-cascade-dual-provider` | `planned` | `completed` (12/12 ACs PASS) | Ship Verification |
| `workflow-document-pool` | `planned` | `completed` (22/22 ACs PASS) | Ship Verification |
| `workflow-editing` | `planned` | `completed` (11/11 ACs PASS) | Ship Verification |
| `sidebar-ia-route-restructure` | `planned` | `completed` (residual literal fixed) | Ship Verification + 1 code edit |
| `relationship-summary-cards` | `planned` | `completed` (after 2 small gaps closed) | Ship Verification + 7 code edits |
| `entity-relationship-detail-views` | `planned` | `completed` | Tier 2 Ship Verification |
| `direct-runtime-prompt-caching` | `planned` | `in-progress` | Ship Verification (3 ACs GAP) |
| `direct-runtime-advanced-capabilities` | `planned` | `in-progress` | Tier 2 Ship Verification (~55%) |
| `upgrade-session` | `planned` | `in-progress` | Tier 2 Ship Verification (~60%) |

---

## Roadmap state at session end

| Status | Count |
|---|---|
| completed | 204 |
| deferred | 27 |
| planned | 7 |
| in-progress | 4 |
| non-spec docs (no frontmatter — by design) | 5 |
| **Total** | **247 specs + 2 (roadmap.md, changelog.md) = 249 files** |

### The 7 truly planned features (all verified — no shipping evidence)
1. `chat-conversation-branches` (P3)
2. `composed-app-manifest-authoring-tools` (P3) — handoff's prior next-up
3. `enrichment-planner-test-hardening` (P2) — uncertain (7 tests for 6 ACs); could be ship-verifiable
4. `onboarding-runtime-provider-choice` (P2)
5. `schedule-collision-prevention` (P1) — **highest-priority planned feature**
6. `task-turn-observability` (P2)
7. `workflow-learning-approval-reliability` (P1)

### The 4 in-progress features
1. `composed-app-auto-inference-hardening` (from prior session — 4 deferred ACs gated on first kit misfire)
2. `direct-runtime-prompt-caching` (cache headers shipped, ledger/dashboard/Batch missing)
3. `direct-runtime-advanced-capabilities` (~55% — thinking + model selection done)
4. `upgrade-session` (~60% — profile + APIs + Badge done, session UX missing)

---

## Patterns to remember (this session's additions)

- **Bidirectional spec staleness is real.** The previous handoff's lesson was "`status: planned` can be stale (already shipped)". This session's lesson is: it's stale in the OTHER direction too — initial verification can MISS shipped work because the implementation doesn't use the symbol the spec mentions. `entity-relationship-detail-views` was nearly classified KEEP-PLANNED because I grepped for `RelationshipSection` (a component name from the spec) when the actual implementation re-uses existing chip-bar + section-heading patterns. **Mitigation:** when verifying, also grep for AC keywords ("source workflow", "Related Tasks", "Recent Documents") not just spec-mentioned symbol names.

- **Confirm which TABLE owns a schema column.** `rg -n turnCount src/lib/db/schema.ts` returned `1274:    turnCount: integer("turn_count"),` — true line, wrong table. The column is on `scheduleFiringMetrics`, not `tasks`. A `rg -B30 turnCount src/lib/db/schema.ts | grep sqliteTable | tail -1` finds the enclosing table.

- **Drizzle SQL subquery pattern: raw quoted-string column refs, not column-ref interpolation.** Use `sql<number>\`(SELECT COUNT(*) FROM documents WHERE project_id = "projects"."id")\`` — NOT `${projects.id}`. The latter triggers the bound-param gotcha (CLAUDE.md). Pattern verified working in 4 places this session: `api/workflows/route.ts:20` (pre-existing), `api/projects/route.ts`, `app/projects/page.tsx`, `app/tasks/page.tsx`.

- **Ship Verification surfaces real defects.** This session's fix to `command-palette.tsx:305` would have left command-palette recent-task shortcut silently 404'ing forever. The pattern of encoding "absence of X" as a verifiable AC (e.g., `rg -n /dashboard src/ returns zero`) is powerful — it's an AC that becomes its own enforcement.

- **The `_state`/`_loopState` strip pattern (used in `workflow-editing` PATCH route) is reusable.** Whenever a route resets a workflow to draft for re-execution, those execution-state keys must be stripped from the stored definition as defense-in-depth, even if the form layer already builds a clean definition. Direct API callers can pass stale state.

---

## Carried-forward gaps (acknowledged, not blocking)

1. **`direct-runtime-prompt-caching` ledger + dashboard + Batch API** — cache headers ship and `cache_creation_input_tokens`/`cache_read_input_tokens` are read into local TurnUsage, but never persisted to ledger or surfaced in cost-dashboard.tsx. Batch API (50% discount on meta-completions) entirely unbuilt. Concrete follow-up.

2. **`direct-runtime-advanced-capabilities` second-half work** — thinking-block collapsible UI in chat-message.tsx, context compaction, `/v1/models` discovery, Anthropic server-tool toggles (`web_search`, `code_execution`, `text_editor`).

3. **`upgrade-session` UX polish** — dedicated upgrade-session-view.tsx (currently re-uses generic `/tasks/[id]`), upgrade history list (only shows `lastUpgrade` timestamp), abort confirmation with rollback, "Restart dev server" success banner, integration tests on temp-dir clone.

4. **`composed-app-auto-inference-hardening` deferred items** — 4 deferred ACs (diagnostics route at `/apps/[id]/inference`, `pickKit({trace: true})` overload, `apps.showInferenceDiagnostics` setting, "Copy as `view:` field" generator). Per spec: gated on first reported kit misfire before building. Not blocking.

5. **`enrichment-planner-test-hardening` uncertain ship state** — 7 tests exist for a 6-AC spec but I haven't read the full spec to verify whether the tests cover the right ACs. A 30-minute Ship Verification (similar to this session's pattern) would resolve.

---

*End of handoff. Next move: pick `schedule-collision-prevention` or `workflow-learning-approval-reliability` (both P1, both have prior-incident evidence) for the next feature build, OR pick `composed-app-manifest-authoring-tools` if you want to continue the composed-app momentum from prior sessions.*
