# Handoff: Composed Apps Domain-Aware View — strategy + 7 feature specs ready for Phase 1

**Created:** 2026-05-01 (late evening)
**Status:** Strategy doc and 7 phased feature specs landed. **No code changes yet** — next session starts implementation at Phase 1. Working tree has uncommitted strategy + spec docs; `main` is 2 commits ahead of `origin/main` carrying the noun-aware compose hint + its predecessor handoff (push not done).
**Author:** Manav Sehgal (with Claude Opus 4.7 assist)
**Predecessor:** `.archive/handoff/2026-05-01-noun-aware-compose-hint-shipped-handoff.md`

---

## TL;DR for the next agent

1. **Composed apps now have a build plan.** Strategy doc at `ideas/composed-apps-domain-aware-view.md` (from `/frontend-designer` + `/architect` joint brainstorm) replaces today's manifest-viewer per-app screen with a kit dispatcher + 6 domain-aware view kits. `/product-manager` extracted **7 phased feature specs** under `features/composed-app-*.md`. Roadmap section "Composed Apps — Domain-Aware View" added; changelog entry on 2026-05-01.

2. **Start at Phase 1, in this exact order.** Two P1 features must ship first; they're tightly coupled and unblock everything:
   1. `composed-app-view-shell` — dispatcher route refactor + KitDefinition / ViewModel types + Manifest sheet
   2. `composed-app-manifest-view-field` — strict Zod `view:` field + 7-rule `pickKit` decision table + golden-master tests

   Phase 2 (`composed-app-kit-tracker-and-hub`) is the first feature that delivers user-visible value — Workflow Hub becomes the fallback for every existing app, Tracker covers habit-tracker / reading-radar.

3. **One open question to decide before Phase 1 starts.** `composed-app-auto-inference-hardening` (Phase 5) introduces an optional `userTableColumns.config.semantic` field stored inside the existing JSON `config` blob. **If it should be a real column instead, that decision belongs in Phase 1's schema work, not deferred.** Worth a 5-min think before opening the first PR — see "Open question" section below.

4. **Working tree is dirty with the spec docs.** 7 new feature files + roadmap + changelog modifications + strategy doc in `ideas/`. None committed. Recommend a single docs commit covering all of them ("docs(features): groom composed-apps domain-aware view — strategy + 7 specs") before starting Phase 1 implementation. The strategy doc in `ideas/` is gitignored per project memory; the rest are tracked.

---

## What landed this session (no code, just specs)

```
features/composed-app-view-shell.md                       (Phase 1, P1, 127 lines)
features/composed-app-manifest-view-field.md              (Phase 1, P1, 141 lines)
features/composed-app-kit-tracker-and-hub.md              (Phase 2, P1, 177 lines)
features/composed-app-kit-coach-and-ledger.md             (Phase 3, P2, 189 lines)
features/composed-app-kit-inbox-and-research.md           (Phase 4, P2, 178 lines)
features/composed-app-auto-inference-hardening.md         (Phase 5, P2, 138 lines)
features/composed-app-manifest-authoring-tools.md         (Phase 5, P3, 162 lines)
features/roadmap.md                                       (modified — new section)
features/changelog.md                                     (modified — 2026-05-01 entry)
ideas/composed-apps-domain-aware-view.md                  (strategy, gitignored)
.claude/plans/the-user-composed-apps-enumerated-island.md (the original plan-mode draft)
```

All 7 spec files are within the 80-400 line target band. Each is self-contained — a developer can pick one up without reading the others.

---

## Build order (the part the user asked for)

The dependency chain is strictly linear from Phase 1 → 5 with one fork in Phase 5. Each row below is one Claude Code session worth of work (1-3 sessions for the larger ones). Sessions stack: do not start Phase N+1 until Phase N's browser smoke passes.

### Phase 1 — Foundation (start here)

| Order | Feature | Priority | Rough sizing | Why first |
|---|---|---|---|---|
| 1 | `composed-app-view-shell` | P1 | 1-2 sessions | Lands `KitDefinition` / `ViewModel` types + dispatcher route + Manifest sheet. No behavior change for users (manifest peek moves into a sheet, accessible from header). Unblocks every later feature. |
| 2 | `composed-app-manifest-view-field` | P1 | 1 session | Adds strict `view:` field to `AppManifestSchema` + the deterministic 7-rule `pickKit` function. Golden-master test ensures every existing starter app still parses. Replaces the `pickKit` stub from feature #1. |

**Phase 1 gate:** browser smoke on `/apps/habit-tracker` — page renders dispatcher path with placeholder kit; "View manifest ▾" sheet opens; no regression on `/apps` index.

### Phase 2 — First two real kits

