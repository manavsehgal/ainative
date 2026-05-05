# Handoff: "Build me an app" end-to-end smoke — paused mid-Phase-2 on Enter-key regression

**Created:** 2026-05-04 (smoke session paused after user reported a chat-input regression)
**Status:** Smoke partially executed — Phases 0, 1 complete; Phase 2 (chat composition) paused mid-flight after user flagged that Enter-to-submit "was working just fine until prior releases." Working tree is clean (no code edits this session). Predecessor handoff archived at `.archive/handoff/2026-05-03-roadmap-drift-reconciliation.md`.
**Plan file:** `/Users/manavsehgal/.claude/plans/review-the-build-me-humming-perlis.md`

---

## TL;DR for the next agent

1. **The user reported a regression: Enter key no longer submits in the chat input box.** Their words: *"is enter not working in prompt box a bug? it was working just fine until prior releases."* This is the highest-priority finding from this session and the reason the smoke paused. The static code in `src/components/chat/chat-input.tsx:200-203` looks correct (`if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }`), but the user's lived experience says it isn't firing. **Next session must reproduce with real human keyboard typing on a clean DB and root-cause before continuing the smoke.** Suspect surfaces: the Phase 2 branches commit `17a6fc5b` added `useChatSession()` hook usage at line 54-57 of chat-input.tsx; if the provider's `branchingEnabled`/`rewindLastTurn`/`restoreLastRewoundPair` are unstable across re-renders, the `handleKeyDown` useCallback dep array may invalidate every render and the listener bound to the textarea may go stale.

2. **Three other smoke findings worth carrying forward (all secondary to the Enter bug):**
   - **Apps-disk vs. projects-table drift** — 5 manifests on disk (`customer-follow-up-drafter`, `finance-pack`, `habit-tracker`, `research-digest`, `weekly-portfolio-check-in`) but only 3 of them have a row in `projects` (`habit-tracker`, `customer-follow-up-drafter`, `research-digest`). `finance-pack` and `weekly-portfolio-check-in` were hand-crafted Phase 3 smoke fixtures (`description: "Phase 3 smoke — Ledger kit hand-crafted manifest (bypasses chat composition)"`) — likely intentional but worth confirming whether the dispatcher/apps-index needs both stores to agree.
   - **Apps index "Start from a template" only renders 4 of 5 starters** — Habit Tracker is in the apps list but missing from the template card grid at `src/app/apps/page.tsx`. Sibling drift question.
   - **Chat input has 6 quick-action submit buttons (`Start from template / Explore / Create / Debug / Automate / Smart picks`) but no obvious "Send" affordance.** When I clicked "Create," it opened a sub-menu of starter prompts (`Help me create a new task / Set up a multi-step workflow / ...`) — confirming these are intent-router buttons, not send buttons. If Enter is the only send mechanism, the regression is a P0 because there is no fallback button. Worth verifying whether the design ever included a visible Send button or always relied on Enter.

3. **What `reading-log` (the new app from this smoke) looks like on disk.** Composition started but did not complete before the session paused. Manifest at `~/.ainative/apps/reading-log/manifest.yaml` has: 1 profile (`reading-log--digest`), 1 blueprint (`reading-log--weekly-digest`), 1 table (4 cols: title/author/date_finished/rating), 1 Friday-5pm schedule. **No `view:` field** — auto-inference will pick the kit. Per inference rule 3 (`/digest|report|summary/` blueprint id + schedule), expected kit is `research`. Whether the manifest is complete-enough for the dispatcher to render is unverified — the chat composition stalled at the assistant's "I'll compose your Daily Reading Log app..." opening line and the next-session smoke should either resume or scrap this app and start fresh.

---

## What was actually verified this session (✅) and what wasn't (❌)

### Phase 0 — Pre-flight ✅
- Port 3000 free; `.git/ainative-dev-mode` sentinel present; dev-mode gate fires correctly (`[instance] bootstrap skipped: dev_mode_sentinel` in dev log).
- `npm run dev` starts in 288ms; scheduler/channel-poller/auto-backup boot cleanly.
- Pre-state captured: 5 apps on disk, 13 rows in `projects`.
- Cosmetic: dev-server emits `⚠ ./ainative/src/lib/plugins/transport-dispatch.ts Module not found: Can't resolve <dynamic>` repeatedly. Compile-time warning, not a runtime fault — mcp-loader uses dynamic `import()` and Next.js's webpack/turbopack analyzer can't statically resolve it. Probably ignore-able but worth a one-pass investigation if it has gotten louder recently.

