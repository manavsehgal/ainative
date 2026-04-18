---
name: refresh-content-pipeline
description: Change-aware orchestrator that refreshes all code-derived content (screengrabs, docs, user guide, README code samples and stats, book chapters) in the correct order when code, features, schema, profiles, workflows, or ai-native-notes change. Use this skill whenever the user wants to "refresh the content pipeline", "update all docs and screengrabs", "regenerate everything", "sync content to code", or after shipping features that change derived content. Also triggers on "content is stale", "README counts are wrong", "book is out of date alongside docs", or any request to cascade code changes into documentation, user guide, and book simultaneously. Do NOT use for a single-target refresh — route those to `/screengrab`, `/doc-generator`, `/user-guide-sync`, or `/book-updater` individually. Do NOT use for project health analysis — that is `/supervisor`.
---

# Refresh Content Pipeline

A **thin, change-aware orchestrator**. This skill holds no business logic of its own — it delegates every generation step to the skill that owns it and encodes only the ordering, the feedback loops, and the staleness checks that tie them together.

## Role Boundaries

| Need | Skill | Not This Skill |
|------|-------|----------------|
| Refresh everything derived from code | `refresh-content-pipeline` | individual skills |
| Recapture UI only | `/screengrab` | this skill |
| Regenerate docs only | `/doc-generator` | this skill |
| Sync user guide only | `/user-guide-sync` | this skill |
| Regenerate book only | `/book-updater` | this skill |
| Project health / what to work on next | `/supervisor` | this skill |

## Core Principle

**Delegate, never duplicate.** If the downstream skills change how they discover routes, scan features, or parse frontmatter, this skill should not need updates — it only knows *when* to invoke them and *in what order*.

## Why This Skill Exists

Before this skill, refreshing derived content meant invoking 4+ skills by hand in the right order, remembering the coverage-gap feedback loop between `/doc-generator` and `/user-guide-sync`, and manually updating hardcoded stat numbers in README and book chapters. Two concrete drift sources motivated it:

1. **README stat drift** — counts like "14 features shipped" are hardcoded and silently wrong after every release.
2. **Cross-surface API drift** — when a public export is renamed, the book's API examples and README code blocks both go stale, but no skill owns that.

This skill fixes both by treating content as a derived output of code state, with a single authoritative stats snapshot and a code-sample validator that understands markers.

---

## Execution Order

```
  [0] Stats snapshot ──▶ features/stats/snapshot.json
          │
          ▼
  [1] /screengrab ──▶ screengrabs/manifest.json, .last-run
          │
          ▼
  [2] /doc-generator ──▶ docs/journeys/, docs/features/, .last-generated
          │
          ▼
  [3] /user-guide-sync ──▶ public/readme/, docs/.coverage-gaps.json, .last-synced
          │
          ├─ gapCount > 0? ──▶ back to [2] (one retry only)
          ▼
  [4] README + code-sample validator (in-skill logic)
          │  Reads stats snapshot. Auto-edits when drift is unambiguous.
          ▼
  [5] /book-updater ──▶ book/chapters/, ainative.io/
          │
          ▼
  [6] Write .refresh-pipeline/last-run.json
```

Stages 0 and 4 are implemented inside this skill. Stages 1, 2, 3, 5 delegate to existing skills. Stage 6 records state.

---

## Change-Detection Matrix

The skill is incremental — it reads git diff since `.refresh-pipeline/last-run.json.lastRunSha` and runs only the stages whose inputs changed. If the state file is missing, run every stage.

