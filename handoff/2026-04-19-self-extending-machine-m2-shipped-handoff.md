# Handoff: Self-Extending Machine — M1 + M2 SHIPPED, M3 AND DEFERRED PATH A UNSTARTED

**Created:** 2026-04-19 (M2 shipped)
**Supersedes:** `handoff/2026-04-18-self-extending-machine-strategy-handoff.md` (pre-M2 groom → T1–T4 in-progress)
**Author:** Manav Sehgal (with Claude Opus 4.7 assist)

Headline: **M1 is shipped and on origin. M2 (schedules-as-yaml-registry) is shipped and on origin — all 18 tasks, 17 commits past `13d543a0`, HEAD `90487b95`.** Working tree is clean. Next session has two independent on-ramps: `Deferred Path A` (version bump → npm publish) or `M3 groom` (Kind 1 TypeScript plugins). Neither blocks the other.

---

## Read these first, in order

1. **This handoff** — you're here.
2. **`ideas/self-extending-machine-strategy.md`** — the living strategy doc, gitignored local-only. **Authoritative for decisions D1–D6**. Sections to know: §4 (composition ladder), §5 (plugin primitive spec), §9 (5-milestone roadmap — **M1 and M2 shipped; M3 next**), §10 (non-goals — still binding), §11 (risks + off-ramps).
3. **`features/schedules-as-yaml-registry.md`** — the M2 feature spec. Status: `completed`. §"Verification run — 2026-04-19" at line 389 records the T18 smoke. §"DB Upsert with State Preservation" at line 197 is the load-bearing section whose invariants MUST NOT be regressed by any future reload change.
4. **`features/primitive-bundle-plugin-kind-5.md`** — M1 feature spec. `status: completed`. Precedent for M2's shape.
5. **`.claude/skills/architect/references/tdr-034-kind-5-plugin-loader.md`** — architect TDR codifying the four load-bearing M1 decisions. M2 inherits all four.
6. **`features/roadmap.md`** → "Self-Extension Platform" section — `primitive-bundle-plugin-kind-5` and `schedules-as-yaml-registry` both `shipped`; **M3 (`chat-tools-plugin-kind-1`) not yet groomed**.
7. **`features/changelog.md`** top entries — 2026-04-19 grooming + M1 shipped + M2 shipped.
8. **`.superpowers/plans/2026-04-19-schedules-as-yaml-registry.md`** — M2 implementation plan (gitignored). Now a historical artifact.

---

## What shipped in prior sessions

### Session 2026-04-19 part 1 — M1 complete + pushed

25 commits on `main` + M1 groom. All on `origin/main` through `39242255`.

### Session 2026-04-19 part 2 — Path C race defense

- `39242255` — single-statement upsert in `installPluginTables` (race-safe under multi-process WAL). **Pattern template for M2's T7.**

### Session 2026-04-19 part 3 — Path A push

`git push origin main` through `39242255`. NOT done: version bump, SUPPORTED_API_VERSIONS tighten, npm publish. Still pending under "Deferred Path A."

### Session 2026-04-19 part 4 — M2 groom

- `706bd76e` — spec groom (397 lines) + roadmap link + changelog entry.

### Session 2026-04-19 part 5 — M2 plan

- `.superpowers/plans/2026-04-19-schedules-as-yaml-registry.md` — 923-line plan, 18 tasks, architect-revised. **Gitignored, local-only.**

### Session 2026-04-19 part 6 — M2 T1–T4 implementation

All pushed. Registry skeleton + generic `scanBundleSection<T>` + discriminated-union schema + path helper. 110 tests at that point.

### Session 2026-04-19 part 7 — M2 T5–T18 implementation (THIS session)

Executed via `superpowers:subagent-driven-development` with per-task implementer + spec reviewer + code-quality reviewer. All on `main`, all pushed.

**17 commits past `13d543a0`:**

