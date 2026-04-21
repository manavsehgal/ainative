# Handoff: TDR-037 Phase 4 shipped — M3 (Self-Extending Machine, Milestone 3) is DONE; next session picks Phase 5/Phase 6 or M4 (`nl-to-composition-v1`)

**Created:** 2026-04-20 (Phase 4 of the scope-revision plan shipped in one session — pre-fix + 3 live smokes + 3 doc flips committed together; TDR-037 promoted from `proposed` to `accepted`; `features/chat-tools-plugin-kind-1.md` flipped from `planned` to `shipped`; `features/changelog.md` got a dated `## 2026-04-20` entry; `ainative-app` skill SKILL.md updated to scaffold manifests to the canonical `~/.ainative/apps/` path. Working tree should be clean after the commit.)
**Supersedes scope of:** `handoff/2026-04-20-tdr-037-phase-2-3-shipped-handoff.md` §"What's next — Phase 4" — that section is now shipped; this handoff updates only *what's new*, *what's next* (Phase 5 / Phase 6 / M4), and *what not to undo*.
**Author:** Manav Sehgal (with Claude Opus 4.7 assist)

Headline: **TDR-037 is `accepted` and Milestone 3 is DONE.** Phase 4's three live smokes (T19 echo-server self-extension classifier + MCP registration, T20 `AINATIVE_PLUGIN_CONFINEMENT=1` seatbelt wrap activation, T21 `--safe-mode` + `plugin-trust-model = strict|off` Settings overrides) all passed against a real `npm run dev` runtime with an isolated `AINATIVE_DATA_DIR=~/.ainative-smoke-m3` data dir. The two-path trust model is now the authoritative posture; strategy §15 Amendment becomes the load-bearing reference for any future plugin-trust work. The `ainative-app` skill manifest-location gap (handoff Phase 2+3 §"Risks and watches" path #1) was fixed in the same session as part of the pre-task — apps composed via the skill now scaffold to `~/.ainative/apps/<app-id>/manifest.yaml`, which the `src/lib/apps/registry.ts` scan actually reads. **Next session has three meaningful choices:** Phase 6 (`create_plugin_spec` + `ainative-app` skill fall-through + ExtensionFallbackCard), Phase 5 (`/plugins` page placeholder, deferred until ≥1 third-party plugin actually exists), or jump to M4 (`nl-to-composition-v1`) on top of the now-stable self-extension foundation.

---

## Read these first, in order

1. **This handoff** — you're here.
2. **`handoff/2026-04-20-tdr-037-phase-2-3-shipped-handoff.md`** — Phase 2+3 ship spec; the AppMaterializedCard + dynamic sidebar + `/apps` surface + 3 starter templates. Phase 4 is the live-smoke gate that promotes TDR-037 to `accepted`.
3. **`handoff/2026-04-20-tdr-037-phase-1-shipped-handoff.md`** — sets the two-path-model context, classifier rationale, feature-flag gates. Phase 4 verifies all of this against the live runtime.
4. **`.claude/skills/architect/references/tdr-037-two-path-plugin-trust-model.md`** — TDR-037 (status now `accepted`). Re-entering the marketplace / trust-tier lane (strategy §10 refused) requires a successor TDR explicitly superseding this one.
5. **`features/chat-tools-plugin-kind-1.md`** — feature spec (status now `shipped`). The post-frontmatter callout notes the Phase 4 verification trace.
6. **`features/changelog.md` §`## 2026-04-20`** — dated changelog entry capturing each smoke's evidence. Read here for the per-smoke acceptance trace without re-running.
7. **CLAUDE.md runtime-registry smoke rule** — still binding. Phase 4 satisfied the obligation for M3; M4 (`nl-to-composition-v1`) and any future runtime-registry-adjacent work re-incurs it.

---

## What shipped this session (Phase 4)

### Single commit on `main`

