# Handoff: M5 `install-parity-audit` shipped — next is the batched npm publish

**Created:** 2026-04-21
**Supersedes scope of:** `handoff/2026-04-21-m4.5-shipped-handoff.md` §"What's next — M5". That handoff teed M5 up; this handoff reports it shipped.
**Author:** Manav Sehgal (with Claude Opus 4.7 assist)

Headline: **M5 is shipped as 2 commits on `main` (`aa8702da` fix + the follow-up docs commit). The Self-Extending Machine release gate is closed. One latent drift surfaced and was fixed: `book/chapters/` and `ai-native-notes/*.md` were runtime-read by the book UI but missing from `package.json`'s `files` array, silently degrading the book on every npx install since launch. Fixed + regression test added. The M4.5 surface (planner + scaffold API route) passed the audit clean — no additional fixes needed. 338/338 tests green; typecheck clean.**

**What's next:** the batched npm publish. Version bump 0.13.3 → (likely) 0.14.0 for the cumulative M1 + M2 + M3 + M4 + M4.5 + M5 delta, then `npm publish --access public` as `manavsehgal` maintainer per strategy amendment 2026-04-19. The Self-Extending Machine is shipped and the release is queued.

---

## Read these first, in order

1. **This handoff** — you're here.
2. **`handoff/2026-04-21-m4.5-shipped-handoff.md`** — M4.5 ship + M5 teeing. M5 is the release gate; M4.5 was the signature demo.
3. **`features/install-parity-audit.md`** — M5 feature landing with the full audit matrix.
4. **`features/roadmap.md` §"Self-Extension Platform"** — M5 row `planned` → `shipped`. All milestones in this cluster now `shipped`.
5. **`ideas/self-extending-machine-strategy.md` §"Amendment 2026-04-19"** — the single-batched-release contract: no incremental publishes; all milestones ship together at the end. M5 is the gate this strategy has been waiting on.
6. **CLAUDE.md instance-bootstrap dev-mode gate** (lines ~75-90) — `STAGENT_DEV_MODE=true` in `.env.local` + `.git/ainative-dev-mode` sentinel. Both verified during this audit.

---

## What shipped this session (M5)

### 2 commits on `main`

```
aa8702da  fix(publish): M5 audit — include book/chapters + ai-native-notes/*.md in npm files
<PENDING>  docs(M5): install-parity-audit shipped — roadmap + changelog + handoff
```

**HEAD on `main`:** `aa8702da` before the handoff commit; new SHA after.
**`origin/main`:** awaiting user-initiated push (CLAUDE.md risky-action discipline).
**Working tree:** clean after the handoff commit.

### Finding #1 (FIXED) — book content missing from published tarball

**Pre-fix state:** `package.json`'s `files` array shipped `dist/`, `docs/`, `src/`, 3 public icons, and 5 config files. It did NOT include `book/` or `ai-native-notes/`.

**Runtime reads (grepped during audit):**
- `src/lib/book/content.ts:204` → `<appRoot>/book/chapters/${fileSlug}.md`
- `src/lib/book/update-detector.ts:25` → `<appRoot>/book/chapters/${slug}.md`
- `src/lib/book/chapter-generator.ts:39` → `<appRoot>/book/chapters/${slug}.md`
- `src/lib/book/chapter-generator.ts:58` → `<appRoot>/ai-native-notes/${csSlug}.md`
- `src/lib/book/chapter-generator.ts:66` → `<appRoot>/ai-native-notes/ai-native-book-strategy.md`

**Why it didn't crash:** `content.ts:205` has `if (!existsSync(filePath)) return null;` — graceful fallback to stub content. The book UI has been silently degraded for every npx user, with no surfaced error.

**Fix (`aa8702da`):**
- Added `"book/chapters/"` + `"ai-native-notes/*.md"` to `files`.
- Scoped ai-native-notes to `*.md` so 8 strategy PNGs (~4.7MB total, ~780KB each) aren't shipped. The runtime reads only .md files.
- Tarball size: 1.8MB → 4.5MB packed; 7MB → 7.4MB unpacked. Reasonable for a Next.js app.
- `npm pack --dry-run` count: 1,209 → 1,231 files.

