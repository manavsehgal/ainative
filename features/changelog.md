# Feature Changelog

## 2026-03-17

### Groomed & Implemented (E2E Test Report Recommendations)
- Assessed 5 recommendations from `output/done-agent-e2e-test-report.md` (2026-03-15, 10/10 pass)
- `e2e-test-automation` (P2, completed) — API-level E2E test suite
  - Created `vitest.config.e2e.ts` with 120s timeouts, sequential execution, node environment
  - Created `src/__tests__/e2e/helpers.ts` — HTTP client utilities, polling helpers, runtime detection
  - Created `src/__tests__/e2e/setup.ts` — test project + sandbox creation/teardown with deliberate-bug TypeScript files
  - 5 test files: `single-task`, `sequence-workflow`, `parallel-workflow`, `blueprint`, `cross-runtime`
  - ~15 test cases covering both runtimes, 4 profiles, 4 workflow patterns
  - Tests skip gracefully when runtimes aren't configured (no CI failures)
  - Added `npm run test:e2e` script to package.json
  - Rec #4 (Codex workflow testing) folded in as Codex-specific describe blocks
- `tool-permission-presets` (P2, completed) — Preset permission bundles
  - Created `src/lib/settings/permission-presets.ts` — 3 presets (read-only, git-safe, full-auto) with apply/remove logic
  - Presets are layered (git-safe includes read-only), removal only strips unique patterns
  - Created `POST/GET/DELETE /api/permissions/presets` route
  - Created `PresetsSection` component with risk badges and enable/disable toggles
  - Created `PermissionsSections` wrapper coordinating presets + individual permissions via forwardRef
  - Integrated into Settings page above existing Tool Permissions section
- `workflow-context-batching` (P2, completed) — Workflow-scoped proposal buffering
  - Created `src/lib/agents/learning-session.ts` — session lifecycle (open/buffer/close), batch approve/reject
  - Modified `engine.ts` — wraps all workflow patterns in learning session open/close (including loop + try/finally)
  - Modified `pattern-extractor.ts` — detects workflow session, calls `proposeContextAddition({ silent: true })` to skip notification
  - Modified `learned-context.ts` — `proposeContextAddition` accepts `{ silent }` option to create row without notification
  - Created `POST /api/context/batch` — batch approve/reject endpoint
  - Created `BatchProposalReview` component with Approve All / Reject All actions
  - Integrated into `PendingApprovalHost` for both compact toast and full detail views
  - Added `context_proposal_batch` to notification type enum in DB schema
- Rec #2 (Codex output artifacts) closed — documented output contract in `provider-runtime-abstraction.md`

### Catalog Sync
- Renamed `output/agent-e2e-test-report.md` → `output/done-agent-e2e-test-report.md` (all 5 recommendations addressed)
- Updated references in 5 feature files + changelog

### Completed
- `sdk-runtime-hardening` (P2, post-MVP) — Systematic SDK audit fixes for cost tracking, execution safety, and prompt quality
  - F1: Refactored to use `systemPrompt: { type: 'preset', preset: 'claude_code', append }` instead of prompt stuffing
  - F2: Removed decorative `temperature` from all profile YAMLs and `AgentProfile` type
  - F4: Added per-execution `maxBudgetUsd` via `DEFAULT_MAX_BUDGET_USD` to both execute and resume paths
  - F5: Expanded pricing registry from 2 to 6 model families (3 Anthropic + 3 OpenAI) with fallback estimates
  - F6: Added `getProviderModelBreakdown()` for per-model usage extraction from SDK `modelUsage` field
  - F9: Added default `maxTurns` on task execution with per-profile override via `DEFAULT_MAX_TURNS`
  - F10: Codex `item/tool/call` handler returns structured graceful response instead of bare string stub
  - F12: Extracted shared `buildTaskQueryContext()` helper eliminating duplicate execute/resume prompt construction

### Catalog Sync
- Feature catalog updated retroactively to reflect SDK audit-driven code changes (commit `e5680ff`)
- Added implementation notes to `usage-metering-ledger` (F5, F6), `spend-budget-guardrails` (F4, F9), `provider-runtime-abstraction` (F1, F12), `cross-provider-profile-compatibility` (F2)
- Renamed `output/sdk-usage-audit.md` → `output/done-sdk-usage-audit.md`

### Deferred
- F3 (`outputFormat`) — Profile field exists but not wired to `query()` options; needs per-profile JSON Schema definitions
- F7 (`fallbackModel`) — No multi-model failover needed currently
- F8 (`includePartialMessages`) — Only optimized for connection test; remaining call sites deferred
- F11 (Codex MCP passthrough) — Catalog already lists `mcpServers: false`
- F13 (Usage dedup by message ID) — Current merge strategy sufficient without multi-model sessions

## 2026-03-15

### Completed
- `ai-assist-workflow-creation` (P1, post-MVP) — Bridge AI Assist recommendations into workflow engine
  - Expanded `TaskAssistResponse` with per-step profiles, dependencies, and all 6 workflow patterns
  - Updated AI system prompt with dynamic profile catalog injection and pattern selection guide
  - Created `assist-builder.ts` — pure function converting assist response → validated `WorkflowDefinition`
  - Created `POST /api/workflows/from-assist` — atomic workflow + tasks creation with optional immediate execution
  - Created `WorkflowConfirmationSheet` — editable workflow review UI (pattern, steps, profiles, config)
  - Added "Create as Workflow" button in AI Assist panel (shown for 2+ steps, non-single patterns)
  - Created keyword-based profile suggestion fallback (`suggest.ts`)
  - Updated workflow engine to resolve "auto" profiles via multi-agent router at execution time

### Fixed
- `syncSourceTaskStatus` bug in workflow engine — defensive array check prevents "not iterable" TypeError when syncing parent task status after workflow completion
- `npm-publish-readiness` roadmap status corrected from `completed` → `deferred` to match feature file frontmatter

### Shipped
- `agent-self-improvement` (P3, post-MVP) — Agents learn from execution history with human-approved instruction evolution
  - `learned-context.ts`: Full CRUD — propose, approve, reject, rollback, summarization with size limits
  - `pattern-extractor.ts`: LLM-powered pattern extraction from task logs (Claude tool_choice for structured output)
  - `sweep.ts`: Sweep result processor creates prioritized improvement tasks from audit results
  - Sweep agent profile (`builtins/sweep/`) with structured JSON output format
  - API routes: `GET/POST/PATCH /api/profiles/[id]/context` for version history, manual add, approve/reject/rollback
  - UI: `LearnedContextPanel` (version timeline, size bar, manual add, rollback), `ContextProposalReview` (approve/edit/reject)
  - Integrated into `claude-agent.ts` — learned context injected into prompts, pattern extraction fire-and-forget after completion
  - Notification system handles `context_proposal` type in `PendingApprovalHost` with inline approve/reject
  - Tests: 35 tests across `learned-context.test.ts` (20), `sweep.test.ts` (9), `pattern-extractor.test.ts` (6)