| Task | Commit(s) | What it does |
|---|---|---|
| T5 | `1c247791` + `44d40bc7` | plugin-injection surface (mergePluginSchedules et al.) + file-header comment fix |
| T6 | `9417bae8` + `358ce0cc` | `validateScheduleRefs` async cross-ref validator + export interface + assignedAgent fallback test |
| T7 | `276429f8` + `4486aff8` | `installSchedulesFromSpecs` state-preserving upsert (19 tests) + DRY with canonical `computeNextFireTime` |
| T8 | `7c876853` | self-enforcing column-coverage invariant — every schedules column categorized |
| T9 | `995e3f13` | composite-id + display-name suffix (`plugin:<id>:<sched>` + `(plugin-id)` suffix) |
| T10 | `a3525ba7` + `ce79452b` | wire `scanBundleSchedules` into `loadOneBundle` + async cascade (14 files) + defensive validate + log-format consistency |
| T11 | `ff4cad1a` | three chat tools (list/install/reload) — all dynamic-import per TDR-032 |
| T12 | `1b487936` | `/api/plugins` schedule surface + `reload_plugins` chat tool now emits schedules |
| T13 | `0e0f461b` | install-path parity fixture extended with `schedules/` dir |
| T14 | `766e5d55` | finance-pack `schedules/monthly-close.yaml` dogfood |
| T15 | `1f43f3a3` | boot-order comment tightened (schedules must be in DB before `startScheduler()`) |
| T18 (fix) | `51308a56` | **CRITICAL**: state-preservation bug caught by smoke — removed pre-install delete + added `removeOrphanSchedules` helper |
| T18 (record) | `90487b95` | verification smoke record in feature spec |

T16 (regression: 365/365 passing, plan target ≥170) and T17 (parity re-verify) were verification-only and produced no commits.

---

## What caught my eye — learnings for next session

### The T18 smoke caught a bug unit tests could not

Initial T10 wiring in `loadOneBundle` followed the `tables` pattern:
```ts
removePluginSchedules(manifest.id);
installPluginSchedules(manifest.id, validSchedules);
```

Unit tests passed (19/19 state preservation, 46/46 plugin tests, 127/127 schedules). **Then T18 smoke did the real round-trip:** paused `plugin:finance-pack:monthly-close`, set `firing_count=17`, hit `/api/plugins/reload` — and the state was wiped. `status=active|firing_count=0`.

Root cause: `removePluginSchedules` deleted the row, then `installPluginSchedules` inserted fresh — the `onConflictDoUpdate` never fires because there's no conflict. All state preservation was DOA for the reload path.

**The fix required TWO layers** (first discovered one; regression test still failed; then found the second in `reloadPlugins()` → `removeAllPluginRowsForCachedPlugins`):
1. `loadOneBundle`: install-first, then `removeOrphanSchedules(pluginId, keepIds)` for rows dropped between reloads.
2. `reloadPlugins`: compute pre-scan plugin IDs, ONLY drop schedule rows for plugins that no longer exist post-scan (not all plugins).

**This pattern applies broadly.** Anywhere `onConflictDoUpdate` is used for state preservation, a parallel `db.delete(...)` upstream in the call chain will defeat it. Template for future audit: grep for `removePlugin*`/`clearAllPlugin*` calls that execute before an install with `onConflictDoUpdate`. Tables are safe because they have no user-visible state; schedules were not.

**Key takeaway for CLAUDE.md / MEMORY.md** (append to "Lessons Learned" section):
> **Clear-before-upsert silently defeats `onConflictDoUpdate` state preservation.** If a table's reload story relies on upsert to preserve runtime state, check for any upstream `db.delete(...).where(like(id, "prefix:%"))` that could run before the upsert — it nulls the conflict. Caught in M2 T18 smoke: schedules state silently reset to `active|0` on every reload despite 19 unit tests of `installSchedulesFromSpecs` passing. The fix requires install-first + orphan-cleanup-after, OR catching the delete upstream in `reloadPlugins`. See commit `51308a56` for the precedent.

Also worth noting: **the `[7044]` diagnostic is not the `[7006]` error.** Panel warnings like "Parameter 't' implicitly has an 'any' type, but a better type may be inferred from usage" are suggestion-severity — `tsc --noEmit` ignores them. Keep writing tests as needed and trust `tsc`.

### The panel-diagnostic flake is unchanged

Every new TS file triggers "Cannot find module" panel errors that clear after `tsc --noEmit` reports clean. This has been true through all 17 commits of this session. Project memory already documents it. Trust `tsc`, not the panel.

### Review lanes are earning their keep

Spec-compliance + code-quality, two passes, per task. In T5 spec reviewer missed a stale comment that quality caught. In T7 quality caught a DRY violation (private `computeNextFire` parallel to exported `computeNextFireTime`) that spec review missed. In T10 quality caught an error-path gap (no try/catch around `await validateScheduleRefs`) plus a log-format inconsistency. Spec review caught the `projectId` categorization error that would have broken T8's invariant test. **Keep running both passes on every task.**

### Subagent model mix

- **Haiku** for mechanical invariant tests (T8, T14): works well when the spec's code block is prescribed verbatim.
- **Sonnet** for everything else: good enough for the async cascade (T10, 14 files) and for state-preservation reasoning (T7, 19 test cases).
- **Opus** not used this session; the tasks didn't require it.