**Regression test (`src/lib/__tests__/npm-pack-files.test.ts`):** 5 tests.
1. `files` must include `book/chapters/` or `book/`.
2. `files` must include `ai-native-notes/*.md` or `ai-native-notes/`.
3. `files` must include `dist/` and `src/`.
4. `files` must include `docs/`.
5. Working tree must actually contain `book/chapters/` and `ai-native-notes/` with at least one `.md` in each (guards the double-silent case where a rename makes both the files entry AND the working tree out of sync).

### M4.5 surface — audit clean

No fixes needed. Verified via:
- `rg "process.cwd\(\)" src/lib/chat/planner/ src/app/api/plugins/scaffold/` → zero matches (except test file, which is excluded from the npx-safety check).
- `rg "import.meta.dirname" src/lib/chat/planner/ src/app/api/plugins/scaffold/` → zero matches.
- `rg "runtime/catalog" src/lib/chat/planner/ src/app/api/plugins/scaffold/` → zero matches.
- `npm pack --dry-run` confirms `src/lib/chat/planner/*` (5 files + 3 tests) and `src/app/api/plugins/scaffold/*` (2 files) are included under the existing `src/` entry.
- 309/309 M4.5 tests still green post-fix.

### Boot smoke (executed during audit)

**Smoke 1: boot from scratch dir with env var preset.**
```
mkdir -p /tmp/m5-smoke && cd /tmp/m5-smoke \
  && AINATIVE_DATA_DIR=/tmp/m5-smoke-data \
     node /Users/manavsehgal/Developer/ainative/dist/cli.js --help
```
Result: help text renders correctly. Data dir reports `/tmp/m5-smoke-data`. No `.env.local` written (env var pre-set). ✅

**Smoke 2: boot from scratch dir without env var.**
```
mkdir -p /tmp/m5-smoke2 && cd /tmp/m5-smoke2 \
  && node /Users/manavsehgal/Developer/ainative/dist/cli.js --help
```
Result: auto-wrote `/tmp/m5-smoke2/.env.local` with `AINATIVE_DATA_DIR=/Users/manavsehgal/.m5-smoke2`. Help text renders. ✅

**Smoke 3: plugin subcommand.**
```
cd /tmp/m5-smoke \
  && AINATIVE_DATA_DIR=/tmp/m5-smoke-data \
     node /Users/manavsehgal/Developer/ainative/dist/cli.js plugin
```
Result: `Unknown plugin action: (none) / Available actions: dry-run` + exit 1. Subcommand path reachable. ✅

All 3 smokes executed against `dist/cli.js` from the just-built CLI (`npm run build:cli`). Temp dirs cleaned up post-smoke (`rm -rf /tmp/m5-smoke*`).

### Test totals at handoff time

- **M5-new suite:** 5 green (`npm-pack-files.test.ts`).
- **Full lib + chat + components + api sweep:** **338/338 green across 43 test files** (up from 309 pre-M5 + 29 from previously-not-swept lib suites now included).
- **Typecheck:** `npx tsc --noEmit` clean on M5 surface.
- **CLI build:** `npm run build:cli` produces `dist/cli.js` (69.84 KB ESM) in ~40ms. No tsup warnings.

### Not tested during M5 (intentionally — out of scope)

- **Live npm publish + install:** requires registry access and would create a version bump. M5 is the pre-publish gate; publishing is a separate step.
- **End-to-end browser smoke of M4.5 planner from an npx install:** would need to launch the full dev server, chat with a real LLM, and observe the UI. Burns credits + observation-heavy. Flagged for M4.5 handoff; M5 doesn't repeat it.
- **Worktree / domain-clone install paths:** the `PRIVATE-INSTANCES.md` §1.7 flow (local branch shim, domain-mgr branches) is a separate code path. Not audited — assumption: if M4.5 surface is npx-clean, it's also worktree-clean because both paths share the same file-system assumptions. If this assumption breaks, surface in M6.

---

## Architectural classification — no new TDRs for M5

M5 is pure audit + one fix. No architecture changes:
- No new modules.
- No new public APIs.
- No changes to runtime/catalog, chat engine, plugin trust model, or any other tier.
- The one fix is a config edit in `package.json` + a regression test. Neither is architecturally novel.

TDR-037 stays `accepted` and unchanged. TDR count: 37.

---

## Regression guards — don't undo these