### Previously Completed
- `board-context-persistence` (P2, post-MVP) — Persist board state across sessions and navigation
  - Created generic `usePersistedState` hook for localStorage-backed state with SSR-safe hydration
  - Project filter persists across page refreshes via `stagent-project-filter` localStorage key
  - New Task link passes selected project as `?project=` search param, pre-filling the create form
  - Added sort order dropdown (Priority, Newest first, Oldest first, Title A-Z) persisted to localStorage
- `kanban-board-operations` (P2, post-MVP) — Shipped inline task editing, bulk operations, and card animations
  - Added inline delete confirmation on task cards with 2-step UX (trash icon → confirm/cancel) and 3-second auto-revert
  - Added task edit dialog for planned/queued tasks with profile-runtime compatibility validation
  - Added column-level selection mode with bulk delete (confirmation modal) and bulk status transitions (planned→queued, queued→running)
  - Added ghost card exit animation using sessionStorage for cross-navigation state persistence
  - Added priority-colored strip toolbar on card footer with contextual action buttons

### Enhancement
- `task-definition-ai` (P2, MVP) — AI Assist panel now shows animated progress bar with rotating activity messages instead of spinner
- `provider-runtime-abstraction` (P1, post-MVP) — Added timeout guards: 30s abort on Claude task assist, 60s timeout on Codex with subprocess error handling
- Engineering principles codified in AGENTS.md (7 directives: zero silent failures, named errors, shadow paths, edge cases, explicit>clever, DRY with judgment, permission to scrap)
- Version bump to 0.1.7

## 2026-03-14

### Removed
- `tauri-desktop` — Distribution simplified to `npx stagent` (npm) and web app only. All Tauri desktop shell, macOS DMG generation, Apple signing scripts, desktop smoke tests, and related feature specs removed. CLI entry point (`bin/cli.ts`) and sidecar launch helpers retained for the npx path.

## 2026-03-13

### Ship Verification
- `desktop-sidecar-boot-fix` (P0, MVP) — The bundle boot blocker is no longer the broken `next` shim
  - Replaced the sidecar's `node_modules/.bin/next` launch path with a direct `node_modules/next/dist/bin/next` invocation via the active Node binary, which avoids Tauri's symlink-flattened `.bin/` copies
  - Added a post-bundle sync of `.next/node_modules` into `Stagent.app` so Next's generated hashed externals such as `better-sqlite3-*` remain resolvable inside the packaged app
  - Verified the actual release bundle sidecar starts in production mode and returns HTTP `200` on localhost under a Finder-style minimal `PATH`

### Enhancement
- `desktop-sidecar-boot-fix` (P0, MVP) — Hardened the desktop handoff and trimmed accidental bundle bloat
  - Stopped the internal CLI from re-running port discovery when the Tauri wrapper already passed an explicit localhost port, preventing the boot screen from polling a stale port while the sidecar listens on a different one
  - Pruned non-runtime Next artifacts such as `.next/dev`, trace files, diagnostics, and caches from the finished `Stagent.app` bundle so desktop release size no longer inherits stale local dev output
  - Rebuilt the local desktop artifacts to verify the size drop: the bundled `.next/` payload fell to roughly `51MB`, and the smoke DMG compressed to roughly `260MB`

### Started
- `desktop-sidecar-boot-fix` (P0, MVP) — Desktop app launches but hangs at boot screen. Five issues identified and four solved (DMG signing, node PATH, `_up_/` path mapping, shim PATH). Initial blocker for this slice: Tauri's resource bundling destroys `node_modules/.bin/` symlinks, breaking the `next` CLI shim's relative requires. Feature spec documents the full diagnosis log.

### Re-prioritized
- **Distribution direction**: Stagent is now desktop-only in user-facing product positioning
  - Removed npm / `npx` onboarding and publish wiring from the repo surface, while keeping the CLI build only as an internal sidecar dependency of the desktop app
  - Deferred `npm-publish-readiness` as an active product feature and updated the bootstrap spec so it describes the internal desktop sidecar rather than a public install command
  - Promoted GitHub-hosted desktop artifacts as the only documented end-user install channel

### Enhancement
- **tauri-desktop** (P3, post-MVP): Added repo-distributed macOS desktop packaging on top of the local Tauri foundation
  - Enabled `.dmg` output for the Tauri bundle so the desktop build produces an installable macOS artifact instead of only a local `.app`
  - Added a GitHub Actions workflow that builds unsigned macOS desktop assets on tag push or manual dispatch, uploads them as workflow artifacts, and attaches them to GitHub releases for repo-based download
  - Updated the README to point desktop users at GitHub Releases and to document the current limitations: macOS-only, unsigned build, and local `node` dependency

### Started
- **tauri-desktop** (P3, post-MVP): Activated the first desktop-foundation slice instead of treating the full native distribution plan as one implementation
  - Starts with a Tauri wrapper that boots a local loading shell, spawns the existing `dist/cli.js` sidecar, and hands the window over to the same localhost-hosted Next.js app used by the desktop shell
  - Limits the first bridge surface to native notifications and file dialogs so browser-safe shared code can grow into desktop capabilities without forcing a second UI stack
  - Defers bundled Node runtime, system tray, updater, and signed distribution until the sidecar wrapper is stable enough to justify deeper packaging work
- Updated roadmap: marked `tauri-desktop` as started and added it as the current post-MVP platform sprint

## 2026-03-12

### Ship Verification
- **npm-publish-readiness** (P1, post-MVP): Acceptance criteria verified against the packaged CLI, published tarball shape, npm-facing README, and live registry publication
  - Confirmed package metadata now covers npm discovery and links, while the published tarball keeps runtime-required source/assets and excludes repo-only test files
  - Confirmed the CLI help path now documents `STAGENT_DATA_DIR`, startup flags, and runtime credential expectations for first-time npm users
  - Verified with `npm run build:cli`, `npm pack --dry-run`, a passing `npm run smoke:npm` tarball launch, and successful publication of `stagent@0.1.1`
- **multi-agent-swarm** (P3, post-MVP): Acceptance criteria verified against the new swarm workflow pattern, retry flow, targeted tests, and a successful production build
  - Confirmed workflow authoring now supports a bounded `swarm` pattern with one mayor step, 2-5 worker steps, a refinery step, and configurable worker concurrency
  - Confirmed execution runs the mayor first, fans worker child tasks out through the existing workflow task path, blocks the refinery on failed workers, and persists grouped swarm progress in workflow state
  - Confirmed failed mayor, worker, and refinery stages can be retried from workflow detail through a new step-retry endpoint without re-running successful sibling workers
  - Verified with targeted Vitest coverage (`16` passing tests across workflow validation/helpers/engine) and a successful production build
- **ambient-approval-toast** (P1, post-MVP): Acceptance criteria verified against the shipped shell presenter, shared permission controls, targeted tests, and a successful production build
  - Confirmed unresolved `permission_required` notifications now surface through a shell-level presenter on any route, using a primary approval card plus an explicit overflow indicator instead of overlapping surfaces
  - Confirmed the toast and Inbox now share the same permission-response control path, so `Allow Once`, `Always Allow`, and `Deny` still write the canonical notification response through the existing task response endpoint
  - Confirmed new requests are announced through a polite live region, expanded detail restores focus on close, and mobile uses the bottom-anchored sheet-style variant instead of a desktop corner-only presentation
  - Verified with targeted Vitest coverage (`3` passing tests across the new notification host and shared permission controls) plus a successful production build