| Signal (files changed since last run) | Stages to run |
|---------------------------------------|---------------|
| `src/app/**/page.tsx`, layout files, component diffs | 0, 1, 2, 3, 4 |
| `features/*.md` frontmatter (status transitioned to `completed`) or `changelog.md` | 0, 2, 3, 4, (5 if book-material) |
| `src/lib/db/schema.ts` | 0, 4, 5 |
| `src/lib/agents/profiles/` | 0, 2, 5 |
| `src/lib/workflows/` registry or blueprints | 0, 2, 5 |
| `ai-native-notes/*.md` | 0, 5 |
| Public API surface (exports from `src/lib/**/index.ts`, route handlers) | 0, 2, 4 |
| Any count-affecting change (features, tools, profiles, blueprints, skills dirs) | 0, 4 — stats always refresh first |
| `.claude/reference/ainative-io-about/**` (manual recapture or upstream drift) | 4 |
| Nothing | Report "no refresh needed", exit cleanly |

Map every changed file to one or more rows. Union the stage set. Run stages in numerical order, skipping those not in the set.

---

## Stage 0 — Stats Snapshot

**Output:** `features/stats/snapshot.json`

This is the single source of truth for counts referenced in README, book chapters, and MEMORY.md. Downstream stages read from it instead of re-counting.

### What to aggregate

| Field | Source | Method |
|-------|--------|--------|
| `features.{completed,inProgress,planned,deferred}` | `features/*.md` frontmatter | Parse YAML, group by `status` |
| `chatTools` | `src/lib/chat/ainative-tools/` | Count exported tool definitions in the registry |
| `dbTables` | `src/lib/db/schema.ts` | Count `sqliteTable(...)` invocations |
| `builtinProfiles` | `src/lib/agents/profiles/builtins/` | Count subdirectories |
| `workflowBlueprints` | `src/lib/workflows/blueprints/` or registry YAML | Count entries |
| `skills.{claude,codex,shared}` | `.claude/skills/`, `~/.codex/skills/` | Count directories; shared = intersection by name |
| `referenceLibraries` | `.claude/reference/` | Count top-level captured doc sets |
| `velocity.*` | `features/retros/<latest>.json` | Read latest retro snapshot. If none exists, invoke `/supervisor` retrospective mode to generate one (7d window) |

### Schema

```json
{
  "generatedAt": "2026-04-15T10:30:00Z",
  "fromSha": "abc123…",
  "features": { "completed": 52, "inProgress": 3, "planned": 8, "deferred": 2 },
  "chatTools": 81,
  "dbTables": 10,
  "builtinProfiles": 21,
  "workflowBlueprints": 13,
  "skills": { "claude": 32, "codex": 23, "shared": 9 },
  "referenceLibraries": 4,
  "velocity": {
    "source": "features/retros/2026-04-15.json",
    "commitsLast7d": 23,
    "featuresShippedLast7d": 2,
    "shippingStreak": 5
  }
}
```

Write the file, then log a one-line summary of what changed vs. the previous snapshot so humans can spot anomalies.

---

## Stage 4 — README + Code-Sample Validator

Stages 1–3 and 5 are delegations. Stage 4 is the substantive in-skill logic.

### What it validates

1. **Stat markers** in README.md, `book/chapters/*.md`, and `docs/features/*.md`. Markers take the form:
   ```
   <!-- STAT:featureCount -->52<!-- /STAT -->
   ```
   The number between matching markers must equal `snapshot.features.completed` (or whichever field the marker names). Field names map directly to the snapshot JSON path.

2. **Hardcoded stat numbers** in README.md — where markers are missing but a number matches a snapshot field in a nearby phrase like "52 features shipped", log as *recommended marker candidate* and report. Do not auto-edit unmarked prose.

3. **Code-block symbols** in README.md and `docs/features/*.md`. Parse fenced code blocks with language hint `ts`, `tsx`, or `js`. For each imported symbol from `@/lib/...` or local aliases, verify the symbol is still exported by the referenced module. When an export has been unambiguously renamed (single rename in the same commit range, no overload collision), auto-edit the code block to use the new name.

