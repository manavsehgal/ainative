# Handoff: 0.14.0 release prep landed (commit + tag local) — npm publish gate is the only thing left

**Created:** 2026-05-05 (after 0.14.0 version bump, CHANGELOG consolidation, CLI build, tarball pack, commit `793bde1b`, tag `v0.14.0`)
**Status:** Release prep is complete and committed. The tarball `ainative-business-0.14.0.tgz` (2.2 MB, 1396 files, 8.7 MB unpacked) sits in the repo root, gitignored. **Not yet pushed at the time of this writing — push happens in the next commit alongside this handoff rotation.** Not yet published to npm.

Prior handoffs archived at:
- `.archive/handoff/2026-05-05-doc-cleanup-and-apps-drift-closed.md` (just-archived; covered orphan cleanup + 6 date bumps + manifest sync + apps.md drift fix shipped in `da339ff1` + `09f82dcc`)
- `.archive/handoff/2026-05-05-doc-generator-round-1-2-shipped.md` (one layer back)
- `.archive/handoff/2026-05-05-book-updater-website-partial-sync.md` (two layers back)

---

## TL;DR for the next agent

1. **`npm publish` to ship 0.14.0** (the only path-of-the-batched-release step remaining).
   - Pre-flight is done: `dist/cli.js` rebuilt, `npm pack --dry-run` clean, tarball spot-checks pass (`dist/cli.js`, `book/chapters/*` 22 files, `ai-native-notes/*.md` 8 files all bundled).
   - `prepublishOnly` will re-run `npm run build:cli` automatically — harmless duplication.
   - Run from this repo root: `npm publish` (no flags needed; `manavsehgal` is the maintainer).
   - **Don't run this without explicit user authorization** — npm publishes are effectively irreversible for at least 72 hours.

2. **Sibling-repo book sync** (still parked from earlier sessions, off-limits per `feedback-no-sibling-repo-edits.md`).
   - `~/Developer/ainative-business.github.io/main` is clean against its `origin/main`; local branch `book-sync-ch-5-7-11-backup` (commit `0c4f5a6`) holds the unmerged ch-5/7/11 prose work.
   - Recommended path: `cd ~/Developer/ainative-business.github.io && /apply-book-update` from inside that repo only.

3. **(Optional) `/refresh-content-pipeline` smoke pass** — should detect zero drift and exit fast (3-way `screengrabCount` audit currently returns zero mismatches across all 22 doc sections).

If you only do one thing, do **#1**, but only with explicit user authorization in the same conversation.

## What this session accomplished

Three commits landed this session, pushed to `origin/main` plus one annotated tag (push of the tag happens alongside this handoff rotation):

| Commit | Subject | Pushed |
|---|---|---|
| `da339ff1` | `docs(maintenance): orphan cleanup, 6 lastUpdated bumps, manifest screengrabCount sync` | ✓ |
| `09f82dcc` | `docs(apps): inline 2 missing apps starters captures, close last in-repo drift` | ✓ |
| `793bde1b` | `chore(release): 0.14.0 — Self-Extending Machine M1-M5 + Apps + Branches + Plugins` | (this rotation pushes it) |
| Tag `v0.14.0` | annotated, pointing at `793bde1b` | (this rotation pushes it) |

### 0.14.0 release prep (item this session added on top of the prior handoff)

- **Version analysis** before bumping: 247 commits + 731 files + 106 feat / 21 fix / 81 docs since last npm publish (0.13.2, 2026-04-19). Three net-new product surfaces (Apps, Branches, Plugins) plus the M1–M5 Self-Extending Machine arc. No breaking changes, one additive schema migration (`0027_add_tasks_context_row_id.sql`).
- **Recommendation chosen: minor bump (0.14.0)** — patch was the pre-bumped value (0.13.3 in `package.json`) but it underrepresented the change set by an order of magnitude. Pre-1.0 semver convention says minor for new features, patch for fixes; 106 feat commits ≠ a patch.
- **CHANGELOG consolidated** — the unpublished `[0.13.3]` entry (instance-section accurate notice fix) was folded into a single `[0.14.0] — 2026-05-05` entry. End users will move from `0.13.2` → `0.14.0` on npm with no `0.13.3` gap.
- **Build + pack verification:**
  - `npm run build:cli` → `dist/cli.js` 70.59 KB ESM, node20 target, clean tsup build
  - `npm pack --dry-run` → 1396 files, 2.3 MB compressed, 8.7 MB unpacked
  - Spot checks: `book/chapters/*` (22 files) and `ai-native-notes/*.md` (8 files) bundled per M5 install-parity-audit
  - Real `npm pack` produced `ainative-business-0.14.0.tgz` at 2.2 MB