- **cross-provider-profile-compatibility** (P2, post-MVP): Acceptance criteria re-verified against code, targeted tests, production build, and a live browser pass
  - Confirmed profile metadata supports runtime declarations and runtime-specific overrides, built-in profile sidecars advertise Claude/Codex coverage, and execution resolves provider-specific payloads instead of assuming universal Claude `SKILL.md`
  - Confirmed task, schedule, and workflow validation reject incompatible runtime/profile assignments before execution, and profile smoke tests now target a selected runtime with explicit `unsupported` reporting
  - Re-verified the profile browser and detail surfaces expose runtime coverage, and retained the regression fix that refreshes profile discovery when on-disk skill directories change so new custom profiles no longer 404 after creation
  - Verified with targeted Vitest coverage (`26` passing tests), a successful production build, and a browser check covering both unsupported and dual-runtime profile states

### Completed
- **npm-publish-readiness** (P1, post-MVP): Shipped npm distribution hardening for `npx stagent`
  - Added publish-ready npm metadata, tarball trimming, and a packaged smoke-test workflow that validates the CLI from the actual npm tarball instead of the repo checkout
  - Updated CLI help and runtime path handling so packaged runs can document and honor `STAGENT_DATA_DIR`, `--port`, `--reset`, and `--no-open`
  - Refreshed the npm-facing README with current feature coverage, a release checklist, and packaged screenshots that render from the published tarball
- **multi-agent-swarm** (P3, post-MVP): Shipped bounded swarm orchestration on top of the existing workflow system
  - Added a `swarm` workflow pattern with a fixed mayor → worker pool → refinery structure instead of introducing a new graph runtime
  - Workers now execute in parallel with a configurable concurrency cap while the refinery step receives the mayor plan plus labeled worker outputs as merge context
  - Workflow detail now groups swarm runs into mayor, worker, and refinery panels, and failed swarm stages can be retried independently through a dedicated step-retry route
- **ambient-approval-toast** (P1, post-MVP): Shipped in-context approval toasts for human-in-the-loop task supervision
  - Added a shell-mounted pending approval host that watches unresolved permission notifications via a dedicated pending-approval payload and SSE snapshot stream with polling fallback
  - Introduced a shared permission-response action component so the ambient presenter and Inbox use the same approval semantics, including persisted `Always Allow` patterns
  - Added a queue-aware compact approval surface, expanded detail dialog, and mobile bottom-sheet variant with focus return, live-region announcement, and overflow handling for multiple pending approvals
  - Introduced a reusable actionable-notification payload and adapter interface so browser and future Tauri/macOS delivery can reuse the same IDs, summaries, deep links, and action set
- **parallel-research-fork-join** (P2, post-MVP): Shipped bounded fork/join workflow execution
  - Added a `parallel` workflow pattern with a bounded authoring flow: 2-5 research branches plus one required synthesis step instead of a free-form graph editor
  - Workflow execution now launches branch child tasks concurrently with a small concurrency cap, holds the synthesis step in an explicit waiting state until every branch succeeds, and builds the final prompt from labeled branch outputs
  - Workflow detail now renders branch-level progress cards and a distinct synthesis panel, while API and form validation reject malformed parallel definitions before execution
  - Fixed workflow failure persistence so failed workflow runs now store a top-level `failed` status instead of remaining `active` after a branch or synthesis error
  - Verified with targeted Vitest coverage (`31` passing tests across workflow and agent suites), a successful production build, and a live browser pass that created and executed a parallel workflow
- **document-output-generation** (P3, post-MVP): Shipped managed capture for agent-generated files
  - Fresh task runs now prepare `~/.stagent/outputs/{taskId}/`, inject that path into Claude and Codex prompts, and scan supported generated files after successful completion
  - Generated `.md`, `.json`, `.csv`, `.txt`, and `.html` files are archived as immutable output documents with `direction="output"` plus version numbers so reruns preserve prior outputs instead of overwriting document history
  - Task detail now separates input attachments from generated outputs, while the Document Manager exposes output files through the normal browser with direction and version visibility
  - Document preview/download flows now use a document-backed file route, and agent document context is restricted to input documents so generated outputs do not feed back into future prompt context
  - Verified with targeted Vitest coverage (`50` passing tests across runtime/document suites) and a successful production build
- **cross-provider-profile-compatibility** (P2, post-MVP): Shipped provider-aware profile coverage across authoring, execution, and testing
  - Added runtime compatibility metadata to profile sidecars plus runtime-specific instruction override support so profiles can declare Claude-only, Codex-only, or dual-runtime coverage explicitly
  - Runtime resolution now loads provider-specific profile payloads for Claude and Codex task execution instead of assuming every profile is a universal Claude `SKILL.md`
  - Task creation, task updates, schedules, workflow draft editing, and queued task execution now reject incompatible runtime/profile combinations before they silently fail
  - Profile browser cards and detail views now surface runtime coverage, while the profile editor can opt profiles into Codex support and add Codex-specific instructions
  - Profile smoke tests now target a selected runtime and return an explicit `unsupported` report when the runtime or profile payload cannot run tests
  - Verified with targeted Vitest coverage for profile compatibility helpers and a successful production build

### Groomed
- **npm-publish-readiness** (P1, post-MVP): Added a bounded npm distribution hardening spec for the existing CLI bootstrap
  - Separates publish-readiness from the already-completed local CLI bootstrap so release work is scoped to tarball shape, package metadata, smoke testing, and onboarding docs
  - Targets the OpenVolo-style thin CLI plus source-shipped Next.js pattern already captured in `ideas/npx-web-app.md`
  - Calls for `npm pack`-based validation so `npx stagent` is proven from the shipped tarball rather than assumed from repo-local execution
- Updated roadmap: added `npm-publish-readiness` as a planned Platform feature
- **ambient-approval-toast** (P1, post-MVP): Added an in-context approval surface spec for active supervision
  - Defines a shell-level permission toast that appears on any route, keeps Inbox as the durable record, and lets users approve or deny without switching context
  - Uses a compact toast plus expanded modal-like detail state so approval requests are noticeable without becoming a blocking full-screen interruption
  - Introduces a channel abstraction now so the same approval payload can later drive browser notifications and Tauri/macOS native notifications without changing the core permission model
- **parallel-research-fork-join** (P2, post-MVP): Split the broad advanced-workflows placeholder into the next bounded workflow-engine slice
  - Narrows the next workflow expansion to one control-flow primitive: parallel branch execution followed by a synthesis join step
  - Reuses existing workflow steps, runtime assignments, and profile compatibility instead of introducing a new orchestration model
  - Keeps critic/verifier, evaluator-optimizer, and broader swarm behavior out of scope until fork/join execution and visibility are proven in the product