4. **About section sync** in `README.md`. The About block is wrapped in:
   ```
   <!-- ABOUT:BEGIN source=https://ainative.io/about/ -->
   …content…
   <!-- ABOUT:END -->
   ```
   Before validating, re-run `/capture https://ainative.io/about/` to refresh the canonical snapshot at `.claude/reference/ainative-io-about/`. Then diff the README body between the ABOUT markers against the captured markdown (normalizing whitespace and accepting the documented rename `### Why ainative` → `### Research Premise`). When the two differ, auto-replace the README content between the markers with the captured content (applying the same rename). If `/capture` fails (network down, upstream HTML change), skip the auto-edit and record a "reported drift" entry pointing at the failure — do not delete or truncate the existing About block.

### Auto-edit rules

Auto-edit when **all** of the following hold:
- The fix is a string replacement with no structural changes (no added imports, no type-shape changes).
- There is exactly one candidate replacement (no ambiguity).
- The location is a stat marker body, an About marker body, or a code block symbol — **never** free-form prose outside any of those marker pairs.

Report and skip otherwise. Every auto-edit records a line in the final run summary: `auto-edit: README.md:L120 oldFn → newFn (rename detected in src/lib/chat/tools.ts)`.

### Why auto-edit is safe here

Markers make the edit location unambiguous — we replace only content between matched delimiters. STAT markers check against a numeric snapshot; ABOUT markers check against the captured `.claude/reference/ainative-io-about/` snapshot (itself refreshed via `/capture` before the diff). Code-block symbol renames are verifiable against the actual export list. We never touch prose outside a marker pair, which is where meaning is subjective.

---

## Stages 1, 2, 3, 5 — Delegations

| Stage | Invoke | Read before invoking | Verify after |
|-------|--------|---------------------|--------------|
| 1 | `/screengrab` | Current `screengrabs/.last-run` for baseline | `screengrabs/manifest.json` updated, `.last-run` newer |
| 2 | `/doc-generator` | `screengrabs/manifest.json`, current `docs/.last-generated` | `docs/.last-generated` newer, per-feature docs regenerated for changed features |
| 3 | `/user-guide-sync` | `docs/` tree, `screengrabs/` output | `public/readme/.last-synced` newer, `docs/.coverage-gaps.json` present |
| 5 | `/book-updater` | `features/stats/snapshot.json`, changed schema/profiles/workflows/notes | `book/chapters/*.md` timestamps updated for affected chapters |

If a delegated skill reports a failure, abort the remaining stages and record the failure in the final run summary. Do not attempt recovery — the downstream skills own their own retry/repair logic.

### Feedback loop (stages 3 → 2)

After stage 3 completes, read `docs/.coverage-gaps.json`. If `summary.gapCount > 0` and this is the first pass, re-invoke stage 2 with the gaps file as input (doc-generator reads it natively — see its SKILL.md). Then re-invoke stage 3 to re-verify. One retry only — if gaps remain after the retry, record them in the final summary and continue. Infinite loops are worse than known gaps.

---

## Stage 6 — State File

**Output:** `.refresh-pipeline/last-run.json` (gitignored)

```json
{
  "lastRunSha": "abc123…",
  "lastRunAt": "2026-04-15T10:30:00Z",
  "stagesRun": ["stats", "screengrab", "doc-generator", "user-guide-sync", "readme-validator"],
  "stagesSkipped": ["book-updater"],
  "reason": "no schema/profile/workflow/notes changes since last run",
  "coverageGapsAfter": 0,
  "autoEdits": 3,
  "reportedDrift": 1
}
```

First run: no state file exists → run every stage, then create the file. Add `.refresh-pipeline/` to `.gitignore` if not already present.

---

## Flags

- `--dry-run` — resolve the change matrix and print the planned stage list. Do not execute any stage, do not write state.
- `--force-all` — ignore the state file; run every stage.
- `--skip-book` — run stages 0–4 only. Useful when the user wants a fast doc refresh and knows the book is unaffected.
- `--only <stage>` — run a single stage (by number or name: `stats`, `screengrab`, `doc-generator`, `user-guide-sync`, `readme-validator`, `book-updater`). Still respects the stage-3 → stage-2 feedback loop when relevant.