### From M5 (shipped 2026-04-21)

**1. `package.json` `files` array must include `book/chapters/` and `ai-native-notes/*.md`.** Regression test in `src/lib/__tests__/npm-pack-files.test.ts` will fail if either is removed. A future contributor "tidying up" the files array by removing "unused" entries must preserve these. Adding more runtime-read dirs to the app without updating `files` is the same class of drift — the test pattern should be extended to catch each new one.

**2. `ai-native-notes/` stays scoped to `*.md`.** The unscoped form (`"ai-native-notes/"`) would re-add 4.7MB of internal strategy-doc PNGs that the runtime never reads. A future contributor "simplifying" the files array to match `book/` (which IS unscoped at `book/chapters/`) must preserve the `*.md` scope.

**3. `getAppRoot(import.meta.dirname, 3)` depth value for book content.** `src/lib/book/content.ts:203` uses depth 3 (file lives at `src/lib/book/content.ts` → depth-3 ancestor is the repo root / appRoot). Changing the file's location without updating the depth silently breaks book content loading under npx. The fallback `existsSync` check masks this; audit catches it only by manual book-UI verification.

### Pre-existing guards (still load-bearing)

**4. `bin/cli.ts` hoisting list `["src", "public", "docs", "book", "ai-native-notes"]`** (line 254). This list fires only when the app is installed into a workspace that hoists deps (rare). For normal npx, `files` is the authoritative list. Both must stay in sync — a runtime-read dir must appear in BOTH.

**5. `isDevMode()` checks both env var + sentinel file.** `src/lib/instance/detect.ts:16`. Collapsing to env-var-only breaks the multi-developer dev-mode protection (`STAGENT_DEV_MODE` varies per developer; sentinel file is stable in the repo). Neither gate alone is sufficient.

**6. Auto `.env.local` write logic** (`bin/cli.ts:44`) requires THREE conditions: (a) `.env.local` doesn't exist, (b) `AINATIVE_DATA_DIR` not in env, (c) not in dev mode. Removing any one of these three breaks the safe-default: new user gets a stable isolated data dir per launch folder without any configuration.

---

## What's next — single batched npm publish

### Why publish is the next step

Strategy amendment 2026-04-19 explicitly defers all publishes until all 5 milestones ship. M5 is the final gate. The cumulative delta since the last publish (0.11.1 → 0.13.3, with many unpublished increments) includes:

- **M1** `primitive-bundle-plugin-kind-5` — shipped
- **M2** `schedules-as-yaml-registry` — shipped
- **M3** `chat-tools-plugin-kind-1` + TDR-037 accepted — shipped
- **M4** `create_plugin_spec` + `ainative-app` fall-through + `ExtensionFallbackCard` — shipped
- **M4.5** `nl-to-composition-v1` — shipped
- **M5** `install-parity-audit` — shipped

Plus the `book/chapters/` + `ai-native-notes/*.md` publish-contract fix from M5.

### Publish checklist

1. Review cumulative changelog (this file + previous M-commits).
2. Decide version bump. Recommended: **0.13.3 → 0.14.0** — the Self-Extending Machine is a substantial feature delta deserving a minor bump. Major bump not warranted (no breaking API changes for existing users).
3. Update `package.json` version field.
4. Run full pre-publish checks:
   ```
   npm run build:cli   # already done this session, but re-run to be safe
   npm test            # verify 338+/338+ green
   npx tsc --noEmit    # verify clean
   npm pack --dry-run  # verify files + size sane (should be ~4.5MB packed)
   ```
5. `npm publish --access public` as `manavsehgal` maintainer.
6. Tag the release: `git tag v0.14.0 && git push origin v0.14.0`.
7. Announce: link to the three handoffs (Phase 6, M4.5, M5) in the release notes.

### What NOT to publish

- **Don't publish from `/tmp/m5-smoke*`** — those were smoke-test scratch dirs. Clean (already done with `rm -rf`).
- **Don't push `.env.local` files from smokes** — gitignored, but double-check `git status` before version-bump commit.
- **Don't skip `prepublishOnly`** — `package.json` has `"prepublishOnly": "npm run build:cli"` which rebuilds `dist/cli.js` from source. Don't `--ignore-scripts`.
- **Don't use `npm publish --force`** — if the version is taken, bump higher rather than overwriting.