- **usage-metering-ledger** (P1, post-MVP): Added a normalized cost-and-token accounting foundation for Claude- and Codex-backed activity
  - Introduces a dedicated usage ledger instead of relying on provider-shaped `agent_logs` payloads as the reporting source of truth
  - Covers task runs, resumes, workflow child tasks, scheduled firings, task assist, and profile tests
  - Preserves raw token counts plus derived cost so later dashboards and budgets can rely on durable accounting data
- **spend-budget-guardrails** (P1, post-MVP): Added governed spend controls for autonomous provider activity
  - Settings-driven daily/monthly overall spend caps plus provider-scoped spend and token caps
  - Warn at 80% of budget, then hard-stop new Claude/Codex calls after a limit is exceeded
  - Allows in-flight runs to finish while making blocked follow-on work explicit in Inbox and audit history
- **cost-and-usage-dashboard** (P2, post-MVP): Added a first-class operational surface for spend visibility
  - Promotes `Cost & Usage` into the sidebar as a dedicated route rather than burying spend in Settings or Monitor
  - Combines summary cards, spend/token trend charts, provider/model breakdowns, and a filterable audit log
  - Reuses the existing micro-visualization pattern instead of adding a heavier analytics stack

### Completed
- **accessibility** (P2, post-MVP): Closed the remaining WCAG-focused interaction gaps across live updates and dialog close paths
  - Added polite live-region coverage to the monitor overview metrics, homepage priority queue, homepage activity feed, and the kanban board via an announcement region for filter and drag/drop updates
  - Hardened programmatic dialog close behavior so focus returns to the invoking control for project creation, project editing, and document upload flows
  - Added targeted Vitest accessibility regressions for dashboard live regions, kanban announcements, and dialog focus restoration, and installed the missing `@testing-library/dom` test dependency needed to run them
  - Verified with targeted Vitest coverage, a successful production build, and browser accessibility snapshots on dashboard and monitor
- **ui-density-refinement** (P2, post-MVP): Shipped the cross-route density and composition follow-up
  - Home now uses a bounded route canvas and a more cohesive sidebar surface so the shell reads as one workspace instead of a detached rail plus content field
  - Inbox now has a denser control bar with queue counts, stronger tab framing, and clearer bulk-action affordances that better match the notification cards below
  - Projects now adds top-level structure with summary metrics and a bounded card region so small project counts do not leave a large unfinished-looking field
  - Verified with a successful production build and a browser pass on home, inbox, and projects after implementation
- **usage-metering-ledger** (P1, post-MVP): Shipped the normalized provider-usage foundation
  - Added a dedicated `usage_ledger` table plus task-level workflow/schedule linkage so metering is durable and does not rely on provider-shaped `agent_logs` payloads or task-title parsing
  - Claude and Codex task execution/resume flows now persist normalized usage rows, and task-assist/profile-test activity also writes standalone ledger records
  - Added pricing-registry logic, daily spend/token query helpers, provider/model breakdown queries, audit-log joins, and representative seed data for both providers
  - Verified with the full Vitest suite (`169` passing tests) and a successful production build
- **spend-budget-guardrails** (P1, post-MVP): Shipped spend governance across all provider entry points
  - Added structured budget-policy storage and validation for overall daily/monthly spend caps plus runtime-scoped spend and token caps
  - New guardrail service evaluates daily/monthly ledger totals in the local runtime timezone, emits deduplicated 80% warning notifications, and blocks new provider calls once a relevant cap is exceeded
  - Task execute/resume routes now return explicit budget errors up front, while workflows, schedules, task assist, and profile tests are protected through the shared runtime layer
  - Blocked attempts now write zero-cost `usage_ledger` audit rows with `blocked` status and create Inbox notifications instead of silently retrying later
  - Settings now exposes a `Cost & Usage Guardrails` section with live blocked/warning state and reset timing per window
  - Verified with the full Vitest suite (`173` passing tests) and a successful production build
- **cost-and-usage-dashboard** (P2, post-MVP): Shipped a first-class spend and token operations surface
  - Added a dedicated `/costs` route plus a top-level sidebar destination and command-palette parity for navigating into cost governance quickly
  - The new dashboard combines day/month summary cards, budget-state messaging, 7-day and 30-day spend/token trends, runtime share cards, model breakdowns, and a filtered audit log with deep links back to tasks, workflows, schedules, and projects
  - Extended usage helpers so unknown-pricing rows remain visible in model breakdowns and audit filters can scope by runtime, status, activity type, and date range
  - Verified with targeted Vitest coverage for the ledger helpers and a successful production build

### Re-prioritized
- **Human-loop attention**: Inserted `ambient-approval-toast` ahead of further workflow expansion
  - Live browser verification showed that an unread Inbox badge is too easy to miss while supervising an active workflow run
  - Permission handling is already durable, but the interaction is still context-breaking; the next improvement should reduce approval friction on already-shipped execution paths
- **Workflow expansion direction**: Replaced the omnibus `parallel-workflows` placeholder with a narrower fork/join foundation
  - `parallel-research-fork-join` is now the next planned workflow-engine feature and moves up to P2 because it extends an already-shipped core surface
  - Broader evaluator-style patterns stay deferred until Stagent proves parallel execution, join synthesis, and workflow-status visibility in a simpler slice
- **Cost & Usage direction**: Dropped ROI framing from the planned feature set
  - Direct spend and token metering are product-truthful with the data Stagent already has access to
  - ROI would require optional user-supplied business-value inputs and would dilute the first governance slice
- **Roadmap order**: Introduced a dedicated Governance & Analytics track and moved cost governance ahead of further provider-portability follow-ons
  - Recommended build order is now usage metering first, budget guardrails second, and the dashboard third

### Ship Verification
- **openai-codex-app-server** (P1, post-MVP): Acceptance criteria re-verified against code, build output, and a live browser run
  - Confirmed runtime registration, provider-aware settings health checks, task assignment surfaces, workflow/schedule targeting, and inbox response plumbing remain wired through the shared runtime layer
  - Full Vitest suite passed (`167` tests) and production build passed after verification
  - Browser verification on March 12, 2026 confirmed a Settings connectivity check and a browser-created Codex-backed task completing successfully with a persisted result

### Enhancement
- **spend-budget-guardrails**: Simplified the Settings guardrail UX to be spend-first
  - Runtime cards now treat daily/monthly spend caps as the primary editable controls
  - Derived token budget guidance is shown as read-only estimates based on recent blended runtime pricing instead of competing as default inputs
  - Hard token ceilings remain available under an advanced section for operators who need strict technical guardrails
- **openai-codex-app-server**: Fixed a live startup regression discovered during ship verification
  - Removed an unsupported Codex thread-start history-persistence flag that caused `thread/start.persistFullHistory requires experimentalApi capability`
  - Re-ran the browser flow after the fix and confirmed successful task completion
  - Runtime startup behavior now matches the currently supported Codex App Server capability surface
