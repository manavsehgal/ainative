# Handoff: TDR-037 Phase 1 shipped — next session picks up Phase 2 (AppMaterializedCard + dynamic sidebar entry)

**Created:** 2026-04-20 (Phase 1 of scope revision plan shipped in one session — one commit `43d940e2` local, not yet pushed, 17 files changed, 1,062 insertions / 241 deletions, 269/269 plugin-adjacent tests green, `npx tsc --noEmit` clean, working tree clean)
**Supersedes scope of:** `handoff/2026-04-20-m3-phases-c-d-e-complete-handoff.md` Phase F detail — that handoff's Phase F step sequences are deliberately re-scoped under this plan; see §"Re-scoped Phase F" below
**Author:** Manav Sehgal (with Claude Opus 4.7 assist)

Headline: **M3 scope revision ratified and Phase 1 (security retrofit) shipped.** After the M3 Phases C+D+E handoff flagged that ~1,619 LOC of shipped trust machinery served a third-party plugin distribution lane that strategy §10 had refused, a specialist review (product-manager + frontend-designer + architect) converged on a two-path trust model: user-authored / ainative-emitted plugins get zero ceremony (self-extension path, no lockfile); foreign code gets the full M3 machinery gated behind feature flags. Phase 1 landed the classifier, self-extension bypass, feature-flag gates, TDR-037, and strategy §15 amendment. No reverts — additive retrofit. **Phase 2 is the single smallest UX deliverable that makes the "Describe your business → ainative builds it → app is running" claim visible:** `AppMaterializedCard` in chat + dynamic sidebar entry.

---

## Read these first, in order

1. **This handoff** — you're here.
2. **`/Users/manavsehgal/.claude/plans/time-to-consult-the-clever-rose.md`** — the 6-phase execution plan this session is ratifying. Phase 1 complete; Phase 2 specification is at §"Phase 2" (file paths, copy, affordances, verification).
3. **`.claude/skills/architect/references/tdr-037-two-path-plugin-trust-model.md`** — TDR-037 (status: `proposed`). The classifier rationale, per-feature disposition table, migration path. Most durable source of truth for what Phase 1 decided.
4. **`ideas/self-extending-machine-strategy.md` §15 Amendment 2026-04-20** — the strategy-level capture of the scope revision. Lives locally (`ideas/` is gitignored per MEMORY.md); the content is mirrored in TDR-037 for commit-tracked durability.
5. **`handoff/2026-04-20-m3-phases-c-d-e-complete-handoff.md`** — the predecessor handoff. Still authoritative for *what* shipped in Phases C+D+E; this handoff revises *how* that machinery is disposed.
6. **Commit `43d940e2`** — Phase 1. `git show 43d940e2` for the full diff. 17 files, 1,062 insertions, 241 deletions.
7. **`src/lib/plugins/classify-trust.ts`** — the new classifier (pure function, 19 tests). Read before any Phase 2 work that touches the plugin load path.
8. **CLAUDE.md runtime-registry smoke rule** — still binding regardless of scope revision. Phase 4 (re-scoped Phase F smokes) T19 is the sole remaining live-smoke obligation.

---

## What shipped this session (Phase 1)

### Single commit on `main` (not yet pushed; `origin/main` at `e9c19123`)

```
43d940e2  feat(plugins): TDR-037 two-path trust model — self-extension first,
          third-party plugin trust parked
```

**HEAD:** `43d940e2`. Working tree clean. `origin/main` is 1 commit behind (awaiting user go-ahead to push per CLAUDE.md risky-action discipline).

### Scope revision decision

The specialist review (product-manager + frontend-designer + architect, each with their own 1,000-word memo) converged unanimously:

- **M3 Phases C+D+E shipped ~1,619 LOC** of trust machinery (hash pinning, lockfile, per-tool approval Layer 1.8, capability expiry TTL, revocation flow, seatbelt/apparmor/docker confinement wraps) that served a third-party plugin distribution lane strategy §10 explicitly refused.
- **Three real user extensions** (wealth manager Book Ch. 13 1-day build, AI Native Book reader, content marketing pipeline) shipped entirely via Tier 0-2 composition — zero capability-accept events, zero lockfile writes, zero confinement.
- **The "Describe your business → ainative builds it" demo moment is invisible** because the `/apps` surface, empty-state templates, starter templates, ExtensionFallbackCard, and the "app is running" card promised in strategy §6 never shipped.

