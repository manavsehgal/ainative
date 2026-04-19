# Handoff: Self-Extending Machine Strategy → Milestone 1 Implementation

**Date:** 2026-04-18
**Author:** Manav Sehgal (with Claude Opus 4.7 assist)
**Session context:** Post-0.13.3 strategic reset. Brainstormed extension model across npx + git-clone install paths with architect + frontend-designer + product-manager perspectives, authored a living strategy doc, then groomed Milestone 1 into a ready-to-implement feature spec.

This handoff is the resume point for the next session. Read it top-to-bottom before doing anything else.

---

## Read these first, in order

1. **This handoff** — you're here.
2. **`ideas/self-extending-machine-strategy.md`** — the living strategy doc. **Authoritative for decisions D1–D6**. Sections to know: §4 (composition ladder), §5 (plugin primitive spec), §9 (5-milestone roadmap), §10 (non-goals — the post-rollback discipline), §11 (risks + off-ramps).
3. **`features/primitive-bundle-plugin-kind-5.md`** — Milestone 1 feature spec. Self-contained; does not require reading the strategy doc or this handoff to implement. 307 lines, 15 acceptance criteria, 3 smoke tests, 3 unit test files specified.
4. **`features/roadmap.md`** → "Self-Extension Platform" section (near line 428) — the 5-milestone roadmap entries.
5. **`features/changelog.md`** top entry (2026-04-18, *Groomed — primitive-bundle-plugin-kind-5 + Self-Extension Platform roadmap section*) — what just happened, named non-goals, link back to strategy doc.

---

## What shipped in the previous session (do not re-investigate)

### Released to origin/main

- **0.13.2** (`chore(release): 0.13.2 …`) — `.env.local` wins over shell env in `bin/cli.ts` + first-run auto-writer creates `.env.local` with isolated `AINATIVE_DATA_DIR` on first `npx ainative-business` run in a non-dev folder. Tarball: `ainative-business-0.13.2.tgz`. Fixes the npx "Fix" button not persisting.
- **0.13.3** (`fix(instance): npx installs show accurate notice …`) — Settings → Instance no longer shows false "setup incomplete" warning on npx installs. New `skippedReason: "no_git"` surface on `GET /api/instance/config`. Tarball: `ainative-business-0.13.3.tgz`. Commit `8485017a`.

### Strategic artifacts created

- **`ideas/self-extending-machine-strategy.md`** — 698 lines / 14 sections. Locks six decisions:
  - **D1** — Plugin scope v1: Kind 5 (primitives bundles) + Kind 1 (chat tools) only. Defer Kind 2/3/4 indefinitely.
  - **D2** — Code-write UX on npx: hard refuse + redirect to plugin folder. Never orphan writes to `launchCwd/src/`.
  - **D3** — Authoring: agent writes JS directly, no bundler, no TS toolchain. `fs.rename` atomic writes. `reload_plugin` chat tool busts `require.cache`.
  - **D4** — Positioning: public = *"Describe your business. Ainative builds it, runs it, and grows with it."* Internal north star = *"machine that builds machines"* (unclaimed in AI-native-business space).
  - **D5** — `/apps` surface: authoring + local gallery only. No publish, no trust tiers, no marketplace. Copy-paste directory is the sharing model.
  - **D6** — Install-path parity: `AINATIVE_DEV_MODE` is a surfacing flag, never a feature gate.
- **`features/primitive-bundle-plugin-kind-5.md`** — Milestone 1 feature spec. Status: planned. Priority: P0. Milestone: post-mvp.
- **Roadmap section** *Self-Extension Platform* with 5 pre-declared milestone entries.
- **Plan file** at `~/.claude/plans/when-running-from-npx-validated-kahan.md` — approved; captures the plan that produced the strategy doc.

### Experts consulted (transcripts not saved; synthesized into strategy doc)

- `/architect` — proposed 5 plugin kinds initially; deep-dive narrowed v1 to Kind 5 + Kind 1. Reasoning: Kind 3 (workflow pattern helpers) requires a 1–2 week refactor of `src/lib/workflows/engine.ts` (49KB) to expose middleware; Kind 4 (profile runtimes) has no extractable `RuntimeAdapter` interface; Kind 2 (processors) has tiny demand. Kind 5 is nearly free — extends existing directory-scanning loaders.
- `/frontend-designer` — `/apps` as left-nav surface between Workflows and Schedules. Three starter templates in empty state (Daily inbox triage / Weekly ops digest / Portfolio check-in). ExtensionFallbackCard for "I want code" moments, three paths (Compose instead / Save as plugin spec / Unlock via clone). Never claim "Done" when nothing ran.
- `/product-manager` — ship composition first, plugin escape hatch second. Keep the book as north-star anchor; let product earn "machine that builds machines" through primitives. Cut marketplace / publish lane entirely (rolled back 6 days before this session; do not re-enter).

### Architect's final recommendation on authoring