- **Roadmap metadata sync**: Reconciled product planning files with the current shipped/in-progress state
  - Marked `multi-agent-routing` completed in the feature spec to match the previously verified profile-routing implementation
  - Added `accessibility` to the roadmap as the current in-progress post-MVP quality track

## 2026-03-11

### Completed
- **openai-codex-app-server** (P1, post-MVP): OpenAI Codex App Server shipped as Stagent's second governed runtime
  - Added an `openai-codex-app-server` adapter and a lightweight WebSocket app-server client under `src/lib/agents/runtime/`
  - Codex-backed tasks now execute, resume, cancel, and persist provider-labeled `agent_logs`, task results, and resumable thread IDs through the shared runtime layer
  - Codex approval requests and user-input prompts now route through Inbox notifications and continue the run from user responses
  - Saved permission shortcuts now auto-approve equivalent Codex command and file-change requests
  - Settings now support OpenAI API-key storage plus a runtime-aware Codex connectivity test
  - Task creation, task assist, schedules, and workflows now allow explicit OpenAI runtime targeting
  - Verified with full Vitest suite (`167` passing tests) and a successful production build
- **operational-surface-foundation** (P2, post-MVP): Solid operational surfaces and theme bootstrapping shipped across dense UI
  - Added `surface-1/2/3` tokens plus reusable `surface-card`, `surface-card-muted`, `surface-control`, and `surface-scroll` utilities
  - Root layout now applies critical theme CSS and an inline startup script to set theme before hydration
  - Theme toggle now synchronizes class, `data-theme`, `color-scheme`, local storage, and cookie state
  - Dashboard, monitor, kanban, inbox, project cards, and settings forms moved off blur-heavy glass defaults onto solid surfaces
  - Settings page widened from `max-w-2xl` to `max-w-3xl` for cleaner scanning
- **profile-surface-stability** (P2, post-MVP): Profile browser and detail routes migrated onto stable operational surfaces
  - Investigation traced the remaining profile jank to the profile routes still relying on the default `[data-slot="card"]` backdrop-blur path after the broader surface migration
  - Earlier compositing hardening reduced the visible flash but did not remove the fragile rendering path for scroll-heavy profile content
  - `/profiles` and `/profiles/[id]` now use bounded `surface-page` framing plus `surface-card`, `surface-panel`, `surface-scroll`, and `surface-control` treatments for primary content
  - Profile policy/test badges were aligned to semantic status tokens during the surface migration
  - This shipped as a bounded slice instead of overloading the broader `ui-density-refinement` backlog
- **provider-runtime-abstraction** (P1, post-MVP): Shared runtime boundary shipped for Claude-backed execution
  - Added a provider runtime registry under `src/lib/agents/runtime/` with centralized runtime IDs, capability metadata, and a Claude adapter
  - Task execute, resume, and cancel routes now dispatch through the runtime layer instead of calling Claude helpers directly
  - Workflow child tasks, scheduler firings, task-definition assist, profile smoke tests, and settings health checks now route through provider-aware runtime services
  - `assignedAgent` is now validated against supported runtime IDs instead of accepting arbitrary strings
  - Runtime metadata is available to both API code and UI code, while Claude behavior remains the default runtime path
  - Verified with full Vitest suite (`163` passing tests) and a successful production build

### Enhancement
- **app-shell**: Theme startup is now hardened against light/dark flash and background mismatch during hydration
- **homepage-dashboard / monitoring-dashboard / task-board / inbox-notifications / project-management**: Dense cards and controls now prioritize scanability over backdrop blur
- **agent-profile-catalog**: Profile detail and browser pages now read like dense operational surfaces rather than blur-first showcase cards
- **Browser evaluation**: Chrome review on home, inbox, settings, and projects confirmed the surface-system improvement and surfaced the next refinement targets
- **settings / runtime metadata**: Authentication now describes the active runtime in provider-neutral terms while still reflecting Claude-specific auth behavior

### Groomed
- **ui-density-refinement** (P2, post-MVP): Follow-up UX tranche from the Chrome browser pass
  - Sidebar/background cohesion on home still needs refinement
  - Inbox action row needs denser spacing and clearer secondary-control affordance
  - Projects page composition needs stronger structure when project count is low
- Updated roadmap: added `operational-surface-foundation` and `profile-surface-stability` as completed and `ui-density-refinement` as planned in UI Enhancement
- **provider-runtime-abstraction** (P1, post-MVP): Introduced a bounded runtime-foundation spec for multi-provider support
  - Separates Stagent orchestration from provider SDK specifics so tasks, workflows, schedules, task-definition AI, and profile smoke tests can run through a shared contract
  - Preserves the existing Claude-first UX while making a second runtime additive rather than invasive
- **openai-codex-app-server** (P1, post-MVP): Added a concrete OpenAI execution spec
  - Recommends Codex App Server as the first OpenAI path because it maps more directly to Stagent's approval and monitoring model than a thin SDK-only integration
  - Frames the work as a governed execution runtime, not as generic provider routing
- **cross-provider-profile-compatibility** (P2, post-MVP): Added a profile-portability follow-on
  - Captures the gap between today's `.claude/skills` profile model and a future provider-aware profile system

### Re-prioritized
- **Multi-provider direction**: Reintroduced provider expansion as a post-MVP platform track, but with a narrower recommendation than the earlier routing concept
  - No immediate user-facing "switch provider" toggle
  - Runtime abstraction ships first, OpenAI Codex App Server second, profile compatibility third
  - This preserves the earlier decision to avoid broad multi-provider routing as part of `multi-agent-routing` while creating a future-proof path for a governed second runtime
- Updated roadmap: provider-runtime-abstraction and openai-codex-app-server are completed; cross-provider-profile-compatibility is now the next runtime-track feature

## 2026-03-10

### Ship Verification
- **workflow-blueprints** (P3, post-MVP): 12/12 acceptance criteria verified — all code implemented and integrated
  - 8 built-in YAML blueprints across work (4) and personal (4) domains
  - Blueprint registry loads from `src/lib/workflows/blueprints/builtins/` + `~/.stagent/blueprints/`
  - Template engine with `{{variable}}` substitution and `{{#if}}` conditional blocks
  - Zod validation schema at `src/lib/validators/blueprint.ts`
  - Blueprint gallery at `/workflows/blueprints` with domain tabs, search, and preview
  - Blueprint editor with YAML validation for custom blueprints
  - Dynamic variable form: 5 input types (text, textarea, number, boolean, select)
  - Instantiation creates draft workflows with resolved prompts and agentProfile mapping
  - Full API: CRUD, instantiate, GitHub import
  - Lineage tracking via `_blueprintId` in workflow definition JSON
  - "From Blueprint" button on `/workflows` page
- Updated roadmap: workflow-blueprints marked `completed`

### Enhancement
- **app-shell**: Collapsible sidebar with icon-only mode
  - `collapsible="icon"` on Sidebar with SidebarTrigger toggle button
  - Custom `StagentLogo` SVG component replacing text-only header
  - Tooltip labels on all nav items via `tooltip` prop on SidebarMenuButton
  - `group-data-[collapsible=icon]` responsive rules for badges, footer, and ⌘K hint