The revision: **two-path trust model, self-extension is default, third-party machinery stays compiled but parked behind feature flags.** See TDR-037 §4 for the per-feature disposition table.

### Phase 1 files shipped (13 modified, 3 created)

**Created:**
- `src/lib/plugins/classify-trust.ts` (~100 LOC) — pure `classifyPluginTrust(manifest, rootDir, opts?) → 'self' | 'third-party'`. Five signals: `origin: ainative-internal`, `author: ainative`, `author === userIdentity`, rootDir under `~/.ainative/apps/*`, empty capabilities. Primitives-bundle always self.
- `src/lib/plugins/__tests__/classify-trust.test.ts` (~240 LOC, 19 tests) — each signal positive, negatives, precedence (any single signal wins), Kind 5 always self, path normalization.
- `.claude/skills/architect/references/tdr-037-two-path-plugin-trust-model.md` (~200 lines) — the decision record. Status: `proposed`. Transitions to `accepted` when Phase 4 re-scoped smokes pass and strategy freezes.

**Modified:**
- `src/lib/plugins/sdk/types.ts` — added `origin: z.enum(["ainative-internal", "third-party"]).optional()` to both `PrimitivesBundleManifestSchema` and `ChatToolsPluginManifestSchema`. Additive, backward-compatible (`.strict()` preserved).
- `src/lib/plugins/capability-check.ts` — `isCapabilityAccepted` extended with optional `{ manifest, rootDir, trustModelSetting, userIdentity }` opts. Early-returns `{ accepted: true, trustPath: "self" }` when classifier returns `'self'` AND `trustModelSetting !== "strict"`. Legacy call shape unchanged → backward compat. Setting value `"off"` bypasses classifier entirely and returns self for everything.
- `src/lib/plugins/mcp-loader.ts` — threaded `manifest + rootDir + trustModelSetting` into the `isCapabilityAccepted` call at line ~243. Resolves setting via dynamic `import("@/lib/settings/helpers").getPluginTrustModelSync()` with try/catch fallback to `"auto"` (test-env safe).
- `src/lib/chat/tools/plugin-tools.ts` — `list_plugins` threads validated manifest through `PluginManifestSchema.safeParse` before calling `isCapabilityAccepted`, so the chat tool's reported `capabilityAcceptStatus` respects the two-path model. `set_plugin_accept_expiry` description flagged DEPRECATED (TDR-037); return object adds `deprecated: true` + `deprecationReason` fields.
- `src/lib/agents/tool-permissions.ts` — Layer 1.8 wrapped in `process.env.AINATIVE_PER_TOOL_APPROVAL === "1"` guard (default OFF). When OFF, `mcp__*` tools skip the resolver entirely and fall through to the standard permission pipeline.
- `src/lib/plugins/confinement/wrap.ts` — `wrapStdioSpawn` short-circuits to unconfined spawn when `AINATIVE_PLUGIN_CONFINEMENT !== "1"` (default OFF). `dockerBootSweep` short-circuits before probing `docker ps`. All three modes (seatbelt/apparmor/docker) compile and test green with flag ON.
- `src/lib/settings/helpers.ts` — new `getPluginTrustModel`, `getPluginTrustModelSync`, `setPluginTrustModel` helpers keyed on `"plugin-trust-model"`. Defaults to `"auto"`. Values: `"auto" | "strict" | "off"`. Liberal coercion (invalid → `"auto"`).
- `src/lib/utils/ainative-paths.ts` — added `getAinativeAppsDir()` → `~/.ainative/apps/`. Used by classifier Signal 4 and upcoming `/apps` registry.
- `docs/plugin-security.md` — rewritten from 248-line 8-section layered-model doc into ~140-line two-path posture doc. Front-and-center: classifier signals, self-extension vs third-party contract, parked mechanisms table, Settings toggle, non-goals. Full 10-layer treatment deferred until external distribution is real.
- `.claude/skills/architect/references/tdr-035-plugin-mcp-cross-runtime-contract.md` — title rescoped to "Loader-Authority Cross-Runtime Contract" via inline header note. Content unchanged; drift heuristic tests still validate loader/adapter separation regardless of trust path.

