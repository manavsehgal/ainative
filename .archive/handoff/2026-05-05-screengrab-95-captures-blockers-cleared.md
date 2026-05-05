# Handoff: Comprehensive screengrab pass complete (95 captures, all blockers cleared) — Sessions B/C/D ready

**Created:** 2026-05-05 (full screengrab session — replaces the light-pass handoff)
**Status:** Stage 1 of `/refresh-content-pipeline` (the screengrab pass) is now **comprehensive** — 95 PNGs covering every sidebar route, every settings subsection, every create form (including AI Assist + workflow-from-assist), all 6 `/apps/[id]` view kits, full chat branching UI, command palette empty + filtered, trust-tier popover, inbox expanded + permissions, tables detail tabs (Data/Charts/Triggers/Details), tables templates page, plus a new app-builder journey. The two highest-priority deferrals from the prior handoff (chat branching, /apps/[id] kit views) are **both cleared**. Stages 2 (`/doc-generator`), 3 (`/user-guide-sync`), 4 (`/book-updater`) queued.

Prior handoff archived at `.archive/handoff/2026-05-05-light-pass-with-blockers.md`.

---

## TL;DR for the next agent

Pick one (in order of biggest payoff):

1. **Run Session B (`/doc-generator`)** — proceed with the 95 captures. Doc-generator will refresh feature docs, journey docs, README. Add an "App Builder" persona journey (see "App Builder journey: doc work needed" below).
2. **Run Session C (`/user-guide-sync`)** — depends on B. Mirrors `screengrabs/` into `public/readme/` and validates journey screenshot references.
3. **Run Session D (`/book-updater`)** — independent of A/B/C, can run in parallel with B.

Recommended: **start B now**. The captures are stable; manifest is up to date; no blockers remain.

## What was captured (95 PNGs)

| Surface | Captures |
|---|---|
| All 17 sidebar routes | Default `*-list.png` per route |
| Home | hero (sidebar expanded) + below-fold |
| Onboarding | first-launch runtime modal |
| Chat — branching UI | `chat-detail` (re-taken with branching), `chat-branch-action-button`, `chat-branch-create-dialog`, `chat-branches-tree-dialog`, `chat-message-rewound` |
| Chat — composer popovers | `chat-mentions-popover`, `chat-slash-popover` (Actions tab), `chat-tools-tab`, `chat-skills-tab` |
| /apps/[id] view kits | `apps-detail-tracker`, `apps-detail-coach`, `apps-detail-ledger`, `apps-detail-inbox`, `apps-detail-research`, `apps-detail-workflow-hub` |
| Settings subsections (element-level) | `settings-instance`, `settings-auth`, `settings-runtime`, `settings-channels`, `settings-budget`, `settings-presets`, `settings-permissions`, `settings-snapshots`, `settings-data` (plus existing `settings-list`, `settings-full`, `settings-chat-model-preference`) |
| Tasks — alternate views | `tasks-table`, `tasks-detail`, `tasks-card-edit`, `tasks-bulk-select` |
| Tasks — AI Assist flow | `tasks-create-form-empty`, `-filled`, `-ai-assist`, `-ai-breakdown`, `-ai-applied`, `tasks-workflow-confirm` |
| Workflows | `workflows-detail`, `workflows-blueprints`, `workflows-create-form-empty`, `-delay` |
| Profiles | `profiles-detail`, `profiles-create-form-empty`, `-filled` |
| Schedules | `schedules-detail` (sheet, element-level), `schedules-create-form-empty`, `-filled` |
| Documents | `documents-grid`, `documents-detail`, `documents-upload-form` |
| Tables | `tables-detail` (Data tab), `-charts`, `-triggers`, `-details`, `tables-create-form-empty`, `-filled`, `tables-templates` |
| Projects | `projects-create-form-empty`, `-filled` (already had `-detail`) |
| Costs | `cost-usage-below-fold` |
| Inbox | `inbox-expanded`, `inbox-fully-expanded`, `inbox-permissions` |
| Overlays | `command-palette-empty` (existed) + `command-palette-search` (filtered), `trust-tier-popover` |
| Phase 6 journeys | `journey-task-created`, `journey-task-detail`, `journey-project-tasks`, `journey-inbox-action`, `journey-app-builder-overview`, `journey-app-builder-starter-handoff`, `journey-app-builder-detail` |

