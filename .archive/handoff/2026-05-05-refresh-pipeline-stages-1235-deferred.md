# Handoff: Refresh content pipeline — deferred heavy delegations after 7-week gap

**Created:** 2026-05-05 (Path A light pass complete; Stages 1, 2, 3, 5 deferred to dedicated sessions)
**Status:** Stages 0 + 4 of `/refresh-content-pipeline` ran inline. Stages 1, 2, 3, 5 too large to nest in one session — listed below as separate next-session entrypoints. Prior HANDOFF (build-me-app smoke) archived at `.archive/handoff/2026-05-04-build-me-app-smoke-completed.md`. The 4 follow-up findings from that smoke were already resolved in commit `98e6ca3f`.

---

## TL;DR for the next agent

696 files changed since the last refresh (2026-04-18). The orchestrator's incremental cascade was designed for ~1-3 affected routes per run — this scope (7 weeks, full IA-affecting features) blew past the design point. Light pass ran today; heavy delegations are queued. Pick one of the four sessions below, or run them in order. Each is independent and can ship its own commit.

**1 auto-edit** (committed-ready): `README.md:68` `25-year career` → `25-year arc` (matches live ainative.business/about).
**4 reported-drift items** logged in `.refresh-pipeline/last-run.json` — one of them (Post-MVP feature table) needs manual rewrite, not a number swap.

## Recommended next-session sequence

Run in this order — each consumes the previous one's output:

### Session A — `/screengrab` (force-full mode)

**Why force-full:** ~13+ routes affected. Beyond UI-component changes, structural changes have shipped: new `/apps` and `/apps/[id]` routes (TDR-037 Phase 2+3), 5-group sidebar IA, chat conversation branches UI on `/chat` (BranchActionButton, BranchesTreeDialog, ⌘Z/⌘⇧Z keybindings), onboarding runtime modal on first-launch home, task-turn-observability columns on `/tasks`, composed-app kits (Coach, Ledger, Tracker, Workflow Hub, Inbox, Research) rendered under `/apps/[id]`, AppMaterializedCard + AppViewEditorCard in chat.

**Coverage gaps the screengrab skill should specifically exercise:**
- `/apps` list view + each starter (`finance-pack`, `reading-radar`, `customer-follow-up-drafter`, `habit-tracker`, `research-digest`, `weekly-portfolio-check-in`)
- `/apps/[id]` detail with each of the 6 kit views — especially `workflow-hub` (was crashing pre-`98e6ca3f`; verify fix holds)
- `/chat` with branching UI: branch action button on assistant messages, BranchesTreeDialog from the row dropdown's "View branches" item
- First-launch home with the runtime preference modal
- Settings — new "Model preference" Select alongside the existing "Default Model" Select

**Watch for:** the existing 67 `.png` files use the old screengrab manifest schema; expect orphan churn after force-full.

### Session B — `/doc-generator`

Runs after Session A so screenshots are current. Regenerate:
- 4 journey docs (Personal, Work, Power User, Developer) — sidebar IA changed, `/apps` is a new surface
- ~21 per-feature docs — many feature spec status transitions (`planned` → `completed`) since 2026-04-18
- New feature docs to add: `chat-conversation-branches`, `composed-app-*` (5 specs), `onboarding-runtime-provider-choice`, `task-turn-observability`, `nl-to-composition-v1`, `chat-tools-plugin-kind-1`, `primitive-bundle-plugin-kind-5`, etc.

### Session C — `/user-guide-sync`