**Test file modifications (preserve existing test shapes):**
- `src/lib/plugins/__tests__/capability-check.test.ts` — added Section 5b with 8 self-extension bypass tests. Existing 61 tests unchanged (I added `trustPath` only to the self-extension return, not lockfile returns, specifically so `toEqual` assertions on existing tests survive).
- `src/lib/plugins/__tests__/mcp-loader.test.ts` — T14 confinement describe block now sets/clears `AINATIVE_PLUGIN_CONFINEMENT` in beforeEach/afterEach so the existing wrap integration tests still exercise real wrap paths.
- `src/lib/plugins/confinement/__tests__/wrap.test.ts` — global beforeEach sets flag ON; new describe block at bottom asserts parked (flag OFF) behavior with 3 tests.
- `src/lib/agents/__tests__/tool-permissions.test.ts` — T10 describe block's beforeEach now sets `AINATIVE_PER_TOOL_APPROVAL=1`; new describe block at bottom asserts parked behavior with 1 test.

**Strategy doc (local only — `ideas/` is gitignored per MEMORY.md):**
- `ideas/self-extending-machine-strategy.md` — §15 Amendment 2026-04-20 appended (~150 lines). Mirrored in TDR-037 for commit-tracked durability.

### Test results

- **Plugin-adjacent:** 269/269 green (22 test files). Previous baseline 262 before Phase 1 additions — net +7 test files would be wrong; Phase 1 added tests to existing files, so net +31 tests.
- **Full suite:** 1443 passed, 7 failed, 12 skipped.
  - Failing: `src/__tests__/e2e/blueprint.test.ts` (needs `npm run dev` running), `src/lib/agents/__tests__/router.test.ts` (pre-existing DB setup per M3 handoff line 332), `src/lib/validators/__tests__/settings.test.ts` (pre-existing validator per M3 handoff line 332).
  - All three pre-existing / environmental, not caused by Phase 1.
- **Typecheck:** `npx tsc --noEmit` clean.

---

## Uncommitted state at handoff

**Working tree is CLEAN.** One commit ahead of `origin/main`. Nothing pending locally.

**Not pushed** because CLAUDE.md risky-action discipline: pushing waits for explicit user approval. Run `git push origin main` when ready.

**Not committed** (intentional):
- `ideas/self-extending-machine-strategy.md` §15 amendment — `ideas/` is gitignored. Content mirrored in TDR-037.
- `/Users/manavsehgal/.claude/plans/time-to-consult-the-clever-rose.md` — plans live outside the repo.
- Feedback memory at `/Users/manavsehgal/.claude/projects/-Users-manavsehgal-Developer-ainative/memory/feedback-self-extension-first-third-party-later.md` — pointer added to MEMORY.md.

---

## What's next — Phase 2

### Phase 2 at a glance

**Goal:** Ship the single smallest credible demo deliverable that makes *"Describe your business → ainative builds it → I can see it's running"* a falsifiable claim in under 30 seconds. Per frontend-designer memo, this is the one deliverable that unblocks everything downstream. Without it, wealth-manager / book-reader / content-marketing-pipeline exist as proof points but the *gesture* that says "ainative is the machine that builds machines" is invisible.

| Deliverable | What it does |
|---|---|
| `src/components/chat/app-materialized-card.tsx` | Inline chat card rendered when composition-emitting tool calls complete (detects `create_profile` + `create_blueprint` + `create_schedule` or `create_table` tool-call sequences for the same app-id). Copy: `<name> is live · Profile · Blueprint · N tables · <schedule>  [Open app] [View files] [Undo]`. Status chip `Running`. Calm Ops opaque surface, no modal. |
| `src/lib/apps/registry.ts` | Scans `~/.ainative/apps/*` for manifests. Used by sidebar + future /apps page. Returns `{ id, name, description, primitivesSummary }[]`. |
| `src/components/shared/app-sidebar.tsx` | Dynamic rendering of composed-app entries when `~/.ainative/apps/*` has ≥1 manifest. Entry appears with 180ms fade+slide-in when a new app is composed (client-side event subscription — see implementation note below). |
| Reuse | `StatusChip`, `EmptyState`, existing chat message renderer patterns (confirm renderer file during impl — likely `src/components/chat/message-renderer.tsx` or similar). |