After the user prioritized **app performance > security > speed-to-hot-reload** (DX explicitly deprioritized), architect confirmed **Option A (agent writes JS directly)**. Reload via:

```js
delete require.cache[require.resolve(abs)];
const mod = require(abs);
registry.set(id, mod.default ?? mod);
```

Security posture is **trusted-by-user, documented** (same model as Claude Code / Codex CLI MCP servers — no sandbox claim). Mitigations: manifest capability declaration + click-accept, manifest hash pinned in `plugins.lock`, `--safe-mode` CLI flag. These apply to Kind 1 (Milestone 3); **Kind 5 has no executable JS, so capability declaration + safe-mode don't apply in Milestone 1**.

---

## The post-rollback scar tissue (critical context)

**2026-04-12: 21 commits were rolled back.** Custom App Creation + Marketplace + Trust Ladder + Publish-to-Supabase + PII Sanitizer + App-Extended-Primitives-Tier2 + App-Forking-Remix + Seed-Data-Generation + Embeddable-Install-Widget. See `ideas/rollback-app-marketplace-features.md`.

The rollback preserved composition primitives (`delete-project.ts`, workspace fixes, chat fixes, task planning timestamps). The scar is on **distribution**, not **composition**.

The strategy doc and Milestone 1 spec **deliberately do not re-enter** the rolled-back territory. When a future session is tempted to add any of the following, `ideas/self-extending-machine-strategy.md` §10 is the "we decided against this" reference:

- publishing / marketplace rails
- trust tiers
- PII sanitization pipeline
- Kind 2/3/4 plugins (processors, pattern helpers, runtimes)
- new UI routes via plugin
- new DB columns via plugin
- orphan writes to `launchCwd` on npx
- feature gating by install method

If future demand overrides any non-goal, update the strategy doc first, document the reversal with a date, then groom a spec. Do not add features that contradict the strategy doc without updating it.

---

## What the next session should do

Pick **one** of these paths. Do not interleave.

### Path A — Implement Milestone 1 (recommended if sprint focus is shipping)

1. Read `features/primitive-bundle-plugin-kind-5.md` top-to-bottom.
2. Invoke `superpowers:writing-plans` to produce an implementation plan grounded in the feature spec's Technical Approach section. The plan should map each of the 15 Acceptance Criteria to implementation tasks.
3. Implement against the plan. Expected file touches:
   - **New**: `src/lib/plugins/registry.ts`, `src/lib/plugins/sdk/types.ts`, `src/lib/chat/tools/plugin-tools.ts`, `src/app/api/plugins/route.ts`, `src/app/api/plugins/reload/route.ts`, `src/lib/plugins/examples/finance-pack/` (dogfood).
   - **Extend**: `src/lib/utils/ainative-paths.ts` (+`getAinativePluginsDir`), `src/lib/agents/profiles/registry.ts` (+`pluginScope` param), `src/lib/workflows/blueprints/registry.ts` (same), `src/lib/data/seed-data/table-templates.ts` (refactor to mutable registry + YAML loader), `src/instrumentation-node.ts` (+loader call after step 5).
4. Verification: run the 3 smoke tests from the feature spec + 3 unit test files.
5. Ship verification: use `product-manager` skill's Ship Verification mode to audit each AC against the implementation before marking `status: completed`.
6. Release as 0.14.0 (minor bump — new primitive kind, new API surface).

### Path B — Groom Milestone 2 (recommended if next session is short)

Milestone 2 is `schedules-as-yaml-registry`. Today schedules are DB-only; Kind 5 bundles cannot carry schedules because there's no YAML loader. This milestone closes that gap so a bundle can ship `schedules/*.yaml` alongside `profiles/` and `blueprints/`.

1. Invoke `/product-manager` with: *"Write the feature spec for Milestone 2 — schedules-as-yaml-registry. Source: ideas/self-extending-machine-strategy.md §9 Milestone 2, plus existing schedule infrastructure at src/lib/schedules/ and src/lib/db/schema.ts (schedules table). Must follow the shape of workflow-blueprints.md (YAML + Zod + registry + loader) adapted to schedules. Target: features/schedules-as-yaml-registry.md."*
2. Update roadmap + changelog per PM skill conventions.
3. Return to Path A for Milestone 1 implementation before starting Milestone 2 implementation.

### Path C — Refine strategy doc (if user brings new evidence)

If new competitive intel lands, or if user prioritization changes (e.g., someone asks for Kind 2 data processors and it feels load-bearing), update `ideas/self-extending-machine-strategy.md` in place with a dated amendment under the relevant section. Do not silently flip decisions — document the reversal with evidence.

---

## Environment state at handoff time