- **app-shell**: PWA support
  - `src/app/manifest.ts` with app name, description, theme color, icons
  - `src/app/apple-icon.tsx` dynamic Apple Touch icon generator
  - `src/app/icon.svg` and `public/icon.svg` app icons
- **agent-integration**: MCP server config passthrough
  - `profile.mcpServers` now passed to Agent SDK `query()` in both `executeClaudeTask` and `resumeClaudeTask`

### Completed
- **agent-profile-catalog** (P3, post-MVP): Complete profile catalog with 13 built-in profiles, import, and testing
  - 9/12 AC already existed from multi-agent-routing infrastructure (registry, 13 builtins, execution integration, gallery UI, editor, selector)
  - **Gap fix (AC6)**: Profile `mcpServers` now passed to Agent SDK `query()` options in both `executeClaudeTask` and `resumeClaudeTask`
  - **Gap fix (AC10)**: GitHub import API (`POST /api/profiles/import`) — fetches profile.yaml + SKILL.md from raw GitHub URLs, validates with Zod, creates via registry
  - **Gap fix (AC12)**: Profile test runner (`src/lib/agents/profiles/test-runner.ts`) — executes behavioral smoke tests against Agent SDK, validates expected keywords in response
  - Import dialog in profile browser header with URL input and error handling
  - "Run Tests" button in profile detail view with pass/fail results and keyword highlighting
  - Test API route: `POST /api/profiles/[id]/test`
- Updated roadmap: agent-profile-catalog marked `completed` (unblocks workflow-blueprints)

### Ship Verification
- **command-palette-enhancement** (P2, post-MVP): 10/10 acceptance criteria verified — all code implemented and integrated
  - 4 command groups: Recent, Navigation, Create, Utility
  - 10 navigation items matching all sidebar routes with icons and cmdk keyword aliases
  - Create: New Task, New Project, New Workflow, New Profile
  - Utility: Toggle Theme (light/dark switch) and Mark All Notifications Read
  - Async recent items: API endpoint returns 5 projects + 5 tasks, fetched on palette open with AbortController cleanup
  - ⌘K hint button in sidebar footer with synthetic KeyboardEvent dispatch
  - Fuzzy search filters across all groups via cmdk keywords
- Updated roadmap: command-palette-enhancement marked `completed`

## 2026-03-09

### Ship Verification (Batch)
- **autonomous-loop-execution** (P3, post-MVP): 6/6 acceptance criteria verified — all code implemented and integrated
  - Loop executor engine with 4 stop conditions (max iterations, time budget, human cancel, agent-signaled)
  - Child task creation per iteration with previous output as context
  - `LoopStatusView` with iteration timeline, progress bar, time budget display, expandable results
  - Pause/resume via DB status polling each iteration + PATCH API
  - Loop state persisted to workflows table `_loopState` field, restored on resume
  - Spec key files slightly renamed vs. implementation (no functional gap)
- **scheduled-prompt-loops** (P2, post-MVP): 14/14 acceptance criteria verified — 3 bugs fixed
  - **Fix (P1)**: Concurrency guard was a no-op — constructed wrong task ID for execution-manager lookup. Replaced with DB query for running child tasks by title pattern
  - **Fix (P2)**: Firing history API had dead exact-match query + full table scan fallback. Replaced with single `LIKE` query
  - **Fix (P3)**: Firing history rows linked to `/projects` instead of task detail. Fixed to link to `/monitor?taskId=...`
- **tool-permission-persistence** (P2, post-MVP): Verified — fully integrated, no code islands
- **document-manager** (P2, post-MVP): Verified — fully integrated, no code islands
- **multi-agent-routing** (P3, post-MVP): Verified — fully integrated, no code islands
- Updated roadmap: autonomous-loop-execution and scheduled-prompt-loops marked `completed`

### Completed
- **tool-permission-persistence** (P2, post-MVP): "Always Allow" for agent tool permissions
  - Permission pre-check in `handleToolPermission()` bypasses notification for trusted tools
  - Pattern format: tool-level (`Read`), constraint-level (`Bash(command:git *)`), MCP (`mcp__server__tool`)
  - "Allow Once" / "Always Allow" split buttons in Inbox permission UI
  - Settings page shows saved patterns with revoke capability
  - Permissions API: `GET/POST/DELETE /api/permissions`
  - Extracted shared `getSetting`/`setSetting` helpers from auth module
  - `AskUserQuestion` always requires human input (never auto-allowed)
  - No migration needed — uses existing `settings` table with new key

### Enhancement
- **project-management**: Added `workingDirectory` field to projects
  - New `working_directory` column on projects table (schema + bootstrap DDL + validator)
  - Agent tasks (`executeClaudeTask`, `resumeClaudeTask`) resolve `cwd` from project's working directory
  - Previously all tasks ran in Stagent's server directory; now they target the project's codebase
  - Working directory input in both Create Project and Edit Project dialogs
  - Project card shows working directory path when set
  - Enables schedules/workflows to operate on external codebases via project association

### In Progress
- **scheduled-prompt-loops** (P2, post-MVP): Time-based scheduling for agent tasks
  - New `schedules` table (14 columns) with bootstrap DDL and Drizzle schema
  - Poll-based scheduler engine (60s interval, in-process via `setInterval`)
  - Human-friendly interval parsing (5m, 2h, 1d) + raw 5-field cron input
  - `cron-parser` npm package for computing next fire times
  - API routes: GET/POST `/api/schedules`, GET/PATCH/DELETE `/api/schedules/[id]`
  - 4 UI components: ScheduleCreateDialog, ScheduleList, ScheduleDetailView, ScheduleStatusBadge
  - `/schedules` page + `/schedules/[id]` detail page with sidebar navigation (Clock icon)
  - Scheduler started via Next.js instrumentation hook (`src/instrumentation.ts`)
  - One-shot and recurring modes, pause/resume lifecycle, expiry and max firings
  - Each firing creates a child task via existing `executeClaudeTask` pipeline
  - 14 acceptance criteria
  - Inspired by Claude Code's `/loop` and CronCreate/CronList/CronDelete

### Groomed
- **agent-profile-catalog** (P3, post-MVP): Full spec expansion from placeholder to complete feature spec
  - Skill-first with sidecar architecture: profiles ARE Claude Code skills (SKILL.md + profile.yaml)
  - 13 built-in profiles across work (8) and personal (5) domains
  - Profile registry scans `.claude/skills/*/profile.yaml` for discovery
  - Claude Code primitives mapping: SKILL.md→Skill, allowedTools→Agent SDK, mcpServers→MCP, canUseToolPolicy→canUseTool, hooks→CC hooks
  - Profile gallery UI with domain tabs, search, detail sheet, YAML editor
  - GitHub import/export for community sharing (profiles portable to plain CC users)
  - Behavioral smoke tests per profile (task + expected keywords)
  - 12 acceptance criteria