### Phase 2 copy (per frontend-designer §2a — verbatim)

```
[icon] Wealth Manager is live
       Profile · Blueprint · 2 tables · Monday 7am schedule
       [Open app]   [View files]   [Undo]
```

- Status chip `Running` (Calm Ops success variant, opaque)
- "View files" expands inline into a Files list: paths + capability chips (**informational, not a gate**)
- "Undo" reverses within 10-minute soft window (delete files + sidebar entry)
- Present tense *"is live"* — persuasion is in the copy

**This is the self-extension "accept" surface.** No modal, no capability-accept sheet. Capability display is informational. Mirrors Claude Code's single-dialog tone. Capability display happens because Phase 1 classifier now routes these bundles to self-extension; user sees *what was written* without being asked to approve *whether* to trust it.

### Phase 2 implementation order

1. **First**: `src/lib/apps/registry.ts` — scans `~/.ainative/apps/*`. Pure, testable, no UI. Write with tests first.
2. **Second**: `AppMaterializedCard` component. Start as a dumb component that takes props (`{ appId, name, primitives[], status, onOpen, onViewFiles, onUndo }`) and renders the copy. No chat-integration wiring yet.
3. **Third**: detect composition-tool-call sequences in the chat message renderer. Likely pattern: collect tool-call results per message, group by emitted app-id, render one card per group. Dynamic-import the registry per TDR-032 discipline.
4. **Fourth**: sidebar dynamic-render hook. Subscribe to a registry-change event (or poll on short interval — MVP). Add entry with 180ms Tailwind fade+slide-in.
5. **Fifth**: `AppMaterializedCard` wired to sidebar: `onOpen` deeplinks to placeholder `/apps/<id>`; `onViewFiles` expands inline; `onUndo` calls registry's reverse operation.

### Phase 2 verification

Per the plan's verification section:

- Fresh `~/.ainative-uxsmoke/` via `AINATIVE_DATA_DIR`
- Start `npm run dev` (monitor logs per CLAUDE.md smoke-test budget rule — any `ReferenceError: Cannot access .* before initialization` / `claudeRuntimeAdapter` would indicate module-load cycle)
- In chat: *"Build me a weekly reading-list app that tracks books I'm reading."*
- Expect: ainative-app skill runs, chat tools emit manifest + profile + blueprint, `AppMaterializedCard` appears in chat transcript with "Running" status chip, sidebar Compose group gains nested `Apps > Reading List` entry with 180ms fade
- Click "View files" — Files list expands with capability chips (informational, not a gate)
- Click "Undo" within 10 min — files deleted, sidebar entry vanishes, card transitions to "Undone"

### Phase 3 (after Phase 2)

`/apps` route + bento grid + empty state + 3 starter templates. See plan §Phase 3. Three starters (per frontend-designer §1):

1. **Weekly portfolio check-in** (mirrors wealth-manager dogfood)
2. **Research digest** (fan-out blueprint + schedule + document view)
3. **Customer follow-up drafter** (event-triggered, demonstrates reactive composition)

Empty-state hero copy:
```
Teach this instance a new job.
Describe the thing you do every week. Ainative composes a profile, blueprint,
schedule, and tables into a running app — no code, no deploys.
```

### Phase 4 — Re-scoped Phase F live smokes

**The predecessor handoff's T19/T20/T21 step sequences are re-scoped under TDR-037. Substitute the following:**