Manifest: `screengrabs/manifest.json` (95 entries with file → page → view → route → type → features → description). Last-run timestamp: `screengrabs/.last-run`.

## How the blockers were cleared

### Chat branching (was: blocked by env flag)
- Added `AINATIVE_CHAT_BRANCHING=true` to `.env.local` for the duration of capture, then **REMOVED**. `.env.local` is back to its pre-session state.
- Cleanly restarted dev server twice (start with flag on, end with flag off) targeting only the `:3000` listener PID — never `pkill -f "next dev"` (memory feedback in CLAUDE.md is explicit about this).
- Tested via curl: `/api/chat/branching/flag` returns `{"enabled":false}` after restoration. Default user behavior is unchanged.
- Captures used the existing 18-message conversation `473ee5cb-…-edfd` ("Deal review: Meridian Corp stall"). One actual branch was created during capture (`4c20e275-…`) so the BranchesTreeDialog could show parent + child. Both conversations remain in the DB.

### /apps/[id] kit views (was: blocked by empty apps registry)
- Wrote 6 manifest YAMLs at `~/.ainative/apps/demo-{habit-tracker,portfolio-coach,expense-ledger,lead-inbox,research-pad,ops-hub}/manifest.yaml`. Each composes one or more **existing builtin profiles + blueprints** (no new code, no new primitives). All 6 register cleanly via the apps registry's YAML loader.
- Encountered one schema gotcha: `AppTableRefSchema.columns` is `z.array(z.string())` (bare strings), not `z.array(z.object(...))`. First 4 manifests had column objects → silently failed to parse → invisible in `/api/apps`. Fixed in-place.
- All 6 kit views render. **Workflow-hub regression test from commit `98e6ca3f` verified — `/apps/demo-ops-hub` renders cleanly with 4 blueprints + cadence chip + 3 KPI tiles, no crash.**
- The 6 demo apps remain seeded in `~/.ainative/apps/`. They're benign, all prefixed `demo-`, and can be deleted from the /apps UI when no longer needed.

## App Builder journey: doc work needed (next session)

The user explicitly asked to add a user journey for app building. Screenshots are captured (`journey-app-builder-overview.png`, `-starter-handoff.png`, `-detail.png`), but the journey doc itself is **not yet written** because:

1. `/doc-generator` skill currently lists 4 personas (`personal-use.md`, `work-use.md`, `power-user.md`, `developer.md`). Adding a 5th requires an edit to the skill's Phase 5 persona table at `.claude/skills/doc-generator/SKILL.md`.
2. The journey screenshots are ready and the `journey-app-builder-*` filenames follow the standard naming convention, so doc-generator will find them automatically once the persona is added.

**Recommended for next agent:**
- Edit `.claude/skills/doc-generator/SKILL.md` Phase 5 table to add a 5th persona row:
  | App Builder | `app-builder.md` | beginner | Compose an app: pick a starter → seed prompt in chat → install primitives → use the kit-aware view | Apps, Chat, /apps/[id] |
- Update Persona Data Profiles table with a 5th persona (e.g., "Casey — solo entrepreneur — `Personal Habit Tracker` — `Log today's run`").
- Add `App Builder` to the Journey Screenshot Hints table mapping `journey-app-builder-*.png` → step contexts.
- Then re-run `/doc-generator` — it will pick up the new persona and the existing screenshots.

## Other captures the screengrab skill recommends but were intentionally skipped