### Post-publish verification

After publish, from a fresh machine or tmp dir:
```
mkdir -p /tmp/publish-verify && cd /tmp/publish-verify
npx ainative@0.14.0 --help
# Expected: help text, auto-created .env.local, data dir under ~/.publish-verify
```

If this fails, `npm unpublish ainative@0.14.0` is an option within 72 hours. Prefer bumping to 0.14.1 with a fix if the window has passed.

---

## Deferred to M6 / later

- **Codex + Ollama engine parity for the M4.5 planner** — v1 wires only the Claude SDK engine. Codex / Ollama users can still invoke composition via explicit tool calls but not via NL. Tracked in the M4.5 handoff.
- **Multi-turn app composition understanding** — *"make it also track ratings"* as a refinement of a prior turn. v1 treats each message atomically.
- **LLM-based intent classifier (planner v2)** — warrants a TDR for the new LLM hop's cost/latency.
- **`/plugins` page** — Phase 5 per Phase 4 handoff. Still deferred until a real third-party plugin appears.
- **Worktree / domain-clone install path audit** — assumed clean because M4.5 + M5 share npx file-system assumptions. If an issue surfaces in the wild, open M6.
- **Book UI visual verification on npx install** — with the fix in place, chapters should render full content. Worth eyeballing post-publish.

---

## Environment state at handoff time

- **Branch:** `main`, working tree clean after this handoff commit.
- **`origin/main`:** awaiting user-initiated push.
- **HEAD:** `aa8702da` before the handoff commit; new SHA after.
- **`package.json` version:** still `0.13.3`. The version bump happens at publish time, not here.
- **Tests:** 338/338 green across M4.5 + M5 surface. No new tests elsewhere.
- **`npx tsc --noEmit`:** clean.
- **`dist/cli.js`:** freshly built during this session (69.84 KB ESM).
- **Chat-tool count:** unchanged at 92. No new chat tools in M5.
- **TDR count:** 37. No new TDRs.
- **Feature spec status:**
  - `install-parity-audit` — NEW, `shipped`.
  - `nl-to-composition-v1` — still `shipped` (from this morning's M4.5).
- **Roadmap:** all Self-Extension Platform milestones `shipped`.

### New artifacts this session (M5)

Committed (2 commits — 1 fix + 1 docs):
- `package.json` (modified — `files` array extended)
- `src/lib/__tests__/npm-pack-files.test.ts` (NEW — 66 LOC, 5 tests)
- `features/install-parity-audit.md` (NEW — feature landing)
- `features/roadmap.md` (modified — M5 row flipped to shipped + linked)
- `features/changelog.md` (modified — new M5 section)
- `handoff/2026-04-21-m5-shipped-handoff.md` (NEW — this file)

### Total diff (this session, all M5 work)

```
 features/changelog.md                                     |  11 +
 features/install-parity-audit.md                          |  71 ++++++
 features/roadmap.md                                       |   2 +-
 handoff/2026-04-21-m5-shipped-handoff.md                  | XXX +  (this file)
 package.json                                              |   2 +
 src/lib/__tests__/npm-pack-files.test.ts                  |  66 ++++++
```

---

## Session meta — canonical sources

- **M5 design + implementation** → `features/install-parity-audit.md` §"Audit matrix" (this session's detailed find-and-fix trail).
- **Roadmap** → `features/roadmap.md` §"Self-Extension Platform" (all milestones `shipped`).
- **Changelog** → `features/changelog.md` `## 2026-04-21` → `### Shipped — M5 install-parity-audit`.
- **Commits** → `git log --oneline 173d9108..HEAD` (this session's 2 commits).

If in doubt, read the source. This handoff is the routing table, not the authority.

---

*End of handoff. M5 `install-parity-audit` shipped as 1 fix commit (`aa8702da`) + 1 docs commit. Self-Extending Machine cluster is complete: M1 + M2 + M3 + M4 + M4.5 + M5 all shipped. Next step is the single batched npm publish per strategy amendment 2026-04-19 — bump 0.13.3 → 0.14.0, `npm publish --access public` as `manavsehgal`, tag `v0.14.0`, announce. Linked handoffs (Phase 6, M4.5, M5) form the release-notes backbone.*
