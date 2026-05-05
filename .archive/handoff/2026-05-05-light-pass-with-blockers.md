# Handoff: Screengrab Session A done (light pass) — Sessions B–D queued, branching/kit captures deferred

**Created:** 2026-05-05 (Session A of 4 from prior handoff completed)
**Status:** Stage 1 of `/refresh-content-pipeline` (the screengrab pass) is done — but as a *light* pass: 26 screenshots covering all 17 sidebar routes plus the onboarding modal, command palette, and settings model-preference deep capture. The two highest-priority targets the prior handoff called out — **chat branching UI** and **/apps/[id] kit views** — could not be captured in this session due to a feature flag and an empty apps DB respectively. Both deferred with explicit unblock paths below. Stages 2 (`/doc-generator`), 3 (`/user-guide-sync`), 4 (`/book-updater`) still queued.

Prior handoff archived at `.archive/handoff/2026-05-05-refresh-pipeline-stages-1235-deferred.md`.

---

## TL;DR for the next agent

Pick one and run:

1. **Unblock + recapture branching + kit views** (~30 min) — see "Two blocking captures" below. Then re-run `/screengrab` *incrementally* over just `/chat`, `/chat/[id]`, `/apps`, `/apps/[id]`. Lifts Session A from "light" → "complete."
2. **Run Session B (`/doc-generator`)** — proceed with what we have. Light Session A is enough to start doc generation; the missing branching/kit captures land in a follow-up regen of those specific feature docs.
3. **Run Session C (`/user-guide-sync`)** — depends on B. Skip if you didn't run B.
4. **Run Session D (`/book-updater`)** — independent of A/B/C, can run in parallel.

The smartest path is probably **(1) then (2)** in the same session, because the orchestrator's incremental-capture path is cheap and makes Session B's output materially better (no missing screenshots in the highest-impact specs).

## What was captured today

26 PNGs in `screengrabs/`. Manifest at `screengrabs/manifest.json` includes file → feature → description mapping for every shot — this is the doc-generator's primary input.

| Surface | Captures |
|---|---|
| All 17 sidebar routes | Default `*-list.png` per route (sidebar collapsed) |
| Home | `home-list.png` (sidebar expanded — hero), `home-below-fold.png` |
| Onboarding | `onboarding-runtime-modal.png` (4-radio first-launch dialog) |
| Settings deep | `settings-list.png`, `settings-full.png` (full-page), `settings-chat-model-preference.png` (Model preference + Default Model crop) |
| Apps | `apps-list.png` (5 starters visible), `apps-starter-to-chat.png` (post-click handoff) |
| Projects | `projects-detail.png` (drill-down sample) |
| Chat | `chat-list.png`, `chat-detail.png` (no branching UI) |
| Overlays | `command-palette-empty.png` |

## Two blocking captures the prior handoff explicitly demanded

### 1. Chat branching UI (BranchActionButton, BranchesTreeDialog, ⌘Z/⌘⇧Z)

**Blocker:** `isBranchingEnabled()` at `src/lib/chat/branching/flag.ts:19` reads `process.env.AINATIVE_CHAT_BRANCHING === "true"` synchronously. `/api/chat/branching/flag` returns `{enabled:false}` on this dev instance.