The manifest now lists **zero deferred** items, but a few minor ones could still be added in a future polish pass:
- Density toggle variants (`{page}-density-compact.png`, `-spacious.png`) on tasks/documents/tables — the tasks density toggle wasn't surfaced in this UI version.
- Saved Views dropdown open state.
- FilterBar with active filters applied.
- Detail-pane right-rail layout — none of the routes I visited use the split layout in current state.
- Edit forms for workflows/profiles (`/workflows/[id]/edit`, `/profiles/[id]/edit`) — `tasks-card-edit.png` covers the inline-dialog edit pattern; the dedicated edit pages weren't captured.

None of these block doc-generator. They can be added incrementally on the next refresh.

## State changes during this session

- **`.env.local`:** added `AINATIVE_CHAT_BRANCHING=true`, then **removed**. Reverted to original 12 lines. Verified via diff.
- **`~/.ainative/apps/`:** 6 new directories with `manifest.yaml` files (demo apps). Persistent. Safe to delete via /apps UI.
- **DB:** one new branched conversation row (`4c20e275-…`) created when exercising the Branch button. Persistent (no harm). The parent `473ee5cb-…` conversation has one user+assistant turn marked as rewound (`rewound_at` non-null) — UX-visible but reversible by clicking ⌘⇧Z while focused on that conversation.
- **Sidebar cookie:** ended in collapsed state (`sidebar_state` cookie). Will re-expand on the user's next visit if their preference was expanded.
- **No code edits.**
- **Dev server:** restarted twice cleanly. Currently running on `:3000` with the original env (no branching flag).

## Process notes for next agent

- **Always target the `:3000` PID by `lsof -ti :3000 -sTCP:LISTEN`**, then kill that PID (and its immediate children via `pgrep -P`). Never use `pkill -f "next dev --turbopack"` — it can hit the user's parallel dev instances (stagent-growth etc.). Memory feedback in CLAUDE.md is explicit about this.
- **Apps cache TTL is 5 seconds** — when writing new manifests, either wait 6s before hitting `/api/apps` or restart the dev server (which clears the module-level cache too). The handler doesn't fire `invalidateAppsCache()` on filesystem writes that don't go through the chat-tool path.
- **Apps schema gotcha:** `tables[].columns` must be `array<string>`, not `array<object>`. Object columns silently fail Zod parsing → app vanishes from registry. Look at `src/lib/apps/registry.ts:128` for the exact shape.
- **Branching flag:** `src/lib/chat/branching/flag.ts:19` reads `process.env.AINATIVE_CHAT_BRANCHING === "true"` synchronously per-request — no DB row, no settings row, just env. Toggling requires a dev-server restart.
- **TS diagnostic noise:** the inline panel surfaced ~150 phantom "Cannot find module" warnings throughout this session. Per CLAUDE.md, trust `npx tsc --noEmit` over the diagnostics panel.
- **Element-level capture works well for sheet/dialog content.** Tag the parent card with `role="region"` + `aria-label="Settings:section-slug"` via `evaluate_script`, then the next `take_snapshot` exposes a distinct uid you can pass to `take_screenshot`. Used this pattern for all 9 settings subsections.

## Recommended next-session sequence

1. Edit `.claude/skills/doc-generator/SKILL.md` to add the App Builder persona (Phase 5 table + Persona Data Profiles + Journey Screenshot Hints).
2. Run `/doc-generator` (Session B). It should produce `docs/journeys/app-builder.md` plus refresh the other 4 journey docs, all 18 feature docs, the index, getting-started, manifest, and README.
3. Run `/user-guide-sync` (Session C) — mirrors `screengrabs/` to `public/readme/` and validates journey screenshot references.
4. Run `/book-updater` (Session D) in parallel with B if helpful.
5. After all pipeline stages land: optionally delete the 6 `demo-*` apps via the /apps UI (or leave them — they're harmless).
