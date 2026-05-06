# Handoff: Orphan cleanup + 6 date-stale doc bumps + manifest sync — sibling-repo book sync still parked

**Created:** 2026-05-05 (after orphan + date-bump maintenance pass; commit pending review)
**Status:** This repo is clean and the working tree carries small doc/maintenance edits ready for one squash commit. The sibling website repo at `~/Developer/ainative-business.github.io/` is unchanged from the prior handoff — `book-sync-ch-5-7-11-backup` (commit `0c4f5a6`) still parked, awaiting `/apply-book-update` from inside that repo.

Prior handoffs archived at:
- `.archive/handoff/2026-05-05-doc-generator-round-1-2-shipped.md` (just-archived; covered the doc-refresh work shipped in `80acaf7e`)
- `.archive/handoff/2026-05-05-book-updater-website-partial-sync.md` (one layer back; covered the sibling-repo parking decision)

---

## TL;DR for the next agent

1. **Resolve the sibling-repo book sync** (5–10 min, biggest remaining user-visible payoff).
   - State: `~/Developer/ainative-business.github.io/main` matches `origin/main` (clean), but local branch `book-sync-ch-5-7-11-backup` (commit `0c4f5a6`) holds the staged book-prose work + metadata for ch-5/7/11.
   - Recommended: `cd ~/Developer/ainative-business.github.io && /apply-book-update` — that skill has the right repo permissions (the harness blocks direct main pushes from this repo) and handles commit + build + push correctly.
   - If keeping the parked branch is no longer wanted: `cd ~/Developer/ainative-business.github.io && git branch -D book-sync-ch-5-7-11-backup` once the sync is properly applied via the skill.