- **Local tag:** `v0.14.0` annotated, message `Release 0.14.0 — M1-M5 + Apps + Branches + Plugins (batched)`. Tag history skips `v0.13.x` (those versions were published to npm but never git-tagged).

### Doc maintenance (item from prior handoff, completed earlier in same session)

Already shipped in `da339ff1` + `09f82dcc` — see archived handoff for details. Net result: 7 orphans deleted from `public/readme/`, 6 stale `lastUpdated` fields bumped, manifest `screengrabCount` aligned with reality across all 22 sections (zero remaining drift).

## Working tree state (immediately before final handoff commit)

```
M HANDOFF.md
?? .archive/handoff/2026-05-05-doc-cleanup-and-apps-drift-closed.md
```

`ainative-business-0.14.0.tgz` exists in the repo root but is gitignored (matches `ainative-*.tgz` in `.gitignore`). Earlier 0.13.x tarballs from prior release prep are also present locally, also gitignored.

## Process notes for next agent

- **Pre-bumped `package.json` versions are a smell when batched releases happen.** This session caught a `0.13.3` pre-bump that came from a `fix(publish):` commit during the M5 audit. The bump was scoped at the time to a small files-array edit, but feature work continued for weeks afterward — the version label decayed without anyone noticing. **Heuristic for next time:** before any release, run the change-volume audit (`git rev-list --count`, commit-prefix tally, file-count) against the *last published* version on npm, not against the local `package.json` version. The two can diverge.
- **`npm pack --dry-run` is the cheap safety check.** It runs in <2 seconds, shows exactly what gets shipped, and surfaces missing-file regressions (like the M5 publish-parity issue) before they hit consumers. Worth making it the default first step for any release prep, before the bump or the changelog write.
- **`prepublishOnly` saves you from publishing a stale build.** Even if you forget to `npm run build:cli` manually, npm runs it for you on `npm publish`. But `npm pack` does *not* run `prepublishOnly` — only `prepack`. The current `package.json` has only `prepublishOnly`, which means a manual `npm pack` against a stale `dist/` would publish stale code if not for the `npm publish` hook. Worth duplicating to `prepack` in a future tightening pass, or always running `npm run build:cli` before `npm pack`.
- **The IDE TS diagnostic panel was extra loud across this entire session** — markdown/JSON edits triggered phantom "Cannot find module" warnings repeatedly. Per CLAUDE.md memory: trust `npx tsc --noEmit | grep <file>` over the inline panel. None of this session's edits touched TS, so no compiler run was warranted.
- **Sibling-repo trust boundaries continue to be respected.** The user explicitly opened this session with "ignore any action on sibling repo, continue completing tasks in this repo", and a memory was saved to enforce that durably (`feedback-no-sibling-repo-edits.md`). Sibling-repo writes remain off-limits to any session not explicitly opened in / scoped to that repo.

## Recommended next-session sequence

1. **Authorize `npm publish` from inside this repo** — this is the natural completion of the 0.14.0 batched release. Confirm the version mismatch is resolved (`npm view ainative-business version` should return `0.13.2` before publish; `0.14.0` after). Verify the published tarball with `npx ainative-business@0.14.0` in a scratch dir afterward.
2. From inside `~/Developer/ainative-business.github.io/`, run `/apply-book-update` to land the parked `book-sync-ch-5-7-11-backup` branch. After confirmed in `origin/main`, optionally `git branch -D book-sync-ch-5-7-11-backup` to clean up.
3. Optionally run `/refresh-content-pipeline` end-to-end as a final confirmation pass — should detect zero drift and exit fast.