- **Branch**: `main`, clean (commit `8485017a` = 0.13.3)
- **Working tree**: three files modified/added in this session but NOT yet committed:
  - `features/primitive-bundle-plugin-kind-5.md` (new)
  - `features/roadmap.md` (modified: added Self-Extension Platform section)
  - `features/changelog.md` (modified: added 2026-04-18 grooming entry)
  - `ideas/self-extending-machine-strategy.md` (new)
  - `handoff/2026-04-18-self-extending-machine-strategy-handoff.md` (this file, new)
  - `ainative-business-0.13.2.tgz` + `ainative-business-0.13.3.tgz` — gitignored artifacts, safe to delete or keep
- **npm package state**: 0.13.3 published locally (tarball only); not yet `npm publish`ed to registry. User may run `npm publish ainative-business-0.13.3.tgz` independently.
- **Dev server**: not running. Start with `npm run dev` from `/Users/manavsehgal/Developer/ainative` if needed.
- **Open browser tabs / MCP state**: none assumed. Next session starts fresh.

### First action for the next session

Commit the grooming artifacts as one bundle (they're logically coherent), then choose a path above:

```bash
git add features/primitive-bundle-plugin-kind-5.md \
        features/roadmap.md \
        features/changelog.md \
        ideas/self-extending-machine-strategy.md \
        handoff/2026-04-18-self-extending-machine-strategy-handoff.md
git commit -m "..."
```

Suggested commit message:

```
docs(strategy): self-extending machine strategy + Milestone 1 spec

- ideas/self-extending-machine-strategy.md: 14-section living strategy doc
  synthesizing architect + frontend-designer + product-manager perspectives.
  Locks decisions D1-D6: ship Kind 5 + Kind 1 plugins only, JS-direct
  authoring, /apps authoring-only, install-path parity, public slogan
  "Describe your business. Ainative builds it, runs it, and grows with it."
- features/primitive-bundle-plugin-kind-5.md: Milestone 1 spec (P0, post-MVP).
  YAML primitive bundles (profile + blueprint + table) as plugins under
  ~/.ainative/plugins/<id>/. 15 AC, 3 smoke tests, finance-pack dogfood.
- features/roadmap.md: new "Self-Extension Platform" section with all 5
  milestones pre-declared.
- features/changelog.md: grooming entry with post-rollback discipline notes.
- handoff/: next-session resume point.

Replaces the rolled-back App Marketplace cluster (2026-04-12, 21 commits).
Rollback scar is on distribution, not composition — this roadmap honors
that distinction.
```

---

## Open decisions deferred to future sessions

From strategy doc §13:

- **TypeScript authoring** for Kind 1 plugins — revisit only if user complaints surface about unreadable emitted JS.
- **Plugin dependency deduplication** — revisit when `~/.ainative/plugins/` aggregate size becomes a complaint.
- **Plugin discovery in chat command palette** — interleave into Create + Automate categories vs. a sixth "Plugins" category.
- **`--safe-mode` runtime toggle** — currently a CLI flag; consider a Settings toggle for audit-in-place.
- **PE-portfolio persona (Phase 2)** — fleet management, portfolio-wide deployment. Out of Phase 1 scope.

None of these block any of the 5 milestones.

---

## Don't undo these

A short list of state that is easy to accidentally regress:

- The npx `.env.local` precedence inversion (0.13.2 — `bin/cli.ts` lines 36–76). If you see a guard like `!(key in process.env)` come back in a commit, the "Fix" button on Settings → Instance will silently stop working again.
- The first-run auto-writer in `bin/cli.ts` (0.13.2 — same region). Without it, every fresh `npx ainative-business` shows a red data-dir warning by default.
- The `skippedReason: "no_git"` branch in `src/app/api/instance/config/route.ts` (0.13.3). Without it, npx users get a false "setup incomplete" warning that Path B's Run-setup button can't fix.

These three were recent bug fixes with a shared root cause (the divergent self-extension story across install paths). They're covered by `src/lib/__tests__/cli-env-local.test.ts` (6 subprocess tests) and `src/components/instance/__tests__/instance-section.test.tsx` — if either file disappears or those tests are removed, flag it immediately.

---

## Who to talk to if stuck

- **For architecture questions** on plugin primitives: re-invoke `/architect`. The deep-dive transcript is not saved, but the synthesis in `ideas/self-extending-machine-strategy.md` §5 captures the key conclusions.
- **For UX questions** on `/apps`, ExtensionFallbackCard, or install-path surfacing: re-invoke `/frontend-designer`. Reference strategy doc §6.
- **For scope / priority / sequencing questions**: re-invoke `/product-manager` with explicit reference to strategy doc §9 (5-milestone roadmap) and §10 (non-goals). The PM skill has a Ship Verification mode useful for auditing Milestone 1 before marking it `completed`.
- **For security questions** on Kind 1 (Milestone 3, not this milestone): Claude Code and Codex CLI's MCP server trust model is the reference pattern. We do not sandbox; we document and gate on user click-accept.

---

*End of handoff. The next session should begin by reading
`ideas/self-extending-machine-strategy.md` for the authoritative decisions,
then `features/primitive-bundle-plugin-kind-5.md` for the ready-to-implement
spec, then choose Path A, B, or C above.*