### Phase 1 — Homepage + Apps index ✅
- `/` renders dashboard cleanly (8 tasks running, 32 all-time completed, 6 awaiting review, 11 active projects, 4 active workflows). Console clean. Saved `output/2026-05-04-smoke-01-home.png`.
- `/apps` renders the 5-app card grid + 4-template starter row. Console clean. Saved `output/2026-05-04-smoke-02-apps-index.png`.
- **Finding (low-priority):** Habit Tracker is in the apps list but missing from the "Start from a template" row. Investigate `src/app/apps/page.tsx` template definitions.

### Phase 2 — Compose new app via NL chat ⚠️ (PAUSED)
- New conversation created at `/chat?c=5d839204-0ade-420b-9072-a6c3e2492fd5`.
- Saved `output/2026-05-04-smoke-03a-chat-empty.png` (empty welcome card) and `output/2026-05-04-smoke-03b-chat-progress.png` (mid-stall).
- Initial Enter-key press through `mcp__chrome-devtools__press_key { key: "Enter" }` did NOT submit. Subsequent Cmd+Enter also did not submit. Clicking "Create" opened a sub-menu of starter prompts (not a send action) and cleared the textbox.
- A subsequent JS-dispatched keyboard event from `evaluate_script` (using `Object.getOwnPropertyDescriptor(...).set` to update value React-aware-ly, then dispatching a real `KeyboardEvent` for Enter) DID successfully submit — confirms the React handler chain *can* fire when given a properly-timed event sequence.
- That successful submission produced an in-flight composition. By the time the session paused, the on-disk manifest at `~/.ainative/apps/reading-log/manifest.yaml` was assembled (profile + blueprint + 1 table + Friday-5pm schedule, no `view:` field).
- **The Enter regression has TWO possible causes** that next session must distinguish:
  - **(A)** A real React-state-staleness bug in chat-input.tsx where `handleSend` reads stale `value` state (i.e., the textarea has text but React state is "" because onChange hasn't flushed). Fix: switch to a ref-based read inside `handleSend`, or add a guard that re-reads `textareaRef.current.value` if `value.trim()` is empty but the DOM has content.
  - **(B)** A tooling artifact unique to chrome-devtools-mcp's `fill` + `press_key` sequence — fill sets the value via native setter and dispatches an input event, but the press_key keyboard event may fire before React's onChange has updated state. If so, real human typing would be unaffected and the regression is a smoke-tooling false positive.
  - **The user's words ("was working just fine until prior releases") strongly suggest (A) is real**, but next session must verify with a real keyboard before assuming.

### Phase 3, 4, 5, 6 — Not started ❌
- App view-shell + 5-app regression (kit dispatch verification): not started.
- Row-trigger blueprint execution (`row-trigger-blueprint-execution` 2026-05-02 surface): not started.
- View-editing chat tools (`set_app_view_kit`, `set_app_view_kpis` from 2026-05-03 `composed-app-manifest-authoring-tools`): not started.
- Findings capture: this document.

---

## Resume-from-clean-state instructions

The next session can pick up from any of three starting positions. Read this whole section before deciding.

### Option A — Investigate the Enter regression first (RECOMMENDED)

This is the right move because (1) it's the user-reported P0, (2) all of Phase 2/5 of the smoke depend on chat working, and (3) it's bounded — a single component file plus its hook.

**Setup:**
```bash
# 0. Ensure all dev servers are dead (Phase 6 of this session was supposed to verify this).
pkill -f "next dev --turbopack" 2>/dev/null; pkill -f "next-server" 2>/dev/null
lsof -i :3000 || echo "3000 free"
lsof -i :3010 || echo "3010 free"   # sibling clone(s); only kill if user confirms

# 1. Optional: clear the experimental conversation + reading-log app from this session.
#    The conversation will appear in the chat sidebar with the title "Build me a daily
#    reading log app...". Decide whether to keep (for diff) or delete (for clean slate).
#    Delete via UI in the chat sidebar's row menu, OR:
sqlite3 ~/.ainative/ainative.db \
  "DELETE FROM conversations WHERE id = '5d839204-0ade-420b-9072-a6c3e2492fd5';"
rm -rf ~/.ainative/apps/reading-log/
rm -rf ~/.ainative/profiles/reading-log--digest/
rm -f ~/.ainative/blueprints/reading-log--weekly-digest.yaml

# 2. Start dev server and wait for Ready.
npm run dev > /tmp/ainative-dev.log 2>&1 &
until grep -q "Ready in" /tmp/ainative-dev.log; do sleep 1; done

# 3. Open http://localhost:3000/chat in a real browser tab (Claude in Chrome or
#    plain Chrome — Chrome DevTools MCP is fine for screenshots but Enter
#    behavior MUST be tested with the user's actual keyboard for the diagnosis
#    to be valid).
```

**Repro:**
1. Click "New Chat" in the right sidebar.
2. Type a few characters into the prompt box (real keyboard).
3. Press Enter.
4. Observe: does the message submit (assistant starts streaming) or does Enter create a newline / do nothing?

**If the bug reproduces** (no submit on Enter):
- First check React DevTools or `console.log` the `value` state and the keydown event in `handleKeyDown`. Quickest non-invasive instrumentation is to add a `console.log("[chat-input] keydown:", e.key, "value:", value, "isStreaming:", isStreaming)` at the very top of `handleKeyDown` (line 152) and a `console.log("[chat-input] handleSend trim:", trimmed.length, "isStreaming:", isStreaming)` at the top of `handleSend` (line 105). Restart, type, press Enter, read console. This tells you *which* of the four bail-out points is killing the send.
- Likely diagnosis (in priority order):
  1. **`isStreaming` stuck on true** — would cause `handleSend` to silently return at line 106. The Phase 2 branches commit added `useChatSession()` access; check whether `isStreaming` (which comes via props from the chat-shell) is being driven from session state that's stuck.
  2. **`value` is stale `""`** — see (A) above. The `value.trim()` check would silently return.
  3. **`autocomplete.handleKeyDown(e)` returning true unexpectedly** — would short-circuit at chat-input.tsx:154 before the Enter branch is reached. Would happen if `state.open` is true even without a `/` or `@` trigger. Unlikely but cheap to verify with a `console.log` before line 154.
  4. **Stale event listener due to deps churn** — the `handleKeyDown` useCallback at line 207-219 lists `branchingEnabled`, `rewindLastTurn`, `restoreLastRewoundPair`, `handleInput`. If `useChatSession()` returns a fresh object identity every render, those values change and the callback rebinds — but onKeyDown is bound to the textarea element directly via JSX prop, so React's reconciler should swap it cleanly. Verify by adding the console.log above and confirming it fires every keystroke.
- **The fix, once root-caused, is almost certainly a one-line change.** Stay disciplined — do not refactor the input component while triaging this.

**If the bug does NOT reproduce with real keyboard typing** (just the chrome-devtools tooling): catalog as a smoke-tooling caveat in the relevant feature spec and proceed to Phase 2 below.

### Option B — Resume the smoke from where it paused

If the Enter regression is confirmed minor or fixed, continue with the original plan from `/Users/manavsehgal/.claude/plans/review-the-build-me-humming-perlis.md`:

- **Phase 2 (cleanup):** delete the partial `reading-log` app (`rm -rf ~/.ainative/apps/reading-log/ ~/.ainative/profiles/reading-log--digest/ ~/.ainative/blueprints/reading-log--weekly-digest.yaml` plus the conversation row above), then re-prompt fresh. Pick a different prompt phrasing to avoid disambiguating "did the prior partial composition finish or did this kick off a new one."
- **Phase 3:** visit `/apps/<id>` for the new app and each of the 5 seeded apps, verify kit dispatch, save 6 screenshots.
- **Phase 4:** add a row to a triggered table (Customer follow-up drafter has a row-insert trigger per the Phase 5 handoff), verify task creation with non-null `context_row_id`.
- **Phase 5:** test the 2026-05-03 view-editing tools — *"For my reading log app, switch to the workflow hub layout"* and *"Add a KPI tile showing total books read"* — verify the manifest's `view:` field updates.
- **Phase 6:** capture findings in HANDOFF.md per the original plan's verification matrix (✅/⚠️/❌/💡 per phase).

### Option C — Triage the secondary findings without resuming the smoke

If the Enter regression is going to take more than a session to fix and the user wants smaller wins shipped first, the two secondary findings can be cleaned up in one short session each:

- **Apps-disk vs. projects-table drift** — investigate whether `finance-pack` and `weekly-portfolio-check-in` (manifest on disk, no `projects` row) are intentional Phase 3 fixtures or a seed-data bug. Fix: either backfill the rows or document the pattern.
- **Habit Tracker missing from starter templates** — check `src/app/apps/page.tsx` template definitions. Likely a one-line addition to the template list.

---

## Critical files referenced this session (read-only inspection)

- `src/components/chat/chat-input.tsx:104-112` — `handleSend` bail-out points
- `src/components/chat/chat-input.tsx:151-219` — `handleKeyDown` (Enter handler at line 200-203)
- `src/components/chat/chat-input.tsx:54-57` — `useChatSession()` integration added in commit `17a6fc5b` (Phase 2 conversation branches)
- `src/hooks/use-chat-autocomplete.ts:276-327` — autocomplete keydown interceptor (only fires when `state.open === true`)
- `src/components/chat/chat-session-provider.tsx:105,950` — provider + `useChatSession` hook (provider is mounted in `src/app/layout.tsx:102-116`, so context is always available)
- `src/lib/apps/registry.ts:25-175` — `AppManifestSchema`
- `src/lib/apps/view-kits/inference.ts:14-29` — kit auto-inference rules
- `~/.ainative/apps/reading-log/manifest.yaml` — partial composition from this session (4 cols, no `view:` field)

---

## Browser-smoke instructions (canonical, drop-in for next session)

These are the same instructions used for this session, refined with what was learned. They should be followed as a checklist by the next agent.

### 0. Decide tooling

- **Primary:** Chrome DevTools MCP — supports `filePath` on `take_screenshot` (saves to `output/`), supports `evaluate_script` for state probes, supports `list_console_messages` for assertion. **Caveat learned this session:** the `fill` + `press_key Enter` combo can have timing issues against React-controlled inputs. If verifying Enter-key behavior specifically, use a real human keystroke or dispatch a properly-React-aware event from `evaluate_script`.
- **Fallback:** Playwright MCP — same capability, save snapshots to `/tmp/`, never project root.
- **Last resort:** Claude in Chrome — only if MCP variants both fail. Save screenshots to `output/` via your own copy step.
- For the Enter-key regression specifically, the user's keyboard is the only authoritative test surface — neither MCP can substitute.

### 1. Pre-flight

```bash
# Kill any existing :3000 dev server (and turbopack child)
pkill -f "next dev --turbopack" 2>/dev/null
pkill -f "next-server" 2>/dev/null
sleep 1
lsof -i :3000 && echo "WARNING: port 3000 still occupied" || echo "port 3000 free"

# Confirm dev-mode gates (one of these must be true; both is fine)
grep '^AINATIVE_DEV_MODE' .env.local || echo "no env gate"
ls -la .git/ainative-dev-mode || echo "no sentinel — run: touch .git/ainative-dev-mode"

# Snapshot pre-state for diff at end of smoke
ls ~/.ainative/apps/ | tee /tmp/smoke-pre-apps.txt
sqlite3 ~/.ainative/ainative.db "SELECT id,name FROM projects" | tee /tmp/smoke-pre-projects.txt
```

### 2. Start dev server

```bash
npm run dev > /tmp/ainative-dev.log 2>&1 &
until grep -q "Ready in" /tmp/ainative-dev.log; do sleep 1; done
head -25 /tmp/ainative-dev.log   # confirm sentinel + scheduler boot lines
```

### 3. Smoke phases (per the plan file)

For each phase, capture:
- A screenshot in `output/` named `2026-MM-DD-smoke-NN-<slug>.png`
- Console errors/warnings via `list_console_messages { types: ["error", "warn"] }`
- Disk-state assertions where relevant (`ls ~/.ainative/apps/`, `sqlite3 ... SELECT ...`)

Phase 1 — Homepage + apps index: `/`, `/apps`. (Verified clean this session.)

Phase 2 — Compose new app via chat:
1. Navigate `/chat`. Click "New Chat".
2. **Verify the prompt box: Enter key submits a typed message.** This is the gating behavior for the rest of the smoke.
3. Type a composition prompt that exercises a specific kit. Pick a kit that has not been smoked recently from `output/` to broaden coverage. Suggested prompts (these target each kit via auto-inference rules):
   - **research kit:** *"Build me a weekly news digest app that summarizes my saved articles every Friday at 5pm."*
   - **inbox kit:** *"Build me a customer message triage app — a table for incoming messages and a blueprint that drafts a reply when a row is added."*
   - **tracker kit:** *"Build me a daily exercise log — table with date, exercise, completed-yes-no, with a daily 8pm reminder schedule."*
   - **ledger kit:** *"Build me a monthly subscription tracker — table with service, monthly cost, and a blueprint that totals my spend."*
   - **coach kit:** *"Build me a morning coaching app — every weekday at 7am, a coach profile reviews yesterday's tasks."*
   - **workflow-hub:** *"Build me a CI failure response app — three blueprints (root-cause, hotfix, postmortem) with no central table."*
4. Wait for the AppMaterializedCard ("[name] is live"). If it stalls > 3 minutes, capture the dev log and abort.
5. Verify on disk: `cat ~/.ainative/apps/<id>/manifest.yaml` has profiles/blueprints/tables/schedules.

Phase 3 — Kit dispatch + regression:
1. Click into the new app from the materialized card → `/apps/<id>`.
2. Verify the rendered kit matches the inference-rule expectation. Screenshot.
3. Visit each of `/apps/habit-tracker`, `/apps/finance-pack`, `/apps/customer-follow-up-drafter`, `/apps/research-digest`, `/apps/weekly-portfolio-check-in`. Screenshot each. Console-clean check on each.

Phase 4 — Row-trigger blueprint:
1. Navigate to a table that has a row-insert trigger blueprint. `customer-follow-up-drafter` is the canonical example.
2. Add a row through the UI.
3. Verify a task is created via `manifest-trigger-dispatch.ts:27-102` — appears in tasks list / app's inbox view, has non-null `context_row_id`.
4. `sqlite3 ~/.ainative/ainative.db "SELECT id, status, context_row_id FROM tasks WHERE context_row_id IS NOT NULL ORDER BY created_at DESC LIMIT 5"` to confirm.

Phase 5 — View-editing chat tools:
1. Back to `/chat`. New conversation. Reference the app by name.
2. Prompt: *"For my <app-name>, switch to the <other-kit> layout."*
3. Verify the LLM emits `set_app_view_kit({ appId, kit: "<other-kit>" })`. Manifest should now have `view: { kit: "<other-kit>" }`.
4. Reload `/apps/<id>` — kit changed.
5. Prompt: *"Add a KPI tile showing <metric>."*
6. Verify `set_app_view_kpis(...)` and the kpi tile renders.

Phase 6 — Capture findings:
1. Open this HANDOFF.md. Add a "Verification run — YYYY-MM-DD" block per feature spec where the smoke surfaced new evidence (`features/nl-to-composition-v1.md`, `features/composed-app-view-shell.md`, `features/composed-app-kit-*.md`, `features/composed-app-manifest-authoring-tools.md`, `features/row-trigger-blueprint-execution.md`).
2. Decide HANDOFF disposition: smoke clean (archive this, write next-priority pointer) or smoke surfaces blockers (HANDOFF becomes the fix-list).

### 4. Teardown

```bash
pkill -f "next dev --turbopack" 2>/dev/null
pkill -f "next-server" 2>/dev/null
sleep 1
lsof -i :3000 && echo "still occupied" || echo "port 3000 free — clean shutdown"
```

---

## Patterns reinforced this session

- **Browser-smoke is the only test that catches event-handler bugs in controlled React inputs.** Unit tests on `chat-input.tsx` would mock `useChatSession` and the `onSend` prop, and would validate the `handleKeyDown → handleSend → onSend` call chain. They would NOT catch a regression where the React state synchronization between keystroke and Enter timing is broken — because vitest's `userEvent.type` + `userEvent.keyboard("{Enter}")` simulates the events in a way that never produces the timing race that real Chrome/React might exhibit. Smoke is irreplaceable for input-handler verification.
- **The `fill + press_key` MCP idiom is not a perfect substitute for keyboard typing.** This session encountered what looks like a timing race where the MCP's `press_key Enter` fires before React has flushed its `onChange` from the prior `fill`. Workaround: dispatch a properly-timed React-aware event from `evaluate_script` (using `Object.getOwnPropertyDescriptor(...).set` then a real `KeyboardEvent`). For the next session, when verifying Enter-key behavior specifically, prefer real keyboard input (i.e., the user types) over MCP-driven input.
- **The "no Send button" design choice is fragile when the Enter handler is the only submit path.** A regression in Enter takes the entire chat surface offline. Worth considering a fallback Send button — even if styled minimally — as a safety net.
- **Hand-crafted manifest fixtures (`finance-pack`, `weekly-portfolio-check-in`) live alongside chat-composed apps.** They share the same disk schema but skip the `projects` table. This works for view-only smoke but won't match production user behavior — keep an eye on whether features that depend on `projects` rows (e.g., row-trigger dispatch, app-level analytics) silently skip these apps.

---

*End of handoff. Three reasonable next moves, in priority order:*

1. ***Investigate the Enter regression with a real keyboard.*** This is the user's stated P0 and gates the rest of the smoke. Most likely a one-line fix once root-caused.
2. ***Resume the smoke from Phase 2*** if the regression turns out to be MCP tooling rather than real code. Plan file at `/Users/manavsehgal/.claude/plans/review-the-build-me-humming-perlis.md`.
3. ***Triage the two secondary findings*** (`finance-pack`/`weekly-portfolio-check-in` projects-table drift; Habit Tracker missing from starter templates) — independently fixable without unblocking the smoke.