- **T19 (unchanged in spirit, slightly relaxed):** Live `npm run dev` with a real echo-server bundle. Verify:
  - No `ReferenceError: Cannot access 'claudeRuntimeAdapter' before initialization` or similar (CLAUDE.md runtime-registry rule — module-load cycle defense stays).
  - `/api/plugins` correctly classifies echo-server as **self-extension** (author: `ainative`, so classifier returns `'self'`; lockfile not written).
  - Chat invocation of `mcp__echo-server__echo` works without any capability-accept dialog appearing.
- **T20 (drastically reduced):** Single check that `AINATIVE_PLUGIN_CONFINEMENT=1` flag correctly activates seatbelt wrap on macOS (proves park mechanism works). `ps -p <pid> -o command` shows `sandbox-exec -p ...`. **No Docker, no AppArmor, no policy corpus authoring.** Full confinement end-to-end tests are deferred to M3.5 when external `child_process` plugins actually arrive.
- **T21 (drastically reduced):** Skip per-tool-approval cycle (flag OFF by default). Skip expiry (deprecated, removal scheduled). Skip revoke (third-party path only, no third-party plugin in repo to exercise). Replace with:
  - Verify `--safe-mode` still disables Kind-1 plugins globally and surfaces them as `disabled + safe_mode` in `/api/plugins`.
  - Verify Settings `plugin-trust-model = "strict"` correctly forces echo-server through the lockfile path (requires explicit grant even though author is `ainative`).
  - Verify Settings `plugin-trust-model = "off"` accepts any plugin without lockfile consultation.

Phase 4 total budget: **half a day**, not a milestone. T19 is the highest-value smoke and should be prioritized if time-constrained — the module-load-cycle defense is orthogonal to the scope revision.

### Phase 5 (placeholder, deferred until demand)

`/plugins` page in Configure group, conditionally rendered when ≥1 third-party plugin is installed. Do NOT pre-build. Written in plan as placeholder to remember the UX direction. The M3 machinery lives here when it activates — per-tool toggles, confinement selector, hash diff, revoke button, lockfile status.

### Phase 6 — `create_plugin_spec` + `ainative-app` fall-through + ExtensionFallbackCard

Closes the "what if composition isn't enough" loop. When Tier 0-1 composition cannot express what the user needs, ainative scaffolds a Kind 1 MCP plugin under `~/.ainative/plugins/<slug>/` with `author: ainative` + `origin: ainative-internal` — so the Phase 1 classifier routes the fresh scaffold straight to self-extension on first reload.

- **New chat tool `create_plugin_spec`** — scaffolds `plugin.yaml` + `.mcp.json` + `server.py` or `server.js` + `README.md` to a canonical plugin dir. One tool stub wired end-to-end so the user fills in business logic, not plumbing.
- **`ainative-app` skill extension** — Phase 2 of the skill falls through to `create_plugin_spec` when composition can't cover. Single continuous chat session.
- **ExtensionFallbackCard** — two paths, not three ("Compose-only alternative" primary, "Scaffold a plugin" secondary). Per frontend-designer §3.

---

## Regression guards — don't undo these

### From this session (Phase 1)

**TDR-037 — self-extension bypass bypasses the lockfile ENTIRELY.** `isCapabilityAccepted` when classifier returns `'self'` returns `{ accepted: true, trustPath: 'self' }` without calling `readPluginsLock()`. A future contributor "consolidating" the function body and re-introducing a lockfile read before the fast-path would silently undo self-extension — a drifted manifest would start triggering re-accept prompts on user-authored code. The test `"Self-extension bypass does NOT write to plugins.lock (file remains absent)"` in `src/lib/plugins/__tests__/capability-check.test.ts` catches this regression.

**TDR-037 — `trustPath` field is ONLY on the self-extension return.** Third-party / lockfile returns omit `trustPath`. This is deliberate so existing tests using strict `toEqual` don't need updating. A future refactor adding `trustPath: 'third-party'` to every return value will break 8 existing tests. If you want richer UI signal, add a new field (e.g. `via: 'lockfile' | 'classifier'`) — don't repurpose `trustPath`.