| Order | Feature | Priority | Rough sizing | Why second |
|---|---|---|---|---|
| 3 | `composed-app-kit-tracker-and-hub` | P1 | 2-3 sessions | Ships Workflow Hub (fallback for every app — replaces placeholder immediately) AND Tracker (covers habit-tracker, reading-radar). Lands 4 shared primitives all later kits reuse: `KPIStrip`, `LastRunCard`, `ScheduleCadenceChip`, `RunNowButton`. KPI evaluation engine (`evaluateKpi`) lands here. |

**Phase 2 gate:** `/apps/habit-tracker` shows real Tracker layout (table-spreadsheet hero, KPI strip, cadence chip); any other app falls back to Workflow Hub with run-rate / success / cost KPIs. Manifest auto-inference picks `tracker` for habit-tracker without explicit `view:`.

### Phase 3 — Domain pair: Coach + Ledger

| Order | Feature | Priority | Rough sizing | Notes |
|---|---|---|---|---|
| 4 | `composed-app-kit-coach-and-ledger` | P2 | 2-3 sessions | Coach for digest apps (weekly-portfolio-check-in), Ledger for finance-pack. Lands `TimeSeriesChart` (recharts wrapper) and `RunCadenceHeatmap`. Adds `LastRunCard` `hero` variant (markdown body + citations bar). Ledger gets a period selector (MTD/QTD/YTD chip group). |

**Phase 3 gate:** weekly-portfolio-check-in renders Coach (latest digest as hero); finance-pack renders Ledger (KPIs + TimeSeriesChart + DonutRing + transactions table); no regression on Tracker / Hub.

### Phase 4 — Domain pair: Inbox + Research

| Order | Feature | Priority | Rough sizing | Notes |
|---|---|---|---|---|
| 5 | `composed-app-kit-inbox-and-research` | P2 | 2-3 sessions | Inbox (queue + draft, two-pane via existing `DetailPane`) for customer-follow-up-drafter; Research (sources + synthesis with citation chips) for research-digest. Lands `RunHistoryTimeline` primitive + `detectTriggerSource` helper. Inbox suppresses Run Now for row-insert apps and shows a passive trigger-source chip. |

**Phase 4 gate:** customer-follow-up-drafter renders queue + draft split with selectable rows; research-digest renders sources + synthesis with citation chips that highlight matching rows.

### Phase 5 — Polish (parallelizable; one P2 + one P3)

| Order | Feature | Priority | Rough sizing | Notes |
|---|---|---|---|---|
| 6 | `composed-app-auto-inference-hardening` | P2 | 1-2 sessions | Tiered column-shape probes (semantic → format → regex), expanded inference test suite (≥25 cases), gated `/apps/[id]/inference` diagnostics page with "Copy as `view:` field" generator. **See open question below — may pull schema work earlier into Phase 1.** |
| 7 | `composed-app-manifest-authoring-tools` | P3 | 1-2 sessions | Three new chat tools (`set_app_view_kit`, `set_app_view_bindings`, `set_app_view_kpis`); chat tool count 92 → 95. `<AppViewEditorCard/>` chat surface. Planner hint for view-editing intents. **Genuinely nice-to-have** — most users will be fine on auto-inference forever. |

Phase 5 features have no dependency on each other; whichever is more interesting can ship first once Phase 4 lands.

### Critical-path sketch

```
Phase 1.1 (shell) ─► Phase 1.2 (view-field) ─► Phase 2 (tracker + hub)
                                                  │
                                                  ├─► Phase 3 (coach + ledger)
                                                  │     │
                                                  │     └─► Phase 4 (inbox + research)
                                                  │           │
                                                  │           ├─► Phase 5 (inference hardening)
                                                  │           └─► Phase 5 (authoring tools)
                                                  │
                                                  └─ At Phase 2 gate, every existing app
                                                     already has a usable domain view via
                                                     Workflow Hub fallback.
```

The "minimum viable Composed Apps Domain View" ships at the end of Phase 2 — that's the gate worth caring about. Phases 3-5 are domain-pair refinements.

---

## Open question (decide before Phase 1 PR)

**Where does `userTableColumns.config.semantic` live?**

Phase 5's `composed-app-auto-inference-hardening` introduces an optional `semantic` field on column config (values: `currency | date | boolean-flag | url | email | notification | message-body`). The spec stores it inside the existing JSON `config` blob — **no DB migration**. That's the path of least resistance and Phase 5 plans for it.

But: if `semantic` should be a real, queryable column on `user_table_columns`, that's a migration that belongs in Phase 1's schema work alongside `ViewSchema`, not deferred 4 phases. Migrations are easier to land before kits start consuming the data than retrofitted later.

**Two options, decide before opening the first Phase 1 PR:**