2. **Investigate `apps.md` content drift** (5–10 min). Frontmatter and manifest agree on `screengrabCount: 9` but only 7 captures are actually embedded in the doc. This is content drift (metadata claims captures that aren't present), not metadata-vs-metadata drift. Two possible resolutions:
   - Add the 2 missing captures (preferred if they exist in `screengrabs/`)
   - Down-count both frontmatter and manifest to 7
   - Worth grepping `screengrabs/apps-*.png` and comparing against the 7 currently embedded.

3. **(Optional) Run `/refresh-content-pipeline` end-to-end** as a single confirmation pass. With this session's manifest fixes in, the only expected drift is the `apps.md` discrepancy from #2.

If you only do one thing, do **#1** — the sibling website's book chapters still render the older versions of ch-5/7/11.

## What this session accomplished

### Orphan cleanup in `public/readme/` (item #2 from prior handoff)

- Computed orphans via `comm -23 <(ls public/readme | grep -v .last-synced | sort) <(ls screengrabs | sort)` — found **12** files in mirror but not in source (handoff guessed 10).
- Cross-referenced each against the live codebase via `rg -l` (excluding `node_modules`, `dist`, `.next`, `public/readme` itself):
  - **5 must-keep** (still referenced in live README.md or specs): `architecture-dark.svg`, `architecture-light.svg`, `chat-conversation.png`, `settings-browser-tools.png`, `tasks-below-fold.png`. These are hand-curated README assets, not screengrab pipeline output — they live in `public/readme/` only.
  - **7 deleted** (no live refs; only frozen archive handoffs reference some): `chat-actions-tab.png`, `chat-entities-tab.png`, `chat-model-picker.png`, `chat-search-filter.png`, `settings-channels-add-form.png`, `settings-ollama-connected.png`, `settings-ollama.png`.
- `public/readme/` count: 108 → 101.

### Date-stale `lastUpdated` bumps (item #3 from prior handoff)

All 6 docs bumped to `2026-05-05` after confirming actual embedded counts match frontmatter declarations (no concrete content drift):

| Doc | Old `lastUpdated` | New |
|---|---|---|
| `docs/features/user-guide.md` | 2026-03-31 | 2026-05-05 |
| `docs/features/tool-permissions.md` | 2026-04-15 | 2026-05-05 |
| `docs/features/monitoring.md` | 2026-03-31 | 2026-05-05 |
| `docs/features/cost-usage.md` | 2026-03-31 | 2026-05-05 |
| `docs/features/delivery-channels.md` | 2026-04-01 | 2026-05-05 |
| `docs/features/schedules.md` | 2026-04-08 | 2026-05-05 |

### Manifest `screengrabCount` audit + 2 fixes (bonus, found while bumping dates)

Ran a 3-way audit (actual embedded captures vs. frontmatter declaration vs. manifest declaration) over all 22 doc sections. Found 3 mismatches:

| Doc | Actual | Frontmatter | Manifest | Action |
|---|---|---|---|---|
| `schedules` | 4 | 4 | 2 | **Manifest fixed → 4** |
| `delivery-channels` | 0 | 0 (`manual: true`) | 4 | **Manifest fixed → 0** |
| `apps` | 7 | 9 | 9 | **Flagged for next session** (content drift, see TL;DR #2) |

Manifest JSON validity verified via `python3 -c "import json; json.load(open('docs/manifest.json'))"`. Did NOT bump `docs/manifest.json` `generated` timestamp because the generator did not run — only consistency edits.

## Working tree state (pre-commit)

```
M HANDOFF.md
M docs/features/cost-usage.md
M docs/features/delivery-channels.md
M docs/features/monitoring.md
M docs/features/schedules.md
M docs/features/tool-permissions.md
M docs/features/user-guide.md
M docs/manifest.json
D public/readme/chat-actions-tab.png
D public/readme/chat-entities-tab.png
D public/readme/chat-model-picker.png
D public/readme/chat-search-filter.png
D public/readme/settings-channels-add-form.png
D public/readme/settings-ollama-connected.png
D public/readme/settings-ollama.png
?? .archive/handoff/2026-05-05-book-updater-website-partial-sync.md
?? .archive/handoff/2026-05-05-doc-generator-round-1-2-shipped.md
```

**No code edits, no DB changes, no schema changes, no `.env.local` changes, no dev-server restarts.**

## Process notes for next agent

- **The 3-way `screengrabCount` audit is reusable.** A small Python snippet that walks `docs/manifest.json`, reads each doc's frontmatter, and counts `![...](../screengrabs/...)` matches surfaces drift instantly. Worth keeping handy or codifying as a `/doc-generator` health check. Snippet is in this session's transcript.
- **Orphan checks need the consumer-side step.** "File in `public/readme/` but not in `screengrabs/`" is necessary but NOT sufficient — the file may still be a live README/spec asset. Always grep for refs (excluding `.archive/`) before deleting. This session's 12-orphan list reduced to 7 safe deletions after the consumer-side filter.
- **The IDE TS diagnostic panel was loud during markdown-only edits this session** — phantom `Cannot find module` warnings appeared after every Edit call. Per CLAUDE.md memory: trust `npx tsc --noEmit | grep <file>` over the inline panel. No TS files were touched, so no compiler run was needed.
- **Sibling-repo trust boundaries continue to be enforced.** Reaffirmed by skipping all sibling-repo work per user's session-opening instruction. The `/apply-book-update` path remains the correct way to land item #1 from inside the website repo.

## Recommended next-session sequence

1. From inside `~/Developer/ainative-business.github.io/`, run `/apply-book-update` to land the parked `book-sync-ch-5-7-11-backup` branch (TL;DR #1). After confirmed in `origin/main`, optionally `git branch -D book-sync-ch-5-7-11-backup` to clean up.
2. Resolve `apps.md` content drift (TL;DR #2) — grep `screengrabs/apps-*.png`, compare against the 7 currently embedded, decide add-vs-down-count, and update both frontmatter + manifest to match.
3. Optionally run `/refresh-content-pipeline` end-to-end as a final confirmation pass — should detect zero drift after #2 and exit fast.