**TDR-037 — classifier signal 5 (empty capabilities) is ABSOLUTE.** Even when `origin: third-party` is explicitly set, `capabilities: []` flips to self-extension. Intentional: nothing to gate means nothing to ceremonially accept. Test `"explicit origin='third-party' does NOT override empty capabilities"` in `classify-trust.test.ts` catches regression. Don't add "strict third-party even with empty caps" logic — it buys nothing and breaks the symmetry with Kind 5 bundles.

**TDR-037 — primitives-bundle always classifies as self.** Even with foreign author + `origin: third-party`. Data-only surface, no executable code (Kind 5 loader only reads YAML + SKILL.md). Future contributor adding a "third-party primitives-bundle gate" is solving a non-existent threat model — primitives bundles can't ship code. §10 Amendment II moved Kind 2 (executable data processors) into MCP resource providers exactly to preserve this guarantee.

**TDR-037 — feature flags default OFF.** `AINATIVE_PER_TOOL_APPROVAL` and `AINATIVE_PLUGIN_CONFINEMENT` MUST stay unset by default. Tests specifically verify parked behavior when unset (in `wrap.test.ts` "confinement parked by default" describe block; in `tool-permissions.test.ts` "Layer 1.8 parked by default" describe block). A future release-prep change to flip defaults ON re-enters the strategy §10 refused lane without the explicit `accepted` status update of TDR-037.

**TDR-037 — Settings toggle has THREE values, not two.** `"auto" | "strict" | "off"`. Collapsing to a boolean (enabled/disabled) would lose user autonomy: `"strict"` is "training wheels on my own code" and `"off"` is "Claude Code-grade freedom for all plugins." These are distinct user intents. `getPluginTrustModel` returns `"auto"` as the safe fallback for any invalid / missing value.

**TDR-037 — `set_plugin_accept_expiry` is DEPRECATED but not removed.** Tool description flags deprecation, return now includes `deprecated: true` + `deprecationReason`. The underlying `expiresAt` lockfile field + `isCapabilityAccepted` expired-branch + schema preservation stay for backward-compat with hand-edited lockfiles. Scheduled for removal after an audit confirms no callers remain — NOT a candidate for immediate deletion.

**TDR-037 — classifier `author` match is LIBERAL.** Matches `"ainative"` literal OR the user's OS username OR (future) Settings-configured email. Passing any of these should trigger self-extension. A future contributor tightening to strict-email-match would lock out hand-authored plugins on systems where `os.userInfo().username` is the only identity signal.

**TDR-037 — `origin` field is NOT cosmetic (excluded from hash).** `EXCLUDED_COSMETIC_FIELDS` in `capability-check.ts` excludes `name, description, tags, author` but NOT `origin`. Flipping `origin` is a security-relevant change that should trigger hash-drift on the third-party path. Adding `origin` to the excluded set would let a malicious editor quietly change the trust path without re-accept.

### From prior sessions (still binding)

All Phase A + B + C + D + E regression guards remain authoritative. See `handoff/2026-04-20-m3-phases-c-d-e-complete-handoff.md` → "Don't undo these" for the 15+ guards across Phases C+D+E. Critical callouts that intersect with Phase 1:

- **TDR-032 dynamic-import discipline** — Phase 1 preserved this throughout. Every `isCapabilityAccepted` caller in `plugin-tools.ts` uses `await import()` inside the tool handler body. `mcp-loader.ts`'s setting-read is wrapped in try/catch for test-env safety.
- **TDR-035 loader-authority** — Phase 1 changes zero adapter code. The two-path split happens upstream at `isCapabilityAccepted`; all five-source merge invariants hold.
- **Five-source MCP merge order** — untouched. Plugin servers still enter at position 4; `ainative` still wins at position 5.

---

## Risks and watches for Phase 2

### Chat message renderer callsite unknown

The plan references `src/components/chat/message-renderer.tsx` speculatively. Before Phase 2 implementation, run `rg -l "tool.?call|tool.?result" src/components/chat/` to find the actual renderer. Tool-call sequence detection (the trigger for rendering `AppMaterializedCard`) must happen inside that renderer's per-message loop. If the renderer is split across several components, the detection probably belongs in a message-level aggregator.

### "180ms fade+slide-in" requires client-side event subscription