```
<HASH>  feat(plugins): TDR-037 Phase 4 — live smokes pass; M3 ships,
        TDR-037 accepted, ainative-app skill canonical path fix
```

(Hash filled at commit time; this handoff written before the commit so the smokes' evidence is captured atomically with the doc flips.)

**HEAD:** `<HASH>` after commit. **`origin/main`:** awaiting user-initiated push (CLAUDE.md risky-action discipline). Working tree clean after commit.

### Pre-task: `ainative-app` skill manifest-location fix

**Modified:**
- `.claude/skills/ainative-app/SKILL.md` — Phase 3 "Emit Artifacts" section now instructs the skill to scaffold `manifest.yaml`, `seed/<table>.csv`, and `README.md` to `~/.ainative/apps/<app-id>/...` (canonical per `getAinativeAppsDir()` in `src/lib/utils/ainative-paths.ts:52` and the registry scan in `src/lib/apps/registry.ts`). Worked example for `wealth-tracker` updated to match. The "do NOT" warning at the new manifest-location callout explicitly forbids writing to `.claude/apps/<app-id>/` because the registry never sees that path.

**Why this was the right pre-task:** without it, an app composed by the `ainative-app` skill today would emit a manifest the user can read but the `/apps` registry would never surface, breaking Phase 2's dynamic-sidebar promise. Path #1 from the Phase 2+3 handoff §"Risks and watches" was the explicit recommendation; this 6-line edit unblocks the skill's end-to-end demo path.

### T19 — echo-server self-extension classifier + MCP registration (priority)

**Setup:**
- Fresh `~/.ainative-smoke-m3/` smoke data dir (cleaned up at session end).
- Copied `src/lib/plugins/examples/echo-server/{plugin.yaml,.mcp.json,server.py,README.md}` to `~/.ainative-smoke-m3/plugins/echo-server/`. **Gotcha caught:** `cp -r src/.../* dest/` skips the dotfile `.mcp.json`. The mcp-loader correctly surfaced this with `disabledReason: "mcp_parse_error"` (every-error-has-a-name: ✅). Re-copied explicitly with `cp .../.mcp.json` and re-ran.

**Live runtime:** `AINATIVE_DATA_DIR=~/.ainative-smoke-m3 npm run dev` started in 214ms (Turbopack, no module-load cycle).

**Verification commands and outputs:**

```
# 1. dev log grep for module-load cycle errors
$ grep -E "ReferenceError|Cannot access|claudeRuntimeAdapter" /tmp/ainative-smoke-m3-dev.log
(zero matches — exit 1)

# 2. /api/plugins → shows echo-server registered as loaded
$ curl -s http://localhost:3000/api/plugins | python3 -m json.tool
{ "plugins": [ { "id": "echo-server", "manifest": {…}, "rootDir": "…/echo-server",
                  "status": "loaded" } ] }

# 3. plugins.lock NOT created
$ ls -la ~/.ainative-smoke-m3/plugins.lock
ls: …: No such file or directory

# 4. Direct loadPluginMcpServers smoke (the path that actually exercises
#    isCapabilityAccepted with manifest + rootDir) — proves status is accepted
$ AINATIVE_DATA_DIR=~/.ainative-smoke-m3 npx tsx /tmp/t19-mcp-loader-smoke.mjs
{ "registrations": [ { "pluginId": "echo-server", "serverName": "echo-server",
                       "transport": "stdio", "status": "accepted" } ],
  "totalRegistrations": 1 }
```

**Acceptance:** all three T19 bullets passed. The status `"accepted"` (not `"pending_capability_accept"`) is the smoking gun — it proves the live MCP loader called `isCapabilityAccepted(pluginId, hash, { manifest, rootDir, trustModelSetting })`, the classifier returned `'self'`, and the function fast-pathed without touching `~/.ainative-smoke-m3/plugins.lock`. Without Phase 1's bypass, the same plugin would return `"pending_capability_accept"` because no lockfile entry exists.

### T20 — `AINATIVE_PLUGIN_CONFINEMENT=1` seatbelt wrap activation

**Setup:** edited `~/.ainative-smoke-m3/plugins/echo-server/plugin.yaml` to add `confinementMode: seatbelt` (smoke fixture only — source unchanged).

**Verification:**

```
# Flag OFF (default) — direct spawn, parked
$ AINATIVE_DATA_DIR=… npx tsx /tmp/t20-confinement-smoke.mjs
AINATIVE_PLUGIN_CONFINEMENT = undefined
{ "ok": true, "wrapped": { "command": "python3", "args": ["…/server.py"], … },
  "describe": "confinement parked (AINATIVE_PLUGIN_CONFINEMENT not set) — direct spawn …" }

# Flag ON — sandbox-exec wrap activates
$ AINATIVE_DATA_DIR=… AINATIVE_PLUGIN_CONFINEMENT=1 npx tsx /tmp/t20-confinement-smoke.mjs
AINATIVE_PLUGIN_CONFINEMENT = "1"
{ "ok": true,
  "wrapped": { "command": "sandbox-exec",
               "args": ["-p", "(version 1)\n(deny default)\n(allow process-fork)\n(allow signal (target self))\n",
                        "python3", "…/server.py"], … },
  "describe": "confinementMode: seatbelt (darwin) — sandbox-exec -p <policy, 0 capability profile(s): none> python3 …" }
```

**Acceptance:** `wrapStdioSpawn(...)` correctly produces `command: "python3"` (parked) when the flag is unset and `command: "sandbox-exec"` (wrapped) when the flag is `"1"`. Echo-server's `capabilities: []` produces a minimal `(deny default) + (allow process-fork) + (allow signal target self)` policy — proves the wrap mechanism is functional even with zero capability profiles, validating the parked-by-default design (real policy corpus is M3.5 commitment, NOT scope of TDR-037 acceptance).

### T21 — `--safe-mode` + `plugin-trust-model` Settings overrides

**Setup:** restored echo-server's smoke `plugin.yaml` to source state (no `confinementMode`).

**Verification (three sub-cases):**

```
# T21(a) — AINATIVE_SAFE_MODE=true → disabled+safe_mode
$ AINATIVE_DATA_DIR=… AINATIVE_SAFE_MODE=true npx tsx /tmp/t21-trust-model-smoke.mjs
AINATIVE_SAFE_MODE = "true"
{ "registrations": [ { "pluginId": "echo-server", "serverName": "",
                       "status": "disabled", "disabledReason": "safe_mode" } ],
  "totalRegistrations": 1, "plugins_lock_exists": false }

# T21(b) — plugin-trust-model = strict → forces lockfile path
$ AINATIVE_DATA_DIR=… npx tsx /tmp/t21-trust-model-smoke.mjs set-strict
set plugin-trust-model = strict
$ AINATIVE_DATA_DIR=… npx tsx /tmp/t21-trust-model-smoke.mjs
AINATIVE_SAFE_MODE = undefined
{ "registrations": [ { "pluginId": "echo-server", "serverName": "echo-server",
                       "status": "pending_capability_accept",
                       "disabledReason": "capability_not_accepted" } ],
  "totalRegistrations": 1, "plugins_lock_exists": false }

# T21(c) — plugin-trust-model = off → accepts without lockfile
$ AINATIVE_DATA_DIR=… npx tsx /tmp/t21-trust-model-smoke.mjs set-off
set plugin-trust-model = off
$ AINATIVE_DATA_DIR=… npx tsx /tmp/t21-trust-model-smoke.mjs
{ "registrations": [ { "pluginId": "echo-server", "serverName": "echo-server",
                       "status": "accepted" } ],
  "totalRegistrations": 1, "plugins_lock_exists": false }

# Reset to default 'auto' (clean session-end state)
$ AINATIVE_DATA_DIR=… npx tsx /tmp/t21-trust-model-smoke.mjs set-auto
set plugin-trust-model = auto
```

**Acceptance:**
- (a) `AINATIVE_SAFE_MODE=true` produces `disabled+safe_mode` registration regardless of trust classification — orthogonal kill switch works as advertised. Mirrors Claude Code `--no-plugins` semantics.
- (b) `plugin-trust-model="strict"` correctly overrides the classifier and forces the lockfile path. Registration is `pending_capability_accept` even though echo-server hits two self-extension signals (`author: ainative`, `capabilities: []`). The user's "training wheels" escape hatch works.
- (c) `plugin-trust-model="off"` accepts everything without lockfile consultation. Matches Claude Code / Codex CLI "trust your own code" posture exactly.

The three settings are non-redundant — collapsing to a boolean would lose user autonomy.

### Doc flips

**TDR-037:** `.claude/skills/architect/references/tdr-037-two-path-plugin-trust-model.md` status `proposed` → `accepted`; added `accepted-date: 2026-04-20` and a status callout at the top with a pointer to this handoff for the verification trace.

**Feature spec:** `features/chat-tools-plugin-kind-1.md` status `planned` → `shipped`; added `shipped-date: 2026-04-20` and a status callout at the top of the spec.

**Changelog:** `features/changelog.md` got a dated `## 2026-04-20` H2 above the existing `## 2026-04-19` entry, with two H3 sections — "Shipped — chat-tools-plugin-kind-1 (Milestone 3, two-path trust model)" capturing the per-smoke evidence in narrative form, and "Accepted — TDR-037 (two-path plugin trust model)" capturing the TDR promotion.

### Test results

- **No new tests added this session.** Phase 4 is verification, not new code. All Phase 1+2+3 tests remain green per their handoffs (269 plugin-adjacent + 60 Phase 2+3 + 499 chat/plugins/components regression). The single test re-run in this session was `src/lib/plugins/__tests__/classify-trust.test.ts` (19/19 green) as a sanity check before the live smokes.
- **Typecheck:** not re-run this session (no production code touched outside SKILL.md doc edits, which TypeScript doesn't compile).

---

## Uncommitted state at handoff

**Working tree should be CLEAN after the commit.** Nothing pending locally.

**Not pushed** — CLAUDE.md risky-action discipline: pushing waits for explicit user approval. Run `git push origin main` when ready.

**Not committed** (intentional):
- `/Users/manavsehgal/.claude/plans/time-to-consult-the-clever-rose.md` — plan lives outside the repo.
- `/tmp/t19-mcp-loader-smoke.mjs`, `/tmp/t20-confinement-smoke.mjs`, `/tmp/t21-trust-model-smoke.mjs` — smoke scripts; throw-away. Captured in this handoff for next-session re-runnability.
- `/tmp/ainative-smoke-m3-dev.log` — dev log from the smoke run; throw-away.

---

## What's next — three meaningful choices

### Option A (recommended): Phase 6 — `create_plugin_spec` + `ainative-app` fall-through + ExtensionFallbackCard

**Why this is the highest-leverage next step:** Phases 2+3 made the *composition* case visible (`AppMaterializedCard` for self-extension that's already happening today via chat tools); Phase 6 closes the "what if composition isn't enough" loop by giving `ainative-app` a fall-through path that scaffolds a Kind 1 MCP plugin with `author: ainative` + `origin: ainative-internal` so the Phase 1 classifier routes it straight to self-extension on first reload. This is the plan's §Phase 6 spec — single continuous chat session from "I want X" to "X is running, no ceremony."

**Scope:**
- New chat tool `create_plugin_spec` — scaffolds `plugin.yaml` (with `author: ainative` + `origin: ainative-internal`) + `.mcp.json` + `server.py` (or `server.js`) + `README.md` to `~/.ainative/plugins/<slug>/`. Single tool stub wired end-to-end; user fills in business logic, not plumbing.
- `ainative-app` skill extension — Phase 2 of the skill falls through to `create_plugin_spec` when composition cannot express the user's need. One continuous chat session.
- `ExtensionFallbackCard` — two paths, NOT three (per frontend-designer §3): "Compose-only alternative" primary, "Scaffold a plugin" secondary. Calm Ops opaque surface.

**Open question for Phase 6 implementer:** the `create_plugin_spec` chat tool can either ship with stubbed Python OR stubbed Node servers. Pick one for v1; the other can land in Phase 6.5 once the first sees real use.

### Option B: Phase 5 — `/plugins` page placeholder

**Why this is lower-leverage TODAY:** the plan explicitly says do NOT pre-build until ≥1 third-party plugin actually exists. Echo-server is the only Kind 1 plugin in the repo, and it's `author: ainative` (self-extension). The page would show a single-row table of `mcp__echo-server__echo` with a "trust path: self" badge — not a meaningful UX. Defer until a real third-party plugin lands.

**When to revisit:** the moment the first external Kind 1 plugin appears (`author` is neither `"ainative"` nor `os.userInfo().username`). The §11 Risk D leading indicator. The page's full M3 machinery surface — per-tool toggles, confinement selector, hash diff, revoke button, lockfile status — only matters when there's something to gate.

### Option C: skip ahead to M4 — `nl-to-composition-v1`

**Why this is also defensible:** TDR-037 is `accepted`, the self-extension surface is visible (Phase 2+3), and Phase 6 is incremental on the same trust foundation. M4 is the *next* milestone in the Self-Extending Machine strategy — it takes natural-language descriptions ("build me a weekly portfolio check-in") and emits the composition tool calls (`create_profile`, `create_blueprint`, `create_schedule`, `create_table`) that fire the Phase 2 `AppMaterializedCard` automatically. The work depth is meaningfully higher than Phase 6, but the user-facing impact is also bigger ("I described what I want, ainative built it" without me invoking the `ainative-app` skill explicitly).

**Recommendation:** **Option A (Phase 6) first.** It's the smaller scope, it directly extends the Phase 4-shipped trust model (every plugin scaffolded by `create_plugin_spec` lands on the self-extension path because of `origin: ainative-internal`), and it closes a real gap the strategy already named. M4 becomes more compelling once Phase 6 proves the "composition + plugin scaffold" combined surface works in one chat session. Phase 5 is genuinely deferred, not skipped — the plan is right that it's not worth building until demand surfaces.

---

## Regression guards — don't undo these

### From this session (Phase 4)

**TDR-037 status flipped to `accepted` is load-bearing for the strategy.** The `accepted` status is the gate that promotes strategy §15 Amendment 2026-04-20 to authoritative. A future contributor "re-opening" TDR-037 to `proposed` to revisit a decision must write a *successor* TDR (TDR-038+) that explicitly supersedes it; do not flip TDR-037's status field back without that successor in place. The `accepted-date` field is also load-bearing — it's how the architect skill's drift detection knows when the decision was finalized.

**`features/chat-tools-plugin-kind-1.md` status flipped to `shipped` is the Milestone 3 final gate.** Code that's "shipped" + "TDR `accepted`" + dated changelog entry is the canonical 3-of-3 signal that an M-milestone is closed. Future contributors checking "is M3 done?" should look at this trio, not at branch state or open PRs. A future "actually we found a bug, set it back to in-progress" should write a new dated changelog entry ("Re-opened — chat-tools-plugin-kind-1 due to X"); don't silently flip the frontmatter back.

**`ainative-app` skill SKILL.md MUST scaffold to `~/.ainative/apps/<app-id>/`.** A future "consolidation" that moves the manifest back to `.claude/apps/<app-id>/` will silently break `/apps` and the `AppMaterializedCard` sidebar entry — the registry scans `getAinativeAppsDir()` only. The skill's manifest-location fix in this session is what makes the Phase 2+3 demo path end-to-end functional. The "do NOT write to `.claude/apps/<app-id>/`" warning at the new emit-artifacts callout is the in-skill regression guard; preserve it.

**The smoke-test fixture pattern (`AINATIVE_DATA_DIR=~/.ainative-smoke-m3/` + dotfile-aware copy) is reusable for future milestones.** Future runtime-registry-adjacent work (per CLAUDE.md smoke-test budget rule) should copy this exact pattern: fresh data dir per session, explicit dotfile copy (`cp .../.mcp.json` separately from `cp -r .../* `), grep for `ReferenceError` / `Cannot access` / `claudeRuntimeAdapter` in dev logs. The smoke scripts at `/tmp/t1[9-21]-*.mjs` are throw-away, but the pattern should be re-used.

### From prior sessions (still binding)

All Phase 1, Phase 2+3 regression guards remain authoritative. See `handoff/2026-04-20-tdr-037-phase-2-3-shipped-handoff.md` and `handoff/2026-04-20-tdr-037-phase-1-shipped-handoff.md` "Regression guards" sections. Critical callouts that intersect with Phase 4:

- **Self-extension bypass bypasses the lockfile ENTIRELY.** Phase 4 T19 specifically smoked this: `plugins.lock` does NOT exist after a successful `loadPluginMcpServers()` call against an `author: ainative` bundle. A regression that re-introduces a lockfile read in the self-extension path would surface as `plugins.lock` getting written on first scan even with no capability-accept event. Watch for it.
- **`trustPath` field is ONLY on the self-extension return.** Third-party / lockfile returns omit it. Tests using strict `toEqual` depend on this asymmetry.
- **Feature flags default OFF.** `AINATIVE_PER_TOOL_APPROVAL` and `AINATIVE_PLUGIN_CONFINEMENT` MUST stay unset by default. Phase 4 T20 explicitly verifies the parked-by-default behavior of `AINATIVE_PLUGIN_CONFINEMENT`.
- **Settings toggle has THREE values.** `auto | strict | off`. Phase 4 T21 smoked all three lanes (`auto` default exercised in T19; `strict` and `off` in T21(b)+(c)). Collapsing to a boolean would lose the `strict` lane (training wheels over user's own code) AND the `off` lane (CLI-grade trust freedom) — they're semantically distinct.

---

## Risks and watches for next session

### Phase 6 must respect the `origin: ainative-internal` contract

When `create_plugin_spec` scaffolds a plugin under `~/.ainative/plugins/<slug>/`, the `plugin.yaml` MUST include both `author: ainative` AND `origin: ainative-internal` so the Phase 1 classifier returns `'self'` deterministically. Either signal alone would route to self-extension (any one signal suffices), but BOTH fields make the intent explicit and survive future contributors who refactor either signal independently. Treat them as belt-and-suspenders.

### `~/.ainative/plugins/` vs `~/.ainative/apps/` distinction matters

Composition bundles live at `~/.ainative/apps/<app-id>/manifest.yaml` (canonical per the SKILL.md fix this session). Kind 1 plugins live at `~/.ainative/plugins/<slug>/{plugin.yaml,.mcp.json,server.*}`. Phase 6's `create_plugin_spec` scaffolds to the *plugins* dir (executable surface, even if self-extension). Don't conflate the two — the `ainative-app` skill's Phase 4 fall-through to `create_plugin_spec` should write the plugin to `~/.ainative/plugins/<slug>/` AND optionally also write a thin `~/.ainative/apps/<app-id>/manifest.yaml` that references the plugin (so `/apps` surfaces the composed app, not just the bare plugin). Two file targets, one fallthrough.

### Dotfile copy gotcha is a real fragility

The T19 smoke caught this — `cp -r src/.../* dest/` skips dotfiles in zsh/bash. Future smoke fixtures with `.mcp.json`, `.env`, `.gitignore`, etc. need explicit dotfile copies. Consider documenting this in the future smoke-test pattern. The mcp-loader handled it gracefully (returned `disabledReason: "mcp_parse_error"` instead of crashing — the "every error has a name" CLAUDE.md principle in action).

### Phantom LSP warnings — still flaky, ignore them

Per MEMORY.md: "The TS diagnostic panel is consistently flaky." Phase 4 saw plenty of phantom `toBeInTheDocument` / `Cannot find module` warnings during the smoke run — all known noise from the diagnostic system, not real errors. Trust `npx tsc --noEmit` over the panel. The smokes' `npx tsx` import success is also direct evidence the modules resolve correctly at runtime.

### Strategy §15 Amendment becomes authoritative — reread before any plugin-trust work

Now that TDR-037 is `accepted`, strategy §15 Amendment 2026-04-20 (lives in `ideas/self-extending-machine-strategy.md` — gitignored, but mirrored in TDR-037) is the load-bearing reference. Any future "should we add X to plugin trust?" question must first check whether §15 covers it (typically: parked behind flag OR scheduled for removal OR explicitly out of scope). Don't add new trust machinery without writing a successor TDR explaining what changed about the strategy.

### `features/chat-tools-plugin-kind-1.md` status callout will be tempting to "clean up"

Future contributors might see the post-frontmatter `> **Status: shipped (2026-04-20).**` callout and think it's redundant with the `status: shipped` frontmatter field. It's not — the callout is the "where to find the verification trace" pointer, and it survives `grep -l shipped features/` queries that ignore frontmatter. Preserve it for at least one M-milestone after M3 (until M4 ships and writes its own equivalent callout).

---

## Open decisions deferred to Phase 6+ / M4

- **`create_plugin_spec` server template default** — Python or Node? Phase 6 picks one for v1. Python is closer to the echo-server reference; Node has tighter integration with the Anthropic SDK ecosystem. Deferred to implementer's call.
- **`/apps/[id]` Code tab when `AINATIVE_DEV_MODE=1`** — still deferred per Phase 2+3 handoff. Scope-revision parks it with Phase 5; Phase 6 may revisit if the plugin scaffold needs a "view source" affordance on the detail page.
- **Sidebar dynamic-entry pinning** — frontend-designer §6 said "pin to sidebar after N uses." N still not picked. Trivial to adjust later when usage telemetry surfaces a sensible threshold.
- **Polling vs. SSE for `useApps`** — current `useApps(5000)` polling + `ainative-apps-changed` CustomEvent is MVP-adequate. Promote to SSE only if real users complain.
- **Wealth-manager / book-reader as `/apps` virtual entries** — deferred from Phase 3. The skill-manifest-location fix this session unblocks the path; could land as a Phase 6 side-project (write `~/.ainative/apps/wealth-manager/manifest.yaml` + `.../book-reader/manifest.yaml` virtual manifests so the dogfoods surface in `/apps`).

---

## Environment state at handoff time

- **Branch:** `main`, working tree clean after commit. **`origin/main`:** awaiting user-initiated push.
- **HEAD:** `<HASH>` (Phase 4 — fill at commit time).
- **Tests (no new ones this session):** classify-trust.test.ts re-run as sanity check, 19/19 green. All prior Phase 1+2+3 tests remain green per their handoffs. Full suite not re-run this session (no production code changed; SKILL.md + TDR + feature spec + changelog are doc-only edits).
- **`npx tsc --noEmit`:** not re-run this session (no TS code changed).
- **`package.json` version:** still `0.13.3`. npm publish deferred until post-M5 per original 2026-04-19 Amendment (unchanged).
- **`SUPPORTED_API_VERSIONS`:** `["0.14", "0.13", "0.12"]` (unchanged).
- **Dev server:** not running (killed at session end).
- **Smoke data dirs:** none — `~/.ainative-smoke-m3` cleaned up at session end.
- **Smoke scripts:** `/tmp/t19-mcp-loader-smoke.mjs`, `/tmp/t20-confinement-smoke.mjs`, `/tmp/t21-trust-model-smoke.mjs` left in `/tmp` (throw-away). Captured in this handoff for re-runnability.
- **Chat-tool count:** 91 (Phase 4 added zero chat tools).
- **TDR count:** 37 with TDR-037 now `accepted` (was `proposed`).
- **Feature flags documented (both default OFF, unchanged):**
  - `AINATIVE_PER_TOOL_APPROVAL=1` — activates Layer 1.8 per-tool approval resolver
  - `AINATIVE_PLUGIN_CONFINEMENT=1` — activates seatbelt/apparmor/docker wrap + Docker boot sweep
- **Settings key documented (unchanged):** `plugin-trust-model` (`auto` default, `strict`, `off`).

### New artifacts this session (all committed in single commit)

- `.claude/skills/ainative-app/SKILL.md` (modified — manifest location fix)
- `.claude/skills/architect/references/tdr-037-two-path-plugin-trust-model.md` (modified — status flip + accepted-date + callout)
- `features/chat-tools-plugin-kind-1.md` (modified — status flip + shipped-date + callout)
- `features/changelog.md` (modified — new `## 2026-04-20` H2 with two H3 entries)
- `handoff/2026-04-20-tdr-037-phase-4-shipped-handoff.md` (new — this handoff)

### New artifacts NOT committed (intentional)

None directly. The smoke scripts and dev logs are in `/tmp` and are intentionally throwaway. The strategy doc amendment lives in gitignored `ideas/` per prior handoffs.

---

## Session meta — canonical sources

This handoff focuses on **Phase 4 shipped → M3 done → Phase 5/6 or M4 transition**. Don't re-read Phase 4 internals here; read the source:

- **TDR-037 status + content** → `.claude/skills/architect/references/tdr-037-two-path-plugin-trust-model.md` (committed)
- **Feature spec status + content** → `features/chat-tools-plugin-kind-1.md` (committed)
- **Per-smoke evidence in narrative form** → `features/changelog.md` `## 2026-04-20` (committed)
- **`ainative-app` skill manifest path** → `.claude/skills/ainative-app/SKILL.md` Phase 3 "Emit Artifacts" + Manifest Schema sections (modified, committed)
- **Phase 6 spec** → `/Users/manavsehgal/.claude/plans/time-to-consult-the-clever-rose.md` §Phase 6 (plan outside repo)
- **M4 spec** → `ideas/self-extending-machine-strategy.md` §9 Milestone 4 (gitignored locally)
- **Commit** → `git show <HASH>` (after commit)

If in doubt, read the source. This handoff is the routing table, not the authority.

---

*End of handoff. Phase 4 shipped as one commit (5 files, doc-only changes — pre-task SKILL.md fix + TDR + spec status flips + changelog entry + this handoff). Three live smokes (T19 echo-server self-extension, T20 confinement flag, T21 safe-mode + Settings toggles) all passed against `npm run dev` with isolated `AINATIVE_DATA_DIR=~/.ainative-smoke-m3`. TDR-037 promoted from `proposed` to `accepted`; `features/chat-tools-plugin-kind-1.md` flipped from `planned` to `shipped`. M3 (Self-Extending Machine, Milestone 3) is DONE. Recommended next session: Phase 6 (`create_plugin_spec` + `ainative-app` skill fall-through + ExtensionFallbackCard), the smaller scope that directly extends Phase 4's trust foundation. Phase 5 (`/plugins` page) genuinely deferred until a real third-party plugin appears. M4 (`nl-to-composition-v1`) is the bigger next milestone, equally defensible to start now.*