---

## What's next

### Deferred Path A — version bump + npm publish

M1 + M2 are on origin but not released. When the user cuts the next version:

1. `package.json` version `0.13.3` → `0.14.0` OR `0.15.0`. **Recommend `0.15.0`** — skip 0.14.0. Rationale: M1 added the plugin loader (minor bump) and M2 adds a new primitive kind (also minor bump). Both together warrant one minor rather than two releases a week apart. `ideas/self-extending-machine-strategy.md` §9 notes this is a judgment call.
2. Tighten `SUPPORTED_API_VERSIONS` in `src/lib/plugins/registry.ts` — if cutting 0.15.0: `["0.15", "0.14"]` (drop `"0.13"` AND `"0.12"`). If cutting 0.14.0 first: `["0.14", "0.13"]` (drop `"0.12"`). The self-enforcing `api-version-window.test.ts` will catch mistakes.
3. Update the 2026-04-19 `Shipped` entries in `features/changelog.md` to reference the actual published version.
4. `npm pack` → user runs `npm publish ainative-business-<version>.tgz`.
5. Verify `npx ainative-business@<version>` in a clean `~/.ainative-test-<vers>/` — observe finance-pack auto-seed (profiles + blueprints + tables + **schedules**).

**First-time new M2 verification check:** after the npx install, `curl localhost:3000/api/plugins | jq '.plugins[0].schedules'` must return `["plugin:finance-pack:monthly-close"]`. If it returns `[]`, the npx bundle didn't ship the `schedules/` directory — fix `bin/cli.ts` hoisting list.

### M3 groom — Kind 1 TypeScript plugins

Next milestone per `ideas/self-extending-machine-strategy.md` §9 Milestone 3. Not yet groomed. No spec, no plan, no code. Likely shape based on strategy doc:

- Plugin kind `chat-tools` (Kind 1) ships a compiled JS artifact (not YAML) in `<plugin-id>/tools.js` or similar.
- Plugin manifest declares `kind: chat-tools` and lists tool names.
- Loader `require`s the artifact, validates exports match the declared names, registers as chat tools.
- **Security posture per strategy doc §10 + §11**: "we do not sandbox; we document + gate on user click-accept." Reference pattern: Claude Code + Codex CLI's MCP server trust model.

**Before grooming M3:**
- Read strategy doc §9 Milestone 3 for the intended shape.
- Read this session's learnings (clear-before-upsert, the 7044-vs-7006 distinction, smoke-test budget).
- Read `src/lib/chat/tools/plugin-tools.ts` and `src/lib/chat/tools/schedule-spec-tools.ts` for the dynamic-import discipline that M3 will need to exemplify MORE than M2 (Kind 1 IS chat tools).
- Bring `/architect` in early to decide: compiled JS via esbuild/tsx at install time, or ship prebuilt JS that the plugin author produces? The strategy doc defers this; the groom should decide.

**Why M3 is harder than M2:**
- M2 added a new primitive that's still YAML-authored. M3 adds the first primitive that ships executable code.
- Trust/security surface grows meaningfully — this is why strategy §10 says "NOT a marketplace, NOT a PII sanitizer — just click-accept." The groom must keep this discipline.
- `--safe-mode` runtime toggle (deferred decision from M1 + M2 grooms): probably becomes M3's concern. Strategy doc §9 treats it as a CLI flag; the groom should reconcile with the existing UI surface.

---

## M3 grooming prep — suggested first action for next session

If next session wants to ship, not groom: go to Deferred Path A. If next session wants to explore:

1. `/refer chat-tools plugin` — check if there's prior docs captured.
2. Read strategy doc §9 Milestone 3 + §10 + §11.
3. `/product-manager` mode — draft the `features/chat-tools-plugin-kind-1.md` spec.
4. `/architect` mode — TDR-035+ for the compile-vs-prebuilt decision.
5. `/brainstorming` skill with EXPAND mode — capture alternatives for the security model.
6. Only then write the plan via `superpowers:writing-plans`.

Do NOT skip to code. M3 has more unknowns than M1 or M2; groom first.

---

## Don't undo these (regression guards, M1 + M2 + Path C + Post-M2 fix)

### From M1 (still on origin)

