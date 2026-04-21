# Handoff: TDR-037 Phase 2+3 shipped — next session picks up Phase 4 (re-scoped Phase F live smokes)

**Created:** 2026-04-20 (Phase 2 + Phase 3 of the scope-revision plan shipped in one session — one commit `25ce6046` pushed to `origin/main`, 21 files changed, 1,693 insertions / 0 deletions, 60/60 new Phase 2+3 tests green, 499/499 chat + plugins + components regression-safe, `npx tsc --noEmit` clean, working tree clean)
**Supersedes scope of:** `handoff/2026-04-20-tdr-037-phase-1-shipped-handoff.md` §Phase 2 + §Phase 3 specs — those are now shipped; this handoff updates only *what's new*, *what's next*, and *what not to undo*
**Author:** Manav Sehgal (with Claude Opus 4.7 assist)

Headline: **The "self-extension is visible" UX contract landed.** After Phase 1 ratified the two-path classifier and parked third-party machinery behind flags, Phase 2 shipped the `AppMaterializedCard` + dynamic sidebar + `/apps` detail page that make the *"Describe your business → ainative builds it → app is running"* claim falsifiable in under 30 seconds. Phase 3 added three starter templates (weekly portfolio check-in, research digest, customer follow-up drafter) and the empty-state hero copy promised in strategy §6 + frontend-designer §1. No changes to plugin trust machinery, no modal on self-extension accept, zero reverts. **Phase 4 is the re-scoped Phase F live smokes (half-day budget):** prove the echo-server roundtrip under dev mode, prove `AINATIVE_PLUGIN_CONFINEMENT=1` activates seatbelt, prove `--safe-mode` + Settings `plugin-trust-model` toggles work as advertised.

---

## Read these first, in order

1. **This handoff** — you're here.
2. **`handoff/2026-04-20-tdr-037-phase-1-shipped-handoff.md`** — sets the two-path-model context, TDR-037 references, and the 6-phase execution plan structure. Phase 2 + Phase 3 shipped per its spec; Phase 4 details live in its §"Re-scoped Phase F" section (reproduced below for convenience).
3. **`.claude/skills/architect/references/tdr-037-two-path-plugin-trust-model.md`** — TDR-037 (status still `proposed`; flips to `accepted` after Phase 4 smokes pass).
4. **Commit `25ce6046`** — Phase 2 + Phase 3. `git show 25ce6046 --stat` for the file list, `git show 25ce6046` for the full diff.
5. **`src/lib/apps/registry.ts`** + `src/lib/apps/composition-detector.ts` — the two pure modules at the heart of Phase 2. Read these before any Phase 4 work that cross-cuts composition UX.
6. **CLAUDE.md runtime-registry smoke rule** — still binding. Phase 4 T19 is the next live-smoke obligation (and the highest-value step in Phase 4 regardless of security posture).

---

## What shipped this session (Phase 2 + Phase 3)

### Single commit on `main` (pushed)

```
25ce6046  feat(apps): TDR-037 Phase 2+3 — AppMaterializedCard, /apps
          surface, 3 starter templates
```

**HEAD:** `25ce6046`. **`origin/main`:** synced. Working tree clean.

### Phase 2 — AppMaterializedCard + dynamic sidebar

**Created:**
- `src/lib/apps/registry.ts` (~215 LOC) — pure scanner for `~/.ainative/apps/*` manifests. Exports `listApps()`, `getApp(id)`, `deleteApp(id)`, `parseAppManifest`, `buildPrimitivesSummary`, `humanizeCron`. Zod schema with `.passthrough()` (forward-compat). `deleteApp` has path-traversal guard (`resolved.startsWith(appsDir + sep)`).
- `src/lib/apps/composition-detector.ts` (~115 LOC) — `detectComposedApp(toolResults) → ComposedAppSummary | null`. Groups tool results by `<app-id>--` namespace prefix (per ainative-app skill convention). Returns the first group that satisfies profile + blueprint + (table OR schedule). Ignores cross-app mixing.
- `src/lib/apps/use-apps.ts` (~50 LOC) — client hook. Polls `/api/apps` every 5000ms + listens for `window` `ainative-apps-changed` CustomEvent for instant refresh after undo.
- `src/lib/apps/__tests__/registry.test.ts` — 20 tests (parse, summary, humanizeCron, listApps, getApp, deleteApp including path-traversal).
- `src/lib/apps/__tests__/composition-detector.test.ts` — 16 tests (namespace parse, group-by, cross-app rejection, pluralization, display-name fallback).
- `src/components/chat/app-materialized-card.tsx` (~140 LOC) — Calm Ops opaque-surface card. Copy: `[icon] <name> is live · <primitives>  [Open app] [View files] [Undo]`. Running `StatusChip`. Files list is informational ("No approval required") — **no modal, no capability sheet**. `onUndo` is async with pending state.
- `src/components/chat/__tests__/app-materialized-card.test.tsx` — 9 tests (copy, primitives, toggle, undo wiring, keyboard access).
- `src/app/api/apps/route.ts` — `GET /api/apps` → `AppSummary[]`.
- `src/app/api/apps/[id]/route.ts` — `GET /api/apps/[id]` detail + `DELETE` for undo.
- `src/app/apps/[id]/page.tsx` (~140 LOC) — detail page with Composition + Files bento, back-nav to `/apps`, Running StatusChip in header actions slot.