---

## Run Summary

At the end of every run (including dry runs), print a concise summary:

```
Refresh content pipeline — 2026-04-15T10:42:11Z
  Signals: 4 UI component files, 1 feature spec completed
  Stages run: stats, screengrab, doc-generator, user-guide-sync, readme-validator
  Stages skipped: book-updater (no book-material signals)
  Coverage gaps after sync: 0
  Auto-edits: 3 (README.md L120, book/ch-04 L88, book/ch-07 L44)
  Reported drift: 1 (docs/features/profile-catalog.md L12 — ambiguous export rename)
  Duration: 2m 18s
```

---

## Guidelines

- **Evidence before action.** Every stage decision must trace back to a specific file in the change matrix. If you can't explain which signal put a stage on the list, don't run it.
- **One retry on the feedback loop.** Re-invoking `/doc-generator` once is worthwhile; twice risks an infinite loop when the gap is a real content bug.
- **Auto-edit only between markers or in verified code.** Prose is off-limits. The cost of a wrong auto-edit in natural language is higher than the cost of a reported-but-unfixed drift.
- **Abort on downstream failure.** If a delegated skill fails, stop. Do not attempt to "continue with what worked" — partial refreshes make later diffs confusing.
- **Keep this skill thin.** If you find yourself writing route-discovery or YAML frontmatter parsing logic, stop — that belongs in a downstream skill. This skill's code is limited to: change detection, stats aggregation, marker/code-block validation, state file management.
- **Respect the state file.** Never delete it as a shortcut when things feel stuck — the user can pass `--force-all` if they want to ignore it.

---

## Verification

Run these checks after creating or modifying this skill:

1. **Dry-run on clean tree** — `refresh-content-pipeline --dry-run` with no changes since last run → reports "no refresh needed" and prints current state file contents.
2. **UI-only signal** — introduce one `page.tsx` change → plan should include stages 0, 1, 2, 3, 4 and skip 5.
3. **Book-trigger** — edit `src/lib/db/schema.ts` only → plan should include stages 0, 4, 5 and skip 1, 2, 3.
4. **Feedback loop** — force a coverage gap in `docs/.coverage-gaps.json` after stage 3 → verify stage 2 re-runs exactly once, then stage 3 re-verifies.
5. **Marker auto-edit** — introduce a stale `<!-- STAT:featureCount -->99<!-- /STAT -->` in README → stage 4 corrects it to the snapshot value and logs the auto-edit.
6. **Code-block rename** — rename a symbol exported from `src/lib/chat/ainative-tools/` → stage 4 updates references in README and `docs/features/*.md`.
7. **About sync** — introduce a trivial edit between `<!-- ABOUT:BEGIN … -->` and `<!-- ABOUT:END -->` in README (e.g., change "Ex Amazon AGI" to "Ex Amazon"). Run Stage 4. Expected: the block is restored to match `.claude/reference/ainative-io-about/` content, one auto-edit is logged as `auto-edit: README.md ABOUT block ← ainative.io/about`.
8. **No duplication** — `rg -n "route discovery|image copying|frontmatter parsing" .claude/skills/refresh-content-pipeline/` should return zero matches. All such logic lives in downstream skills.

---

## Coordination with Other Skills

| Situation | Response |
|-----------|----------|
| `/supervisor` reports Documentation or User Guide Sync dimensions yellow/red | User invokes `/refresh-content-pipeline` to remediate |
| `/supervisor` reports Book Health yellow/red | User invokes `/refresh-content-pipeline` (stage 5 handles book) |
| User shipped a feature and merged | Post-merge hook or manual invocation of this skill |
| User wants only screenshots refreshed | Use `/screengrab` directly — don't invoke this skill |
| User wants to verify "is anything stale?" without writing | `/refresh-content-pipeline --dry-run` |