Light, runs after B. Sync screengrabs to `public/readme/`, validate journey screenshot references, detect orphans, write `docs/.coverage-gaps.json`. If `gapCount > 0`, re-invoke `/doc-generator` once with the gaps file (the orchestrator's stage 3→2 feedback loop, but applied manually here).

### Session D — `/book-updater`

All 14 chapters need review. Schema, profiles, workflows, chat-side composition, plugin platform are all new ground in scope:
- M3 plugin platform (Kind 1 chat-tools, Kind 5 primitive bundles, capability gates, trust model) — new chapter material; possibly affects ch-9 (governance) and ch-11 (machine that builds machines)
- M4.5 nl-to-composition (planner, classifier, primitive map, composition hint, ExtensionFallbackCard) — affects ch-2 (blueprint), ch-3 (refinery), ch-5 (blueprints)
- Composed-app kits (6 kits) — affects ch-5 (blueprints), ch-13 (wealth manager case study)
- Chat conversation branches (rewind/redo/branch) — affects ch-7 (institutional memory)
- Onboarding runtime provider choice + task-turn-observability — affects ch-9 (governance)

## Manual cleanup the orchestrator can't auto-edit

### `README.md:555-579` — Post-MVP feature table is significantly stale

Header reads "Post-MVP — 52 features shipped" but `snapshot.completed=211`, so Post-MVP is ~197. The categorized list below it (11 categories totaling ~67 features) is also missing entire feature groups shipped over the last 7 weeks:

- **Plugin Platform** (M1+M2+M3) — Kind 5 primitive bundles, Kind 1 chat tools, capability gates, trust model, schedules-as-yaml-registry, finance-pack + reading-radar + echo-server dogfood plugins
- **Composed Apps** (TDR-037 + 7 specs) — view-shell, view: field, kit-tracker, kit-coach, kit-ledger, kit-inbox, kit-research, kit-workflow-hub, manifest-authoring-tools, auto-inference-hardening, AppMaterializedCard, AppViewEditorCard
- **NL-to-Composition** (M4.5) — planner, classifier, primitive-map, composition-hint, view-editing-hint, ExtensionFallbackCard, scaffold API, chat-shell event handler
- **Chat enhancements** — conversation branches Phase 1+2, app-view-tools, plugin-spec-tools, schedule-spec-tools (chat-tool count 85 → 99)
- **Onboarding + Observability** — runtime-preference-modal, model preference settings, task turnCount/tokenCount columns
- **Tables** — enrichment-planner test hardening, row-trigger-blueprint-execution, profile-runtime-default-resolution

Recommend: rewrite this section using `features/changelog.md` (entries from 2026-04-18 onward) as the source of truth. The change should add ~145 lines of categorized rows across the categories above.

### Other reported drift (lower priority)

- README ABOUT-block "Short version" carries an extra sentence the live page no longer has.
- README ABOUT-block "Personal research project" structure differs from the live page.
- README ABOUT-block credentials format is potentially fine — WebFetch's HTML→markdown conversion is ambiguous on bullet pairing.

These are all flagged in `.refresh-pipeline/last-run.json` under `notes.reportedDrift`. Path A's auto-edit policy intentionally skips structural changes in the ABOUT block to avoid silently corrupting prose; if you decide the live page is canonical, do the rewrite by hand.

## Snapshot deltas (`features/stats/snapshot.json`)

- `features.completed` 186 → **211** (+25)
- `features.planned` 15 → **0** (15 promoted to completed)
- `features.inProgress` 0 → **4**
- `chatTools` 85 → **99** (+14)
- `skills.codex` 36 → **35** (-1, consolidation)
- `dbTables` **45**, `builtinProfiles` **21**, `workflowBlueprints` **13`, `skills.claude` **25**, `skills.shared` **22**, `referenceLibraries` **4** — unchanged

## Files written today

- `features/stats/snapshot.json` — regenerated
- `.claude/reference/ainative-business-about/about.md` — refreshed from live (was 2026-04-17, ainative.io domain, pre-rebrand wording)
- `README.md` — 1 word edit (career → arc)
- `.refresh-pipeline/last-run.json` — full state file with deferred-stage notes
- `.archive/handoff/2026-05-04-build-me-app-smoke-completed.md` — archived prior handoff

## Process notes

- The orchestrator skill should likely grow a `--light` flag (or auto-detect "scope too large") so future 7-week refreshes don't have to be split manually. Worth filing under `.claude/skills/refresh-content-pipeline/` after Sessions A-D land.
- The captured-reference baseline at `.claude/reference/ainative-business-about/about.md` is now fresh — Stage 4's ABOUT diff in the next refresh will be a real comparison against today's live wording, not against a stale 2026-04-17 snapshot.
- `features/retros/` still does not exist; velocity in `snapshot.json` is git-derived (124 commits / 55 feat-or-fix in last 7d). Run `/supervisor` retrospective at some point to upgrade the velocity source.