**Modified:**
- `src/lib/chat/engine.ts` — single import + 2-line metadata spread. `detectComposedApp(toolResults)` runs after `extractToolResultEntities`; when non-null, persisted into message metadata as `composedApp: {...}`. Only applies to the Claude runtime (other engines don't collect tool results).
- `src/components/chat/chat-message.tsx` — parses `composedApp` from metadata. Renders via **`ComposedAppCard` sub-component** specifically because React hooks can't come after the early returns (`isSystem && return null` etc.) in `ChatMessage`. The sub-component owns the `useState`/`useCallback` needed for undo.
- `src/components/shared/app-sidebar.tsx` — adds static `/apps` entry in Compose group (position 2, between Projects and Workflows). Adds `<AppsSubMenu />` nested under the Apps item that consumes `useApps()` and renders `SidebarMenuSub` entries with `animate-in fade-in slide-in-from-left-2 duration-200` (Tailwind + tw-animate-css, already used elsewhere in codebase).

### Phase 3 — /apps surface + 3 starter templates

**Created:**
- `.claude/apps/starters/weekly-portfolio-check-in.yaml` — mirrors wealth-manager dogfood.
- `.claude/apps/starters/research-digest.yaml` — fan-out blueprint + schedule + document view.
- `.claude/apps/starters/customer-follow-up-drafter.yaml` — event-triggered (no schedule) composition.
- `src/lib/apps/starters.ts` (~65 LOC) — repo-shipped loader, scans `.claude/apps/starters/*.{yaml,yml}` via `getAppRoot(import.meta.dirname, 3)`.
- `src/lib/apps/__tests__/starters.test.ts` — 10 tests (parse, defaults, listStarters with alphabetic sort + .yaml/.yml both accepted).
- `src/components/apps/starter-template-card.tsx` (~100 LOC) — keyboard-accessible Calm Ops card. Click/Enter/Space → seed `window.sessionStorage["chat:prefill:pending"] = starterPrompt` and `router.push("/chat")`. **Reuses the existing conversation-template-picker prefill channel** — zero new state plumbing. Icon map (trending-up / library / mail / sparkles).
- `src/components/apps/__tests__/starter-template-card.test.tsx` — 5 tests (render, click behavior, keyboard access, pluralization, empty preview).
- `src/app/apps/page.tsx` — **empty state:** full frontend-designer §1 hero copy ("Teach this instance a new job") + "Start in chat →" CTA + "Browse starters" anchor link + starters grid. **Populated state:** user apps grid first, then "Start from a template" section below. Both states use `StatusChip status="running"` + `<Card>` with `hover:border-primary/50` per Calm Ops.

### Test results

- **Phase 2 + Phase 3 new:** 60/60 green across 5 test files (20 registry + 16 composition-detector + 10 starters + 9 materialized-card + 5 starter-card).
- **Chat + plugins + components regression:** 499/499 green across 47 test files.
- **Full suite:** not re-run this session (the 7 pre-existing environmental failures from Phase 1 still stand — E2E requires dev server, router DB setup, validator — none touched by Phase 2+3).
- **Typecheck:** `npx tsc --noEmit` clean.
- **Dev smoke:** `/apps` empty → 3 starter cards visible via `data-starter-id` attribute; `/apps` populated (fixture at `~/.ainative-uxsmoke-p3/apps/wealth-tracker/`) → user app + starters; `GET /api/apps` serves 200 with humanized `"Sunday 8pm"` primitive summary; `DELETE /api/apps/reading-list` removes files from disk and returns `{ok: true}`; zero `ReferenceError`/`claudeRuntimeAdapter` module-load-cycle crashes.

---

## Uncommitted state at handoff

**Working tree is CLEAN. Pushed to `origin/main`.** Nothing pending locally.

---

## What's next — Phase 4

Reproduced from `handoff/2026-04-20-tdr-037-phase-1-shipped-handoff.md` §"Re-scoped Phase F" with no scope drift. Half-day budget. T19 is the highest-value smoke and should be prioritized if time-constrained.

### T19 — echo-server classifier + MCP registration (priority)

Live `npm run dev` with the real echo-server bundle at `src/lib/plugins/examples/echo-server/`. Verify:

- No `ReferenceError: Cannot access 'claudeRuntimeAdapter' before initialization` or similar (CLAUDE.md runtime-registry rule — module-load-cycle defense is orthogonal to the trust-model revision).
- `/api/plugins` correctly classifies echo-server as **self-extension** (`author: ainative`, so classifier returns `'self'`; lockfile not written).
- Chat invocation of `mcp__echo-server__echo` works without any capability-accept dialog appearing.

Command: `AINATIVE_DATA_DIR=~/.ainative-smoke-m3 npm run dev`. Grep logs for `ReferenceError`/`Cannot access .* before initialization`/`claudeRuntimeAdapter` — expect zero.

### T20 — confinement flag activation

`AINATIVE_PLUGIN_CONFINEMENT=1` + seatbelt mode in echo-server fixture. `ps -p <pid> -o command` shows `sandbox-exec -p ...` wrap on macOS.

**Do NOT author real policy corpus.** No Docker, no AppArmor. Just prove the park-mechanism flag correctly turns on the seatbelt wrap path (TDR-037 contract: flag OFF is default and parked).

### T21 — safe-mode + Settings toggle

Replace the original T21 (per-tool approval + expiry + revoke cycles) — those lanes are parked/deprecated per TDR-037. Instead:

- `node dist/cli.js --safe-mode` → `/api/plugins` shows echo-server `disabled + safe_mode`; `mcp__echo-server__*` unavailable in chat.
- Settings `plugin-trust-model = "strict"` correctly forces echo-server through the lockfile path (requires explicit grant even though author is `ainative`).
- Settings `plugin-trust-model = "off"` accepts any plugin without lockfile consultation.

### Phase 4 acceptance

Pass all three above → TDR-037 flips from `proposed` to `accepted`, strategy §15 Amendment becomes authoritative, `features/chat-tools-plugin-kind-1.md` status flips to `shipped`, `features/changelog.md` gets a dated entry per plan §Final acceptance.

---

## Phase 6 preview (after Phase 4)

`create_plugin_spec` chat tool + `ainative-app` skill fall-through + `ExtensionFallbackCard`. Closes the "composition isn't enough" loop: scaffold a Kind 1 MCP plugin under `~/.ainative/plugins/<slug>/` with `author: ainative` + `origin: ainative-internal` so the Phase 1 classifier routes straight to self-extension on first reload. Plan §Phase 6 has the full spec — do not pre-build before Phase 4 ships.

---

## Regression guards — don't undo these

### From this session (Phase 2 + Phase 3)

**`deleteApp` path-traversal guard is critical.** `src/lib/apps/registry.ts:deleteApp` resolves both `appsDir` and the candidate path, then `rootDir.startsWith(resolvedApps + path.sep)`. A refactor that "simplifies" to a raw `path.join(appsDir, id)` + `rmSync` would let `id = "../other"` escape the apps sandbox and recursively delete sibling directories. `onUndo` is a user-authorized destructive operation — this guard is load-bearing, not cosmetic. Test `"refuses a path-traversal id"` catches regression.

**`AppsSubMenu` must return `null` when `apps.length === 0`.** Rendering an empty `<SidebarMenuSub>` wraps the Apps entry in extra DOM that shifts keyboard focus order and introduces a `<ul>` with no `<li>` children (invalid HTML in some browsers). A future "always show nested menu for consistency" refactor would regress UX. The current early-return is intentional.

**`useApps` polls AND listens for `ainative-apps-changed` CustomEvent.** Polling alone has a 5s latency on undo — the CustomEvent gives instant feedback. Removing the event listener and relying only on polling makes the undo animation feel broken. Removing polling and relying only on events misses the case where another tab/window materializes an app (since events don't cross documents). Both signals are needed.

**`composedApp` metadata is OPT-IN per message.** `src/lib/chat/engine.ts` only spreads `{ composedApp }` when `detectComposedApp(toolResults)` returns non-null. A refactor that writes `composedApp: null` into every message metadata would bloat DB rows (chat history can have 1000s of messages) and also cause `chat-message.tsx`'s `meta.composedApp && typeof meta.composedApp === "object"` check to pass on `null` — silently rendering an empty card. Keep the conditional spread.

**`ComposedAppCard` is extracted from `ChatMessage` because hooks can't come after early returns.** `ChatMessage` has three early returns (permission_request, question, `isSystem` null). A future inline-refactor that moves the `useState("running"|"undone")` hook back into `ChatMessage` body will violate Rules of Hooks and crash on any system-message render. Keep the sub-component boundary. Test coverage: any render test that mounts a system-message alongside an assistant-message-with-composedApp would catch this.

**`StarterTemplateCard` uses sessionStorage `"chat:prefill:pending"`, NOT a new channel.** `src/components/chat/chat-input.tsx:60-79` already reads this key on mount and clears it. Introducing a parallel "starter prefill" channel would mean two code paths to keep in sync. Reuse is correct — and also means zero touch to ChatInput/ChatShell was needed in Phase 3.

**Starter template YAML schema has `.passthrough()`** (`src/lib/apps/starters.ts:StarterTemplateSchema`). Future fields (e.g. `category`, `expectedDuration`, `requiredApiKeys`) can land without a schema bump. A future `.strict()` tightening would break forward-compat with hand-edited starters.

**Registry's `AppManifestSchema` has `.passthrough()` on every nested object too.** When the ainative-app skill eventually migrates its manifest-emit target from `.claude/apps/` (repo-relative) to `~/.ainative/apps/` (canonical per TDR-037 + `getAinativeAppsDir()`), the skill may add fields (e.g. `apiVersion`, `origin: ainative-internal`) that the registry should surface without crashing. Passthrough preserves them. Don't tighten.

**`detectComposedApp` uses the `<app-id>--` DOUBLE-HYPHEN convention to group tool calls.** This convention is documented in the `ainative-app` skill (`.claude/skills/ainative-app/SKILL.md:80` — "namespace every artifact id with `<app-id>--`"). A refactor that loosens to single-hyphen would cause false positives (e.g. `code-reviewer` profile + `code-review-pipeline` blueprint would incorrectly group into a `code` app). The test `"skips tool results whose id does not follow the -- convention"` catches regression.

**Signal 5 (empty capabilities → self) is still absolute from Phase 1.** Unchanged by Phase 2+3 — called out only because a Phase 4 smoke against echo-server will exercise this lane (echo-server has zero capabilities, so even with `author: someone-else` it classifies as self). Don't add a "strict third-party even with empty caps" override — it buys nothing and breaks the symmetry with Kind 5 bundles.

### From prior sessions (still binding)

All Phase 1 regression guards remain authoritative. See `handoff/2026-04-20-tdr-037-phase-1-shipped-handoff.md` → "Regression guards" for the 8 guards Phase 1 introduced (self-extension bypass bypasses lockfile entirely, `trustPath` field only on self return, feature flags default OFF, Settings has THREE values not two, `set_plugin_accept_expiry` deprecated-but-not-removed, etc.). All still load-bearing.

---

## Risks and watches for Phase 4

### Gap: `ainative-app` skill writes to `.claude/apps/`, registry scans `~/.ainative/apps/`

This is the biggest latent issue and does NOT block Phase 4 (which smokes the plugin lane, not the composition lane). Still worth flagging now so it's not rediscovered under deadline pressure later:

- `.claude/skills/ainative-app/SKILL.md:95` instructs the skill to write `manifest.yaml` to `.claude/apps/<app-id>/manifest.yaml` (repo-relative).
- `src/lib/apps/registry.ts` scans `getAinativeAppsDir()` → `~/.ainative/apps/*` (canonical per TDR-037 + classifier Signal 4).
- **Result:** an app composed through the skill today would not appear in the sidebar or `/apps`. The user would see the `AppMaterializedCard` in chat (because that's driven by tool-call metadata, not by filesystem scan) but the "sidebar picks up the new app" moment would fail.

Three fix paths, in rough order of simplicity:
1. **Update the skill's SKILL.md** to write manifest.yaml to `~/.ainative/apps/<app-id>/manifest.yaml` (preserves everything else; the skill's Phase 4 already calls chat tools like `reload_profiles` / `create_table` / `create_schedule` for the other artifacts).
2. **Make the registry scan both locations** — adds complexity, but non-breaking for users who've already composed apps into the old location.
3. **Defer until Phase 6** — if `create_plugin_spec` + skill extension lands, the skill gets edited anyway; fix both migrations in one pass.

Path #1 is a 3-line SKILL.md edit. Path #3 is pragmatic if Phase 4 + Phase 6 are back-to-back sessions. **Recommendation: do #1 as the first 10 minutes of the Phase 4 session**, so the dev smoke of echo-server plus a quick "build me a reading list" chat can materialize through the full stack (classifier → chat tools → registry scan → sidebar → AppMaterializedCard).

### Phase 4 echo-server smoke may need a fresh smoke data dir

Per Phase 1 handoff + CLAUDE.md discipline: run with `AINATIVE_DATA_DIR=~/.ainative-smoke-m3 npm run dev` (or similar isolated dir). Don't reuse the same smoke dir across sessions — migrations and seed data drift. Create a fresh one each time and clean up on exit.

### `transport-dispatch.ts` "Module not found: Can't resolve <dynamic>" warning

Still appears in dev logs. **Pre-existing** — not introduced by Phase 2+3, not by Phase 1. Comes from the plugin mcp-loader's `import()` dynamic specifier that Turbopack can't resolve at compile time. The warning is noise; the code works at runtime (Phase 1 verified). Don't chase this in Phase 4 — different rabbit hole.

### Phantom LSP warnings — still flaky

Per MEMORY.md: "The TS diagnostic panel is consistently flaky." Phase 2+3 saw plenty (Zod `.passthrough()` deprecation spam, `toBeInTheDocument` type-panic on jest-dom matchers, "Cannot find module" right after file creation). Trust `npx tsc --noEmit` over the panel.

### StarterTemplateCard Enter/Space keyboard behavior

The card is `role="button"` `tabIndex={0}` with explicit `onKeyDown` for Enter and Space. This works but is unusual in the codebase (most cards use `<button>` or `<Link>`). If a future a11y audit refactors to a `<button>` wrapper, make sure the inner `<Card>` styling survives — `<button>` has default browser styles that override some Tailwind.

---

## Open decisions deferred to Phase 4+

- **Dogfood promotion:** the plan §Phase 3 said wealth-manager (`/wealth-manager`) and book-reader (`/book`) should surface as `/apps` entries. Phase 3 this session did NOT do that — the /apps page only lists `~/.ainative/apps/*` entries. Deferred until the skill-manifest-location gap (above) is resolved; both dogfoods would need virtual manifests at `~/.ainative/apps/wealth-manager/manifest.yaml` + `.../book-reader/manifest.yaml` to appear. Low priority — the starter cards already prove the composition depth claim.
- **Sidebar dynamic-entry pinning:** frontend-designer §6 said if an app is used >N times, offer "Pin to sidebar" on its detail page. Not implemented. Defer until usage telemetry makes the N threshold concrete.
- **Polling interval tuning:** `useApps(5000)` feels fine in local smoke. If the "fire and forget" undo flow feels laggy once this hits real users, drop to 2000ms or promote polling to SSE. MVP-adequate today.
- **`AINATIVE_DEV_MODE=1` Code tab on `/apps/[id]`:** deferred with Phase 5 (`/plugins` page). The detail page has room for a Code tab but the scope revision explicitly parks it.

---

## Environment state at handoff time

- **Branch:** `main`, working tree clean. **`origin/main`:** synced at `25ce6046`.
- **HEAD:** `25ce6046` (Phase 2 + Phase 3).
- **Tests (Phase 2+3 new):** 60/60 green across 5 test files. Chat + plugins + components regression: 499/499 green across 47 test files. Full suite not re-run this session; 7 pre-existing environmental failures from Phase 1 still stand (not caused by Phase 2+3).
- **`npx tsc --noEmit`:** clean.
- **`package.json` version:** still `0.13.3`. npm publish deferred until post-M5 per original 2026-04-19 Amendment (unchanged by this session).
- **`SUPPORTED_API_VERSIONS`:** `["0.14", "0.13", "0.12"]` (unchanged).
- **Dev server:** not running.
- **Smoke data dirs:** none — `~/.ainative-uxsmoke`, `~/.ainative-uxsmoke-p3` cleaned up on session exit.
- **Chat-tool count:** 91 (Phase 2+3 added zero chat tools; `set_plugin_accept_expiry` still registered-but-deprecated per Phase 1).
- **TDR count:** 37 with TDR-037 `proposed`. Flips to `accepted` after Phase 4.
- **Feature flags documented (both default OFF, unchanged):**
  - `AINATIVE_PER_TOOL_APPROVAL=1` — activates Layer 1.8 per-tool approval resolver
  - `AINATIVE_PLUGIN_CONFINEMENT=1` — activates seatbelt/apparmor/docker wrap + Docker boot sweep
- **Settings key documented (unchanged):** `plugin-trust-model` (`auto` default, `strict`, `off`).

### New artifacts this session (all committed + pushed)

- `src/lib/apps/registry.ts` (new)
- `src/lib/apps/composition-detector.ts` (new)
- `src/lib/apps/starters.ts` (new)
- `src/lib/apps/use-apps.ts` (new)
- `src/lib/apps/__tests__/registry.test.ts` (new, 20 tests)
- `src/lib/apps/__tests__/composition-detector.test.ts` (new, 16 tests)
- `src/lib/apps/__tests__/starters.test.ts` (new, 10 tests)
- `src/components/chat/app-materialized-card.tsx` (new)
- `src/components/chat/__tests__/app-materialized-card.test.tsx` (new, 9 tests)
- `src/components/apps/starter-template-card.tsx` (new)
- `src/components/apps/__tests__/starter-template-card.test.tsx` (new, 5 tests)
- `src/app/api/apps/route.ts` (new)
- `src/app/api/apps/[id]/route.ts` (new)
- `src/app/apps/page.tsx` (new)
- `src/app/apps/[id]/page.tsx` (new)
- `.claude/apps/starters/weekly-portfolio-check-in.yaml` (new)
- `.claude/apps/starters/research-digest.yaml` (new)
- `.claude/apps/starters/customer-follow-up-drafter.yaml` (new)
- `src/lib/chat/engine.ts` (modified — composedApp metadata)
- `src/components/chat/chat-message.tsx` (modified — ComposedAppCard render wrapper)
- `src/components/shared/app-sidebar.tsx` (modified — static Apps entry + AppsSubMenu)

### New artifacts NOT committed (intentional)

None. This session's work is fully captured in commit `25ce6046`.

---

## Session meta — canonical sources

This handoff focuses on **Phase 2+3 shipped → Phase 4 transition**. Don't re-read Phase 2+3 internals here; read the source:

- **Registry + detector + hook** → `src/lib/apps/*.ts` + tests (committed)
- **AppMaterializedCard UX** → `src/components/chat/app-materialized-card.tsx` + test (committed)
- **Starter templates + cards** → `.claude/apps/starters/*.yaml` + `src/components/apps/starter-template-card.tsx` + tests (committed)
- **`/apps` index + detail** → `src/app/apps/page.tsx` + `src/app/apps/[id]/page.tsx` (committed)
- **API routes** → `src/app/api/apps/route.ts` + `[id]/route.ts` (committed)
- **Engine + chat-message + sidebar wiring** → `src/lib/chat/engine.ts` + `src/components/chat/chat-message.tsx` + `src/components/shared/app-sidebar.tsx` (modified, committed)
- **Phase 4 spec** → `handoff/2026-04-20-tdr-037-phase-1-shipped-handoff.md` §"Re-scoped Phase F" (unchanged authority)
- **Phase 6 spec** → `/Users/manavsehgal/.claude/plans/time-to-consult-the-clever-rose.md` §Phase 6 (plan outside repo)
- **Commit** → `git show 25ce6046`

If in doubt, read the source. This handoff is the routing table, not the authority.

---

*End of handoff. Phase 2 + Phase 3 shipped as one commit (21 files, 1,693/+0 lines, 60/60 new tests green, 499/499 regression-safe). Phase 4 (half-day re-scoped Phase F smokes — echo-server classifier + confinement flag + safe-mode + Settings toggle) is the next live-smoke obligation. After Phase 4 passes, TDR-037 flips to `accepted`, strategy §15 becomes authoritative, and M3 is done — next milestone is M4 `nl-to-composition-v1` on top of the self-extension foundation.*