| Option | Where it lives | Cost | Tradeoff |
|---|---|---|---|
| **A** (current spec): JSON config field | Inside `column.config` blob | Zero migration; opt-in adoption | Slower querying (json_extract); slightly weaker validation |
| **B** (alternative): Real column | New nullable column on `user_table_columns` | One migration in Phase 1 | First-class column; type-safe queries; tighter inference probes |

Probably **Option A** — the strategy explicitly avoids DB migrations across all 7 features, the JSON path is consistent with how `column.config` already works, and `semantic` only matters for inference (≤6 reads per page render). But worth a deliberate 5-min think before defaulting.

---

## Carryover from prior session (not superseded by today's work)

### Free-form compose hardening (2 sub-items, ~2 hr)

1. **"Extend existing app" affordance (~1.5-2 hr).** Today the planner has no `extend_app` mode — every compose creates a new app. If a user says `"add to my Habit Loop app"` there's no path. Needs a new planner mode + chat-tool + classifier branch + tests. Phase 2 smoke caught the LLM narrating "I'll wire the app into the existing Habit Loop project" but actually creating a fresh `habit-tracker` project. Independent of the Composed Apps Domain View work — could ship interleaved if a session prefers compose-hardening over kit-building.

2. **30-day soak on the 440-char generic hint.** Passive. Telemetry-gated, not actionable today.

### LLM smoke for noun-aware hint (~5 min when extension is up)

Deterministic side of commit `8acc55fa` is fully covered by unit tests. The LLM-side observation — does the model actually compose without scaffolding when given the new hint? — was not run because the Claude in Chrome extension was offline. Quick smoke when extension is back:

- Send `"build me a github habit tracker"` in chat (dev server up).
- Expected: compose card titled "Habit Tracker" with profile + blueprint + tables, AND a prose mention of "you'll need to scaffold a separate plugin to access github."
- Negative signal: a scaffold card means the routing change didn't land OR the LLM ignored the hint.

Browser fallback chain per project memory: Claude in Chrome → retry once → Chrome DevTools → Playwright.

### Apps consumers — extract `useDeleteApp(args)` hook

Premature today (only 2 consumers). CLAUDE.md DRY-with-judgment says extract on third. Wait until a third surface needs delete.

---

## Repo state (audited 2026-05-01 ~late evening)

### Git
- Working tree dirty: 2 modified files (`features/changelog.md`, `features/roadmap.md`) + 7 new feature spec files. The strategy doc at `ideas/composed-apps-domain-aware-view.md` is gitignored per project memory (`gitignored-local-folders.md`).
- `main` is **2 commits ahead of `origin/main`** — `8acc55fa` (noun-aware compose hint) + `a88623e3` (the predecessor handoff doc). Push not done.

### Database & disk
Unchanged from predecessor handoff. 11 projects. 13 user_tables, 13 schedules, 4 user_table_triggers. `~/.ainative/apps/` has only `habit-tracker/`. FK-orphan audit recipe still passes (0 rows on 2026-05-01).

---

## Key patterns to remember

### From this session
- **Plan-mode + Skill collaboration produces tight specs.** Spawning `/frontend-designer` and `/architect` in parallel as Plan agents (each given the same exploration findings) yielded two converging recommendations that merged cleanly into one strategy. Worth repeating for any feature that has both UX and architecture surface area.
- **Phase 2 is the gate that matters.** A strategy with 7 features can demoralize. The build order above is structured so that Phase 2's completion already gives every existing app a domain-aware surface (Workflow Hub fallback). Phases 3-5 are refinements, not blockers. Use the Phase 2 gate as the "is this initiative working?" decision point.
- **Spec frontmatter dependencies are load-bearing.** Each `composed-app-*.md` has explicit `dependencies:` — those drive the build order in this handoff. Future-you should not start a feature whose deps aren't `completed` in the roadmap.

### Carried over and still relevant
- **Browser-smoke gap is real but bounded.** Deterministic prompt-construction can be verified via `npx tsx --eval` even when Claude in Chrome is offline. Don't block commits on LLM smoke if the deterministic path is fully tested — note the gap in the handoff and move on.
- **`APP_INTENT_WORDS` is the cleavage line between scaffold and compose for noun-bearing prompts.** App-intent words ("app", "tracker", "dashboard", "workflow") route to compose; absence routes to scaffold via the noun-guard short-circuit.
- **HANDOFF interpretation is itself a skill.** When predecessor language is technically muddy, fall back to: what does the user actually want? Build to that.

---

*End of handoff. Next move: decide the open question (5 min), commit the spec docs as one squashed docs commit, push the 2-commit lead to `origin/main` if user okays, then start `composed-app-view-shell` (Phase 1.1).*