- **workflow-blueprints** (P3, post-MVP): Full spec expansion from placeholder to complete feature spec
  - 8 built-in blueprints across work (4) and personal (4) domains
  - Blueprint YAML format with typed variables (text, textarea, select, number, boolean, file)
  - Template resolution: `{{variable}}` substitution + `{{#if}}` conditional blocks
  - Dynamic form generation from variable definitions
  - Blueprint gallery integrated into `/workflows` page (not a separate route)
  - Instantiation creates draft workflows with resolved prompts and profile assignments
  - Lineage tracking via `blueprintId` on workflows table
  - GitHub import/export, YAML editor for custom blueprints
  - 12 acceptance criteria
- Updated roadmap: added `agent-profile-catalog` to `workflow-blueprints` dependencies

### Re-groomed
- **multi-agent-routing** (P3, post-MVP): Rewrote spec from Codex MCP multi-provider routing to profile-based routing within Claude Agent SDK
  - Rationale: Multi-provider routing (Codex, Vercel AI SDK) added high complexity for low user value; profile-based routing delivers meaningful differentiation using the existing SDK surface
  - New approach: Agent profile registry with system prompt templates, allowed tools, MCP server configs per profile
  - 4 starter profiles: general, code-reviewer, researcher, document-writer
  - Task type classifier auto-selects profile; users can override
  - Workflow steps can specify per-step profiles
  - Schema addition: `agentProfile` text column on tasks table
- Added 2 new planned features to roadmap (Agent Profiles section):
  - **agent-profile-catalog** (P3): Comprehensive domain profiles — wealth, health, travel, shopping, project manager, etc.
  - **workflow-blueprints** (P3): Pre-configured workflow templates paired with agent profiles

### Ship Verification
- **micro-visualizations** (P2, post-MVP): 18/18 acceptance criteria verified — all code implemented and integrated
  - 3 pure SVG chart primitives: `Sparkline`, `MiniBar`, `DonutRing` (zero external charting dependencies)
  - 6 data query functions in `src/lib/queries/chart-data.ts` with date-gap filling
  - 5 integration points: stats-cards (3 sparklines), activity-feed (24h bar chart), recent-projects (donut rings), monitor-overview (donut + sparkline), project-detail (stacked bar + sparkline)
  - Full accessibility: `role="img"`, `aria-label`, `<title>` on all chart components
  - OKLCH chart/status tokens throughout, light/dark mode support, responsive hiding on mobile
- Updated roadmap: micro-visualizations marked `completed`

### Groomed
- **micro-visualizations** (P2, post-MVP): Sparkline charts and micro-visualizations for dashboard glanceability
  - 3 pure SVG chart primitives: Sparkline, MiniBar, DonutRing (no charting library)
  - Homepage: 7-day trend sparklines in stats cards, 24h activity bar chart, completion donut rings
  - Project detail: stacked status bar + 14-day completion sparkline
  - Monitor: success rate donut ring + 24h activity sparkline
  - Data aggregation layer with 6 query functions
  - Brainstormed via `/product-manager` + `/frontend-designer` collaboration
- Updated roadmap: added UI Enhancement section with micro-visualizations feature

## 2026-03-08

### Completed (Sprint 7)
- **document-manager** (P2): Full document browser and management UI
  - `/documents` route with sidebar navigation (FileText icon)
  - Table view with sortable columns: name, type icon, size, linked task/project, status, date
  - Grid view with image thumbnails and file type icons (toggle switch)
  - Document detail Sheet: preview, metadata, linked task/project, extracted text, processing errors
  - Preview support: images (inline), PDFs (embedded iframe), markdown (react-markdown), text/code (pre)
  - Search by filename and extracted text content (client-side filtering)
  - Filter by processing status and project
  - Standalone upload dialog with drag-and-drop, multi-file support
  - Bulk delete with multi-select checkboxes
  - Link/unlink documents to projects, unlink from tasks
  - Empty state for no documents and no filter matches
  - API: GET /api/documents (list with joins), PATCH /api/documents/[id] (metadata), DELETE /api/documents/[id] (file + record)

### Ship Verification & Gap Fixes (Sprint 6)
- **file-attachment-data-layer** — verified 9/10 AC, fixed orphan cleanup gap (added `POST /api/uploads/cleanup` route)
- **document-preprocessing** — verified 6/10 AC, fixed 3 gaps:
  - Added `extractedText`, `processedPath`, `processingError` columns to Drizzle schema + bootstrap DDL
  - Wired upload API to trigger `processDocument()` fire-and-forget
  - Added image format validation (supported: png, jpg, gif, webp)
- **agent-document-context** — verified 0/7 AC (code island), fixed by wiring `buildDocumentContext` into both `executeClaudeTask` and `resumeClaudeTask`
- Updated roadmap: 3 document features marked `completed`

### README Update
- Updated README.md to reflect MVP completion (all 14 features shipped)
- Merged Foundation/Core/Polish roadmap sections into single "MVP ✅ Complete"
- Added 7 missing completed features: Homepage Dashboard, UX Gap Fixes, Workflow Engine, Task Definition AI, Content Handling
- Added 3 new post-MVP features: Autonomous Loop Execution, Multi-Agent Swarm, Agent Self-Improvement
- Updated project structure with workflows, dashboard, and project detail directories
- Added react-markdown + remark-gfm to tech stack table

### Design Review (MVP Release)
- **Critical fixes (3)**:
  - C1: Added skeleton loading screens for WorkflowList and WorkflowStatusView (was blank/null during fetch)
  - C2: File upload `fileIds` now included in task creation POST payload (was silently orphaned)
  - C3: Replaced naive line-by-line markdown parser with `react-markdown` + `remark-gfm` for full GFM support
- **Important fixes (5 of 9 — 4 deferred to post-MVP)**:
  - I2: Removed non-functional `⌘K` shortcut hint from sidebar footer
  - I5: Added optimistic status update after clicking Execute in WorkflowStatusView
  - I6: Added per-subtask progress toasts and failure reporting in AI Assist
  - I9: RecentProjects shows empty state CTA instead of returning null for new users
  - I3/I7/I8 deferred to `ideas/ux-improvements.md`
- **Minor fixes (4 of 10 — 6 deferred)**:
  - M1: Extracted status badge color mappings to shared `src/lib/constants/status-colors.ts` (was duplicated in 7 files)
  - M4: Wrapped `JSON.parse` in ContentPreview with try/catch
  - M7: Added expand/collapse toggle for large content outputs
  - M9: Deduplicated `patternLabels` to shared constants
  - M2/M3/M5/M6/M8/M10 deferred
- **Accessibility fixes (3 of 4)**:
  - A1: Added `aria-live="polite"` to InboxList and WorkflowStatusView polling regions
  - A2: Added `aria-label` to all icon-only buttons (ContentPreview, FileUpload, WorkflowCreateDialog)
  - A3: Made file upload drop zone keyboard accessible (role, tabIndex, onKeyDown, focus ring)
  - A4 (focus management) deferred — needs verification
- **Documentation**: Created `features/accessibility.md`, `ideas/ux-improvements.md`, `ideas/design-system-fixes.md`
- Updated acceptance criteria in `homepage-dashboard.md`, `content-handling.md`, `workflow-engine.md`, `ux-gap-fixes.md`