**Unblock procedure** (~5 min):
1. Add `AINATIVE_CHAT_BRANCHING=true` to `.env.local`
2. Stop the running dev server (`pkill -f "next dev --turbopack$" && pkill -f "next-server"` then wait 2s — see CLAUDE.md "Clean Next.js restart procedure")
3. Restart: `npm run dev` (in background)
4. Wait for `:3000` to respond; verify `curl -s :3000/api/chat/branching/flag` returns `{"enabled":true}`
5. Capture in this order: `chat-detail.png` (re-take with branching context), `chat-branch-action-button.png` (hover assistant message — uid pattern: `[role="button"][aria-label*="Branch"]`), `chat-branches-tree-dialog.png` (open from row dropdown's "View branches" item — element-level capture of the dialog), `chat-message-rewound.png` (rewind a turn via ⌘Z and screenshot the gray italic placeholder)
6. Restore `.env.local` (remove the line) and restart server again — leaving the flag on changes default behavior for the user

**Note:** The user's currently-running session will be interrupted. Confirm before doing this if user is interactive.

### 2. /apps/[id] kit views (tracker / coach / ledger / inbox / research / workflow-hub)

**Blocker:** `curl :3000/api/apps` returns `[]`. No materialized apps exist on this dev DB. The 5 starters at `.claude/apps/starters/*.yaml` are *templates* clicked-through to chat, not installed apps. Workflow-hub crash regression test from commit `98e6ca3f` could not be verified.

**Unblock options:**
- **Easy (~10 min):** Materialize 6 apps via SQL or by running through the chat-app-builder flow once per kit. Each app needs a manifest under `~/.ainative/apps/<id>/manifest.yaml` (or wherever `getAppRoot()` resolves to — check `src/lib/utils/app-root.ts`). Use the kit registry at `src/lib/apps/view-kits/kits/` to know what manifest each kit expects.
- **Better (~20 min):** Write a one-off seed script that creates one example app per kit (6 apps total), captures `/apps/[id]` for each, then deletes them. Lives at `scripts/seed-apps-for-screengrab.ts` (gitignored). Reuse if next refresh hits the same blocker.
- **Pragmatic (~5 min):** Run the chat composition flow for `finance-pack` once. That materializes one app with the Ledger kit. Captures only `apps-detail-ledger.png` but verifies the route works at all.

The handoff explicitly named workflow-hub as the kit "that was crashing pre-`98e6ca3f`" — so workflow-hub coverage matters most. Find or seed an app whose manifest selects `view: workflow-hub` and capture it.

## Other captures the screengrab skill recommends but I skipped

These are all standard skill phases I deferred to keep this session bounded. None are blocked — they just need a dedicated session each:

- **All Phase 5 forms** — task new (with AI Assist + workflow-from-assist), profile new, project new, workflow new, schedule new, document upload, table new. Estimate: 14-20 screenshots.
- **All Phase 6 journeys** — task lifecycle, project drill-down, inbox action.
- **TrustTierBadge popover** — sidebar footer, click to open.
- **Command palette filtered state** — ⌘K + type "dashboard" → capture filtered results.
- **Density toggle variants** on tables (compact/comfortable/spacious).
- **Saved Views dropdown** open.
- **FilterBar with active filters** applied.
- **Edit forms** for workflows and profiles (`/workflows/[id]/edit`, `/profiles/[id]/edit`).
- **Settings subsections individually** — auth, runtime, budget, presets, permissions, data-management. `settings-full.png` covers them all but as one tall image; per-section element-level crops would be more useful for doc-generator.
- **Inbox expanded notification** — click first notification to expand `ExpandableResult`.
- **Kanban card edit dialog** — click "Edit {task}" button on a kanban card.
- **Kanban bulk select mode** — click "Enter select mode" in column header.
- **Detail-pane right-rail layout** — applicable to routes that use 420px right-rail panels.
- **`/workflows/blueprints`** sub-route — clicking "From Blueprint" on workflows page.
- **Workflow from AI Assist confirmation** — `/workflows/from-assist` route (requires sessionStorage seed; full procedure in skill phase 5f¾).

Pacing note: at the rate this session ran, an exhaustive screengrab is ~3-4 sessions of work. The light pass + the two blocked captures above is probably the right "complete enough" target.

## State changes during this session

- **DB:** temporarily deleted `chat.defaultModel` setting to trigger first-launch modal capture, then restored to `opus`. Modal-skip click also wrote `onboarding.modelPreference = ""` (the "asked and skipped" marker). Both are user-visible writes — if the user wants to see the modal again, they need to delete `onboarding.modelPreference` from `~/.ainative/ainative.db` AND `chat.defaultModel`.
- **Sidebar cookie:** `sidebar_state=true` (expanded) — restored at session end.
- **No code edits, no config edits.**
- **Existing 67 PNGs from prior screengrab schema were deleted** when `/screengrab` ran in force-full mode. New manifest is `screengrabs/manifest.json` (replaces previous schema).

## Process notes for next agent

- The shadcn sidebar **re-expands on every navigation** in this Next.js 16 setup despite the `sidebar_state` cookie being persisted. Workaround: `press_key Control+b` after every `navigate_page` before any `take_screenshot`. The skill warns about this; the cookie-based optimization doesn't work here.
- The `nextjs-portal` element is present on every dev-mode page even with no errors — the skill's error-detection check (`document.querySelector('nextjs-portal')`) returns truthy on healthy pages. Use a stricter check: `nextjs-portal` is only an error if it has children/text content, or pair with `[data-nextjs-dialog]`/`[data-nextjs-toast]` selectors.
- **Don't trust the inline TypeScript diagnostic panel** during this work — it surfaced ~50 phantom "Cannot find module" warnings on freshly-existing modules across this session. Per CLAUDE.md, `npx tsc --noEmit` is the source of truth.
- The prior handoff's stale `--light` mode suggestion for `refresh-content-pipeline` still applies. Add it after Sessions B/C/D land.