Server Components cannot observe filesystem changes in `~/.ainative/apps/`. The sidebar entry must appear via:
- Option A: client-side subscription to a chat event emitted after `create_profile`/`create_blueprint`/etc. complete.
- Option B: poll `/api/apps/registry` on a short interval (1-2s) from the sidebar.
- Option C: SSE stream from a new `/api/apps/stream` endpoint.

MVP: Option B (polling) is simplest and matches the existing task-status polling pattern. Upgrade to A or C post-demo if UX feels laggy.

### "Undo within 10 min" requires transactional bookkeeping

The registry needs to track "last N composition events with reversible file list" to implement "Undo". MVP approach: store last-5 compositions in-memory per session, track the exact file paths written, and on Undo delete those files + invalidate the sidebar entry. No schema change needed; purely in-process state.

### Phantom LSP warnings — still flaky

Per MEMORY.md "The TS diagnostic panel is consistently flaky." Phase 1 saw ~10 phantom `Cannot find module '@/lib/plugins/...'` warnings that `npx tsc --noEmit` confirmed clean. Phase 2 will see more. Trust `tsc` over the panel.

### `@/lib/apps/registry.ts` is a new path under `src/lib/apps/`

No prior code exists there. The directory creation is clean. Do NOT accidentally name it `src/lib/plugins/apps-registry.ts` — the plugin/app distinction is the whole point of the scope revision. `~/.ainative/apps/` composition bundles are NOT plugins; they live in a separate surface precisely so the vocabulary carries the trust signal.

### Phase 1 commit not yet pushed

Run `git push origin main` when ready. CLAUDE.md risky-action discipline: push is a user-initiated action; don't autopush.

---

## Open decisions deferred to Phase 2+

- **`AppMaterializedCard` "Undo" window duration** — plan says 10 minutes; implementer may revise to 5 or 15 based on user-testing feel. Not a correctness decision.
- **Sidebar dynamic-entry pinning** — if an app is used >N times, offer "Pin to sidebar" on its detail page (per frontend-designer §6). N not specified; implementer picks a reasonable threshold (5? 10?). Trivial to adjust later.
- **Starter template copy** — the 3 starters named in Phase 3 need final prompt copy for their "Build it for me" seeded chat messages. Draft during implementation; refine based on what the `ainative-app` skill actually produces when seeded.
- **`/apps` page empty-state secondary CTA** — "Browse starters" anchor link or separate button? Trivial UX call during implementation.
- **Code tab reveal on `/apps/[id]` when `AINATIVE_DEV_MODE=1`** — deferred with Phase 5. Implementer MAY stub the placeholder but MUST NOT implement the Code tab this session.

---

## Environment state at handoff time

- **Branch:** `main`, working tree clean. One commit ahead of `origin/main` (not pushed).
- **HEAD:** `43d940e2` (Phase 1 scope revision).
- **Tests (plugin-adjacent + chat + settings subset):** 269/269 green across 22 test files. Full suite 1443 passed, 7 failed — all 7 pre-existing / environmental (router DB setup, settings validator, E2E requires dev server).
- **`npx tsc --noEmit`:** clean.
- **`package.json` version:** still `0.13.3`. npm publish deferred until post-M5 per original 2026-04-19 Amendment (unchanged by this scope revision).
- **`SUPPORTED_API_VERSIONS`:** `["0.14", "0.13", "0.12"]`.
- **Dev server:** not running.
- **Smoke data dirs:** `~/.ainative-uxsmoke` / `~/.ainative-smoke-m3` / etc. — not yet created. Will be created during Phase 2 / Phase 4.
- **Chat-tool count:** 91 (unchanged by Phase 1 — `set_plugin_accept_expiry` is deprecated in description but still registered).
- **TDR count:** 37 with TDR-037 `proposed`, TDR-035 title rescoped. TDR-037 transitions to `accepted` when Phase 4 re-scoped smokes pass.
- **Feature flags documented (both default OFF):**
  - `AINATIVE_PER_TOOL_APPROVAL=1` — activates Layer 1.8 per-tool approval resolver
  - `AINATIVE_PLUGIN_CONFINEMENT=1` — activates seatbelt/apparmor/docker wrap + Docker boot sweep