- **Dynamic `await import("@/lib/plugins/registry")`** inside `src/lib/chat/tools/plugin-tools.ts` (all three handlers) and inside `src/instrumentation-node.ts`. Static would trigger TDR-032 cycle.
- **`(<plugin-id>)` name suffix in `installPluginTables`** — plugin rows carry the suffix. M2's `installPluginSchedules` inherits this.
- **`lastLoadedPluginIds` tracker** in `src/lib/plugins/registry.ts`. Without it, reloads leak stale rows across the cache-null gap.
- **Boot-order ordering invariants comment** in `src/instrumentation-node.ts`. M2 T15 tightened this to name schedules explicitly — if that block goes missing, plugin-shipped schedules silently don't load before first scheduler tick.
- **The 6-line comment above `import { getProfile }`** in `src/lib/workflows/blueprints/registry.ts` — flags why the static import is safe. `/architect drift detection` will fire on removal.
- **Self-enforcing `api-version-window.test.ts`** — reads `package.json` and asserts current + previous MINOR are in `SUPPORTED_API_VERSIONS`.

### From Path C

- **Single-statement `onConflictDoUpdate` in `installPluginTables`** — `.set()` omits `createdAt` to preserve it. Regression test: `plugin-tables.test.ts` → "reconciles a row pre-inserted by a concurrent writer."

### From M2 (new — all on origin)

- **`scanBundleSection<T>` helper** in `src/lib/plugins/registry.ts` (T2). Three M1 scanners + the new schedules scanner delegate to it. Exception: `scanBundleProfiles` is directory-scoped by design (SKILL.md frontmatter + multi-runtime inference); the comment in registry.ts explains why.
- **`.refine(intervalOrCron)` at union level in `schedule-spec.ts`** — NOT on union members. Member-level refine breaks Zod v4 fast-path dispatch.
- **`.strict()` on both `scheduled` and `heartbeat` schema members** — load-bearing for the heartbeat-only-on-scheduled rejection test.
- **`builtinIdsCache: Set<string>`** in `src/lib/schedules/registry.ts`. Avoids disk re-scan on every `isBuiltinSchedule` call.
- **Dynamic `await import("@/lib/agents/profiles/registry")` inside `validateScheduleRefs`** in `src/lib/schedules/registry.ts`. The NOTE comment in the function body explains why. Static import here would reintroduce TDR-032 risk through installer.ts + schedule-spec-tools.
- **Dynamic `await import("@/lib/schedules/registry")` in all three schedule-spec chat tool handlers** (`src/lib/chat/tools/schedule-spec-tools.ts`). Top-of-file doc comment warns. Smoke is the only detector.
- **Column-coverage invariant test** in `src/lib/schedules/__tests__/installer.test.ts`. Fails if a future migration adds a schedules column that's not in CONFIG_COLUMNS, STATE_COLUMNS, or PRIMARY_KEY. Forces categorization at PR time.
- **`projectId` in STATE_COLUMNS** (not CONFIG) in that invariant test. `projectId` is not on `ScheduleSpec` — it's user-set via UI, so must survive reload. If someone "fixes" this to CONFIG, the installer would need to add `projectId` to `.set()`, which would silently clobber user project associations.
- **`removeOrphanSchedules` helper + install-first pattern in `loadOneBundle`** — state-preservation fix from commit `51308a56`. If someone reverts to `removePluginSchedules` before `installPluginSchedules`, the T18 smoke bug returns. Regression test at `schedule-integration.test.ts` → "preserves runtime state (status, firingCount) across reloadPlugins" guards this.
- **`reloadPlugins` eagerly populates `pluginCache` (NOT lazy-null)** — from T10's async cascade. `listPlugins`/`getPlugin` are sync and read the cache directly. Reverting to lazy-null would break sync readers.

### From earlier sessions (still preserved)

- The npx `.env.local` precedence inversion (0.13.2 — `bin/cli.ts` lines 36–76). Covered by `src/lib/__tests__/cli-env-local.test.ts`.
- The first-run auto-writer in `bin/cli.ts` (0.13.2, same region).
- The `skippedReason: "no_git"` branch in `src/app/api/instance/config/route.ts` (0.13.3).

If any of those tests disappear, flag it immediately.

---

## Open decisions deferred (still — none block M3)