### Completed (Sprint 5)
- **homepage-dashboard** (P1): 5-zone landing page replacing `/` redirect
  - Greeting component with time-of-day salutation and live DB status counts
  - 4 clickable stat cards (running, completed today, awaiting review, active projects)
  - Priority queue showing top 5 tasks needing attention
  - Live activity feed showing last 6 agent log entries
  - Quick actions grid (New Task, New Project, Inbox, Monitor)
  - Recent projects with progress bars and task completion counts
  - Home added to sidebar navigation, logo links to `/`
- **ux-gap-fixes** (P1): 4 audit gaps resolved
  - Task board status filter (already existed from prior work)
  - Notification dismiss: "Dismiss read" bulk action in inbox header
  - Monitor auto-refresh: Page Visibility API pauses polling when tab hidden
  - Project detail view: `/projects/[id]` page with task list and status breakdown
- **workflow-engine** (P2): Multi-step workflow execution engine
  - Three patterns: Sequence, Planner→Executor, Human-in-the-Loop Checkpoint
  - State machine engine at `src/lib/workflows/engine.ts`
  - API routes: POST /api/workflows, POST /api/workflows/[id]/execute, GET /api/workflows/[id]/status
  - WorkflowCreateDialog with dynamic step builder and pattern selection
  - WorkflowStatusView with real-time polling and step progress visualization
  - Workflow list page at `/workflows` with navigation in sidebar
  - Failed step retry capability
- **task-definition-ai** (P2): AI-assisted task creation
  - AI Assist button in task create dialog (uses Agent SDK `query`)
  - Improved description suggestions with one-click apply
  - Task breakdown into sub-tasks with bulk creation
  - Pattern recommendation (single/sequence/planner-executor/checkpoint)
  - Complexity estimation and checkpoint flagging
- **content-handling** (P2): File upload and content preview
  - File upload component with drag-and-drop in task create dialog
  - Upload API at POST /api/uploads, file serving at GET /api/uploads/[id]
  - Type-aware content preview (text, markdown, code, JSON)
  - Copy-to-clipboard and download-as-file actions on task results
  - Task output API with automatic content type detection
  - ContentPreview integrated into task detail panel

### Groomed (Sprint 5)
- **autonomous-loop-execution** (P3, post-MVP): Ralph Wiggum-inspired loop pattern with stop conditions and iteration tracking. Source: Karpathy article
- **multi-agent-swarm** (P3, post-MVP): Gas Town-inspired multi-agent orchestration with Mayor/Workers/Refinery roles. Source: Karpathy article
- **agent-self-improvement** (P3, post-MVP): Agents learn patterns and update own context, with human approval and sweep cycles. Source: Karpathy article
- Updated roadmap: P1 features added to Polish Layer, 3 new post-MVP features, reordered build order

### Completed
- **session-management**: Agent session resume for failed/cancelled tasks
  - Added `resumeCount` column to tasks table (migration 0002)
  - New status transitions: `failed → running`, `cancelled → running`
  - Extracted shared `processAgentStream` helper from `executeClaudeTask`
  - Added `resumeClaudeTask` with session guard, retry limit (3), and session expiry detection
  - Resume API route: `POST /api/tasks/[id]/resume` with atomic claim
  - Resume button in task detail panel (alongside existing Retry)
  - Session cleanup utility for old completed tasks
  - 8 new tests across status transitions, agent resume, and router

### Audit
- Spec-vs-implementation gap audit across all 9 completed features
- Updated 9 feature spec frontmatter from `planned` to `completed`
- Backfilled changelog entries for Sprint 1-4 features (below)
- Identified 4 code gaps: task board status filter, notification dismiss, monitor auto-refresh, project detail view
- Added Ship Verification mode to product-manager skill to prevent future gaps

## 2026-03-07

### Completed
- **monitoring-dashboard**: Real-time agent monitoring with SSE log streaming
  - Monitor overview with 4 metric cards (active agents, tasks today, success rate, last activity)
  - SSE-powered log stream with auto-scroll and auto-reconnect (3s)
  - Log entries with timestamp, task, event type, and payload
  - Filter by task and event type
  - Click log entry to navigate to task detail
  - Manual refresh button for overview metrics
- **inbox-notifications**: Human-in-the-loop notification system
  - Notification list sorted newest first with unread badge on nav
  - Permission request handling (Allow/Deny) with tool input preview
  - Agent message responses with question/answer flow
  - Task completion summaries and failure context with retry
  - Mark read/unread individually and bulk mark-all-read
  - 10s polling for new notifications without refresh
- **agent-integration**: Claude Agent SDK integration with canUseTool pattern
  - `executeClaudeTask` with fire-and-forget execution (POST returns 202)
  - `canUseTool` polling via notifications table as message queue
  - Tool permission flow: agent requests → notification created → user responds → agent continues
  - Agent log streaming to `agent_logs` table
  - Status flow: planned → queued → running → completed/failed/cancelled
  - Execution manager for concurrent task management
- **task-board**: Kanban board with drag-and-drop task management
  - 5-column Kanban layout (Planned, Queued, Running, Completed, Failed)
  - Task creation with title, description, project, and priority
  - Drag-and-drop from Planned → Queued with valid transition enforcement
  - Task detail panel on card click
  - Cancel from any active state, retry failed tasks
  - Project filter, column count badges, inline add task button
  - Scroll indicators for horizontal overflow
- **project-management**: Project CRUD with status tracking
  - Create projects with name and description
  - Project cards with status badges and task counts
  - Edit name, description, and status (active/completed/archived)
  - Archive and complete project status transitions
  - API routes with proper status codes and validation

## 2026-03-06

### Completed
- **app-shell**: Next.js application shell with sidebar navigation
  - Responsive sidebar with collapsible navigation
  - Route structure: Dashboard, Projects, Inbox, Monitor
  - OKLCH hue 250 blue-indigo theme with Tailwind v4
  - shadcn/ui New York style component library setup
  - Dark/light mode toggle
- **database-schema**: SQLite database with Drizzle ORM
  - 5 tables: projects, tasks, workflows, agent_logs, notifications
  - WAL mode for concurrent reads during agent execution
  - Bootstrap CREATE TABLE IF NOT EXISTS for self-healing startup
  - Drizzle migrations in `src/lib/db/migrations/`
  - Settings table added via migration 0003
- **cli-bootstrap**: CLI tool with Commander.js
  - Commander-based CLI entry point at `bin/cli.ts`
  - tsup build pipeline → `dist/cli.js`
  - Project and task management commands
  - Development scripts: `npm run build:cli`

### Groomed
- Extracted 12 features from ideas/ backlog (5 idea files analyzed)
- Created initial roadmap with 9 MVP features and 3 post-MVP features
- MVP features: 3 Foundation (P0), 5 Core (P1), 4 Polish (P2)
- Post-MVP features: 3 features (P3)
- Identified critical path: database-schema → project-management → task-board → agent-integration → inbox/monitoring
- Flagged 6 features needing `/frontend-designer` UX review before implementation