- **Settings key documented:** `plugin-trust-model` (`auto` default, `strict`, `off`).

### New artifacts this session (all committed, not pushed)

- `src/lib/plugins/classify-trust.ts` (new)
- `src/lib/plugins/__tests__/classify-trust.test.ts` (new, 19 tests)
- `.claude/skills/architect/references/tdr-037-two-path-plugin-trust-model.md` (new)
- `src/lib/plugins/sdk/types.ts` (modified — `origin` field on both kinds)
- `src/lib/plugins/capability-check.ts` (modified — self-extension bypass)
- `src/lib/plugins/mcp-loader.ts` (modified — opts threading + settings resolution)
- `src/lib/chat/tools/plugin-tools.ts` (modified — validated manifest threading + expiry deprecation)
- `src/lib/agents/tool-permissions.ts` (modified — Layer 1.8 flag gate)
- `src/lib/plugins/confinement/wrap.ts` (modified — wrap + boot-sweep flag gates)
- `src/lib/settings/helpers.ts` (modified — plugin-trust-model helpers)
- `src/lib/utils/ainative-paths.ts` (modified — `getAinativeAppsDir` added)
- `docs/plugin-security.md` (rewritten, 248 → ~140 lines)
- `.claude/skills/architect/references/tdr-035-plugin-mcp-cross-runtime-contract.md` (modified — title rescope header note)
- Test additions: capability-check (61 → 69, +8 self-extension bypass tests), confinement wrap (25 → 28, +3 parked-by-default), tool-permissions (11 → 12, +1 parked-by-default), mcp-loader (T14 block wrapped with flag-setting beforeEach)

### New artifacts NOT committed (intentional)

- `ideas/self-extending-machine-strategy.md` — §15 amendment (local only; `ideas/` gitignored)
- `/Users/manavsehgal/.claude/plans/time-to-consult-the-clever-rose.md` (plan outside repo)
- `/Users/manavsehgal/.claude/projects/-Users-manavsehgal-Developer-ainative/memory/feedback-self-extension-first-third-party-later.md` (memory outside repo)

---

## Session meta — what this handoff captures vs. what the committed artifacts already capture

This handoff focuses on **Phase 1 shipped → Phase 2 transition**, not on re-explaining Phase 1 internals. Canonical sources:

- **TDR-037 content** → `.claude/skills/architect/references/tdr-037-two-path-plugin-trust-model.md` (committed)
- **Classifier behavior** → `src/lib/plugins/classify-trust.ts` + its 19 tests (committed)
- **Self-extension bypass behavior** → `src/lib/plugins/capability-check.ts:isCapabilityAccepted` + its 8 new tests (committed)
- **Feature-flag contract** → `src/lib/plugins/confinement/wrap.ts` + `src/lib/agents/tool-permissions.ts` + their parked-by-default tests (committed)
- **Settings helper** → `src/lib/settings/helpers.ts` (committed)
- **Scope revision decision record** → TDR-037 and strategy §15 Amendment (committed / local)
- **Execution plan** → `/Users/manavsehgal/.claude/plans/time-to-consult-the-clever-rose.md`
- **Phase 2/3/4/6 specification** → plan §"Execution phases"
- **Commit** → `git show 43d940e2`

If in doubt, read the source. This handoff is the routing table, not the authority.

---

*End of handoff. Phase 1 shipped as one commit (17 files, 1,062/-241 lines, 269/269 plugin-adjacent tests green). Phase 2 is the single smallest UX deliverable (`AppMaterializedCard` + dynamic sidebar entry) — the moment the north-star claim becomes visible. Phase 3 (`/apps` + starters), Phase 4 (re-scoped live smokes, half-day), Phase 5 (`/plugins` placeholder), Phase 6 (`create_plugin_spec` + skill fall-through + ExtensionFallbackCard) follow in order. After Phase 4 passes, TDR-037 flips to `accepted`, strategy §15 becomes authoritative, and M3 is done — next milestone is M4 `nl-to-composition-v1` on top of the self-extension foundation.*