- **TypeScript authoring for Kind 1 plugins** — M3 concern. Strategy §9.
- **Plugin dependency deduplication** (revisit when `~/.ainative/plugins/` aggregate size is a complaint).
- **Plugin discovery in chat command palette** (sixth "Plugins" category vs. interleave into Create + Automate).
- **`--safe-mode` runtime toggle** — M3 CLI flag vs. Settings toggle.
- **PE-portfolio persona** — Phase 2.
- **Table-name collision dedup in `seedTableTemplates()`** — tighten to `id NOT LIKE 'plugin:%'` defensively.
- **True targeted reload performance** — cache `bundleId → rootDir` in `reloadPlugin(id)`.
- **`isBuiltinBlueprint` mirror optimization** — blueprints re-resolve via cached `isBuiltin` boolean; schedules uses a parallel Set. Different patterns; consider unifying.
- **Plan-file distribution** — `.superpowers/plans/*` is gitignored. For long-lived plans, consider check-in under `features/plans/` or equivalent. (Relevant if M3 groom produces a plan.)
- **`reloadSchedules()` not clearing `pluginScheduleIndex`** — same pattern as blueprints. The hazard is real (index orphans across reload) but manifests only in edge cases. If fixed, fix in both registries together, not just schedules.

---

## Environment state at handoff time

- **Branch:** `main`, clean working tree.
- **HEAD:** `90487b95` (M2 verification record).
- **Origin:** up to date.
- **Tests (last full M2-scope run):** 192/192 in 30 files. Plan target was ≥170. tsc clean.
- **Known pre-existing test failure:** `src/lib/validators/__tests__/settings.test.ts` → "rejects missing method field" — confirmed pre-existing at M1 HEAD `39242255` via bisect-style check; NOT an M2 regression. Track separately.
- **`package.json` version:** still `0.13.3`. Deferred Path A.
- **`SUPPORTED_API_VERSIONS`:** `["0.14", "0.13", "0.12"]` — bridge value, tighten at next release.
- **Smoke data dirs:** `~/.ainative-smoke-plugins-m1` (from M1 T18). `~/.ainative-smoke-m2` (from this session's M2 T18 + the critical-bug-fix re-smoke). Safe to keep or `rm -rf` — not needed for any test.
- **Dev server:** not running.
- **Chat-tool count:** 87 (was 84 at M1-shipped, +3 for M2).
- **Builtin counts:** 21 profiles, 13 workflow blueprints, 0 builtin schedules (by M2 design — schedules are domain-specific, shipped via plugins).

---

## Deferred Path A — quick-start script

```bash
# 1. Bump version (recommend 0.15.0, skipping 0.14.0)
npm version 0.15.0 --no-git-tag-version

# 2. Tighten SUPPORTED_API_VERSIONS
# Edit src/lib/plugins/registry.ts line ~46 → Set(["0.15", "0.14"])

# 3. Run the api-version-window invariant test — must stay green
npx vitest run src/lib/plugins/__tests__/api-version-window.test.ts

# 4. Update changelog entries to point at 0.15.0
# Edit features/changelog.md (the two 2026-04-19 Shipped entries)

# 5. Build + pack
npm run build:cli && npm pack

# 6. Publish (user runs this)
npm publish ainative-business-0.15.0.tgz

# 7. Clean-machine smoke
mkdir -p ~/.ainative-test-015 && \
  AINATIVE_DATA_DIR=~/.ainative-test-015 npx ainative-business@0.15.0 > /tmp/npx-015.log 2>&1 &
# Wait for boot, then:
curl -s localhost:3000/api/plugins | jq '.plugins[] | {id, profiles, blueprints, tables, schedules}'
# Expected: finance-pack with 1 profile, 1 blueprint, 1 table, 1 schedule
```

---

## Who to talk to if stuck

- **For architecture** on plugin primitives, Kind 1 design, or future kinds: re-invoke `/architect`. `ideas/self-extending-machine-strategy.md` §5 + TDR-034 are the canonical refs. M3 will need TDR-035+ for the compile-vs-prebuilt decision.
- **For UX** on `/apps`, schedule pickers, install-path surfacing, M3's click-accept flow: re-invoke `/frontend-designer`.
- **For scope / priority / sequencing**: re-invoke `/product-manager` with explicit reference to strategy doc §9 (roadmap) and §10 (non-goals). Use Ship Verification mode to audit a shipped milestone before marking `completed`.
- **For security** on Kind 1 (M3): Claude Code + Codex CLI's MCP server trust model is the reference pattern. We do not sandbox; we document + gate on user click-accept.
- **For the T18 state-preservation regression**: commit `51308a56` is the fix of record. The two-layer bug (loadOneBundle + reloadPlugins) is the precedent — grep for `removePluginX` calls that happen before `installPluginX` with `onConflictDoUpdate` when auditing.

---

*End of handoff. M1 and M2 are shipped + on origin. finance-pack composition loop is complete (profile + blueprint + table + schedule). The strategy is intact; the rollback discipline holds; the post-upsert-clear-defeats-state-preservation lesson is codified here and ready to be lifted into CLAUDE.md / MEMORY.md on next session's first conversational touch.*
