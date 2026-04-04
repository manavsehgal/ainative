---
name: user-guide-sync
description: Sync user guide content with screengrab and doc-generator output. Copies screenshots from screengrabs/ to public/readme/, validates journey screenshot references against existing files, detects alt-text and step-text mismatches with actual screenshot content, and reports sync status. Triggers on "sync user guide", "user guide sync", "sync screengrabs to public", "are docs in sync", "sync docs and screenshots", or after running /screengrab or /doc-generator.
---

# User Guide Sync

Reconciliation skill that ensures the three-layer documentation pipeline stays consistent:

```
/screengrab → screengrabs/*.png + manifest.json
     ↓
/doc-generator → docs/journeys/*.md (refs ../../screengrabs/*.png)
     ↓
/user-guide-sync → public/readme/*.png (copies from screengrabs/, committed to git)
                + validates refs + audits content alignment
     ↓
User Guide UI → /user-guide route renders journeys with GitHub raw URLs
              (public/readme/ is excluded from npm package)

```

```
/screengrab → /doc-generator (with coverage analysis) → /user-guide-sync (validates + writes .coverage-gaps.json)
                    ↑                                              │
                    └──────────── if gaps remain ──────────────────┘
```

The user guide UI resolves images from `public/readme/*.png` via GitHub raw URLs (`screengrabs/` → `https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/`). This skill closes the gap between where screenshots are captured and where GitHub serves them.

> **npm exclusion:** `public/readme/` is committed to git (needed for GitHub raw URLs) but excluded from the npm package via `package.json` `"files"`. Do NOT re-add `"public/"` to the files array — only specific non-readme assets are shipped.

## Role Boundaries

| Need | Skill | Not This Skill |
|------|-------|----------------|
| "Sync user guide images" | `user-guide-sync` | — |
| "Are docs in sync?" | `user-guide-sync` | — |
| "Take screenshots" | `screengrab` | `user-guide-sync` |
| "Generate journey docs" | `doc-generator` | `user-guide-sync` |
| "Fix mismatched alt text" | `doc-generator` (after sync report) | `user-guide-sync` |

## Core Principle

**Validate and copy, never modify.** This skill copies screenshots and reports mismatches — it never edits journey markdown, deletes public images, or modifies screengrab outputs. It's a read-mostly reconciliation pass that produces an actionable report.

---

## Pre-Flight Checks

Before running phases, check prerequisites:

1. **Does `screengrabs/.last-run` exist?**
   - If NO → warn "No screengrab data found. Run `/screengrab` first." Offer to auto-invoke `/screengrab`.
   - If YES → proceed

2. **Does `docs/.last-generated` exist?**
   - If NO → warn "No generated docs found. Run `/doc-generator` first." Offer to auto-invoke `/doc-generator`.
   - If YES → proceed

3. **Does `public/readme/` directory exist?**
   ```bash
   mkdir -p public/readme
   ```

---

## Phase 1: Staleness Detection

Determine what's stale by comparing timestamps across the three layers.

### 1a. Read Timestamps

```bash
# Screengrab timestamp
cat screengrabs/.last-run 2>/dev/null

# Doc-generator timestamp
cat docs/.last-generated 2>/dev/null

# Latest public/readme/ file modification time
stat -f "%m" public/readme/*.png 2>/dev/null | sort -rn | head -1
# Or check for .last-synced
cat public/readme/.last-synced 2>/dev/null
```

### 1b. Compare Timestamps

Evaluate staleness using these rules:

| Condition | Meaning | Action |
|-----------|---------|--------|
| `screengrabs/.last-run` > latest `public/readme/*.png` mod time | Screenshots newer than user guide images | Phase 2 will copy updates |
| `screengrabs/.last-run` > `docs/.last-generated` | Screenshots taken after last doc generation | Docs may reference old screenshots — warn |
| `docs/.last-generated` > `public/readme/.last-synced` | Docs updated but images not synced | Phase 2 will copy updates |
| All three within 24h of each other | Pipeline is fresh | Report as synced |

### 1c. Report Staleness

Output a staleness dashboard:

```
### Staleness Dashboard

| Layer | Timestamp | Status |
|-------|-----------|--------|
| Screengrabs | 2026-03-20T23:19:12Z | [FRESH/STALE] |
| Docs | 2026-03-21T03:52:00Z | [FRESH/STALE] |
| User Guide Images | [timestamp or NEVER] | [FRESH/STALE/MISSING] |
```

---

## Phase 2: Screenshot Sync (`screengrabs/` → `public/readme/`)

Copy screenshots from the capture directory to the public serving directory.

### 2a. Inventory Both Directories

```bash
# List screengrab PNGs
ls -1 screengrabs/*.png 2>/dev/null | xargs -I{} basename {}

# List public/readme PNGs
ls -1 public/readme/*.png 2>/dev/null | xargs -I{} basename {}
```

### 2b. Compute Diff

Classify each file into one of three categories:

| Category | Condition | Action |
|----------|-----------|--------|
| **New** | In `screengrabs/` but not in `public/readme/` | Copy |
| **Updated** | In both, but `screengrabs/` version is newer (compare mod times) | Overwrite |
| **Unchanged** | In both, same or older in `screengrabs/` | Skip |
| **Orphaned** | In `public/readme/` but not in `screengrabs/` | Warn only — do NOT delete |

### 2c. Execute Sync

For each New or Updated file:
```bash
cp screengrabs/{file}.png public/readme/{file}.png
```

**Volume note:** When the screengrab set exceeds 40 files, use per-file `cp` commands rather than glob patterns to avoid shell argument limits. Batch in groups of 20 if needed.

### 2d. Report

```
### Screenshot Sync Results

| Action | Count | Files |
|--------|-------|-------|
| Copied (new) | N | [list] |
| Updated (overwrite) | M | [list] |
| Unchanged (skipped) | K | — |
| Orphaned (warning) | J | [list — investigate these] |
```

**Orphan guidance:** Orphaned files in `public/readme/` may be:
- Screenshots manually placed there (not from `/screengrab`)
- Screenshots from a previous screengrab run that were removed in a later run
- Files the user guide UI still references — check before manual deletion

---

## Phase 3: Reference Validation

Verify that every screenshot referenced in journey docs actually exists.

### 3a. Extract References

Read all `docs/journeys/*.md` files and extract image references:

```
![alt text](../../screengrabs/{file}.png)
```

Pattern to match: `!\[([^\]]*)\]\(([^)]*\.png)\)`

### 3b. Validate Each Reference

For each extracted reference:

1. Parse the filename from the path (strip `../../screengrabs/` prefix)
2. Check: does `screengrabs/{file}.png` exist?
3. Check: does `public/readme/{file}.png` exist? (should exist after Phase 2)

### 3c. Report

```
### Reference Validation

| Journey File | Total Refs | Valid | Broken |
|-------------|-----------|-------|--------|
| developer.md | 12 | 12 | 0 |
| power-user.md | 8 | 7 | 1 |

#### Broken References
| File | Line | Reference | Issue |
|------|------|-----------|-------|
| power-user.md | 45 | workflow-builder.png | Not found in screengrabs/ |
```

---

## Phase 4: Content Alignment Audit

The most valuable phase — catches the exact class of bugs where step text describes one thing but the screenshot shows another.

### 4a. Extract Step-Screenshot Pairs

For each journey file, parse the markdown structure to extract pairs:

- **Step title** — the heading above or near the image (e.g., `### Step 3: Create a New Task`)
- **Step text** — the paragraph(s) before and/or after the image reference
- **Screenshot filename** — from the image reference
- **Alt text** — from the `![alt text]` portion

### 4b. Read Screenshots

For each referenced screenshot, read the image file using the Read tool (which supports image files). This gives visual access to what the screenshot actually shows.

### 4c. Compare Content

For each step-screenshot pair, check for alignment:

| Check | What to Look For | Mismatch Example |
|-------|-----------------|------------------|
| **Alt text accuracy** | Does the alt text describe what's visible in the screenshot? | Alt says "task list" but screenshot shows task detail |
| **Step-screenshot match** | Does the step text describe an action/view consistent with the screenshot? | Step says "click Create Task" but screenshot shows the completed task list |
| **UI element presence** | Are form fields, buttons, or labels mentioned in step text visible in the screenshot? | Step mentions "priority dropdown" but screenshot shows a page without that field |
| **View type match** | Does the screenshot show the expected view (list vs detail vs form)? | Step describes the grid view but screenshot shows table view |
| **Data consistency** | If step text mentions specific data (e.g., "the task named X"), does the screenshot show it? | Step references "Weekly Report" task but screenshot shows different tasks |
| **Overlay presence** | If step text mentions a popover/dialog, is it visible in the screenshot? | Step says "open trust tier popover" but screenshot shows sidebar without popover |
| **Toolbar state** | Does the screenshot show the expected density/view setting? | Step describes "compact view" but screenshot shows comfortable density |
| **Filter state** | If step mentions active filters, does the FilterBar show the "N active" badge? | Step says "filter by PDF" but screenshot shows unfiltered list |
| **Panel layout** | If step describes side-by-side detail, does screenshot show the right-rail? | Step says "detail pane opens" but screenshot shows full-page navigation |

**Detail view and interaction screenshots** should match journey steps that describe viewing entity details or performing specific interactions. Check that:
- The entity shown in detail screenshots matches the narrative (e.g., "Code Reviewer" profile for developer journey, "Daily Standup Summary" schedule for power user journey)
- Sub-route screenshots (e.g., `workflows-blueprints.png`) match steps about browsing templates/blueprints
- Bulk action screenshots (`dashboard-bulk-select.png`) show selected items matching the journey context
- Edit dialog screenshots (`dashboard-card-edit.png`) show form fields relevant to the task being edited
- Workflow confirmation screenshots (`dashboard-workflow-confirm.png`) show realistic multi-step workflow data

### 4d. Mismatch Report

```
### Content Alignment Audit

| File | Step | Screenshot | Issue | Suggested Fix |
|------|------|------------|-------|---------------|
| developer.md | Step 3: Create Task | dashboard-detail.png | Screenshot shows detail view, not creation form | Replace with dashboard-create-form-filled.png |
| power-user.md | Step 5: View Grid | documents-list.png | Screenshot shows list view, step describes grid | Replace with documents-grid.png |
```

**Severity levels:**
- **WRONG** — Screenshot shows clearly different content than described (highest priority)
- **STALE** — Screenshot shows the right view but outdated UI (e.g., missing new features)
- **MINOR** — Alt text could be more descriptive but screenshot is broadly correct

### 4e. New Feature Coverage Check

After completing content alignment checks, compare captured features against journey coverage:

1. Extract all unique `features` arrays from `screengrabs/manifest.json`
2. Check which features are referenced in at least one journey doc (`docs/journeys/*.md`)
3. Flag features that have screenshots but no journey coverage — these represent captured interactions that aren't yet part of any user guide

Report as:

```
### Feature Coverage Gaps

| Feature | Has Screenshots | Referenced in Journey | Action Needed |
|---------|----------------|----------------------|---------------|
| trust-tier-management | yes | no | Add to Work Use journey |
| command-palette | yes | no | Add to Power User journey |
| density-toggle | yes | no | Add to Personal Use journey |
```

This ensures the user guide eventually covers all captured interactions and no new feature falls through the cracks.

### 4e-ii. Machine-Readable Gap Output

Write the coverage gaps to `docs/.coverage-gaps.json` for consumption by `/doc-generator`:

```json
{
  "generated": "ISO-timestamp",
  "gaps": [
    {
      "feature": "environment-scanner",
      "category": "Environment Onboarding",
      "screenshots": ["environment-list.png"],
      "journeyCoverage": [],
      "suggestedPersona": "developer"
    }
  ],
  "unusedScreenshots": ["some-file.png"],
  "summary": {
    "totalFeatures": 66,
    "coveredFeatures": 39,
    "gapCount": 27,
    "unusedScreenshotCount": 0
  }
}
```

Use the same persona mapping as `/doc-generator` Phase 4.5d for the `suggestedPersona` field:

| Feature Category | Suggested Persona |
|-----------------|------------------|
| Foundation/Core | personal |
| Documents | work |
| Agent Intelligence | power-user |
| Agent Profiles | power-user |
| UI Enhancement | personal |
| Platform/Runtime | developer |
| Governance/Cost | work |
| Environment | developer |
| Chat | personal |
| Workflows | power-user |
| Schedules | power-user |
| Runtime Quality | developer |

This file enables the closed feedback loop: `/user-guide-sync` detects gaps → `/doc-generator` reads gaps and remediates journeys.

---

## Phase 5: Sync Report

Produce a final summary and write the sync timestamp.

### 5a. Summary

```
### User Guide Sync Summary

| Metric | Value |
|--------|-------|
| Images synced | N new + M updated |
| References validated | X valid / Y broken |
| Content mismatches | Z found (W wrong, V stale, U minor) |
| Overall status | IN_SYNC / NEEDS_ATTENTION / OUT_OF_SYNC |
```

**Status classification:**
- **IN_SYNC** — 0 broken references, 0 WRONG mismatches
- **NEEDS_ATTENTION** — 0 broken references, but STALE or MINOR mismatches exist
- **OUT_OF_SYNC** — broken references or WRONG mismatches found

### 5b. Write Sync Timestamp

```bash
date -u +"%Y-%m-%dT%H:%M:%SZ" > public/readme/.last-synced
```

### 5c. Recommend Next Actions

Based on findings, recommend specific actions:

| Finding | Recommendation |
|---------|---------------|
| Broken references | Run `/doc-generator` to regenerate docs, or manually fix references |
| WRONG mismatches | Run `/doc-generator` with specific fixes, or swap screenshots manually |
| STALE mismatches | Run `/screengrab` to recapture, then `/user-guide-sync` again |
| Orphaned images | Review manually — delete if unused, or add references if needed |
| Docs older than screengrabs | Run `/doc-generator` to pick up new screenshots |
| Feature coverage gaps > 0 | Run `/doc-generator` to regenerate journeys with coverage gap remediation — it will read `docs/.coverage-gaps.json` and insert missing features into appropriate persona journeys |

---

## Rules

- **Never delete** files from `public/readme/` automatically — only warn about orphans
- **Never modify** journey markdown — only report mismatches for human or `/doc-generator` to fix
- **Idempotent** — safe to run repeatedly; running twice produces the same result
- **Can auto-invoke** `/screengrab` if `screengrabs/.last-run` doesn't exist
- **Can auto-invoke** `/doc-generator` if `docs/.last-generated` doesn't exist
- **Phase 4 is the highest-value phase** — it catches the exact class of bugs where screenshots and text diverge, which was the manual fix that motivated this skill

---

## Error Recovery

| Scenario | Action |
|----------|--------|
| `screengrabs/` directory doesn't exist | Offer to run `/screengrab` |
| `docs/journeys/` directory doesn't exist | Offer to run `/doc-generator` |
| `public/readme/` doesn't exist | Create it (`mkdir -p`) |
| Image file can't be read | Log warning, skip that file in audit |
| Journey markdown has no image references | Log as info — not an error, just no images to validate |
| Timestamp file missing | Treat that layer as NEVER synced |

---

## Checklist

- [ ] Pre-flight: `screengrabs/.last-run` exists (or `/screengrab` invoked)
- [ ] Pre-flight: `docs/.last-generated` exists (or `/doc-generator` invoked)
- [ ] Pre-flight: `public/readme/` directory exists
- [ ] Phase 1: Staleness dashboard generated
- [ ] Phase 2: Screenshots diffed and synced (new + updated)
- [ ] Phase 2: Orphaned files warned (not deleted)
- [ ] Phase 3: All journey image references extracted
- [ ] Phase 3: Each reference validated against both directories
- [ ] Phase 3: Broken references reported
- [ ] Phase 4: Step-screenshot pairs extracted from journeys
- [ ] Phase 4: Each screenshot read and visually compared to step text
- [ ] Phase 4: Mismatches classified (WRONG / STALE / MINOR)
- [ ] Phase 4: Overlay/popup alignment checked
- [ ] Phase 4: Toolbar state alignment checked
- [ ] Phase 4: Mismatch report with suggested fixes generated
- [ ] Phase 4e: New feature coverage gaps reported
- [ ] Phase 4e: `.coverage-gaps.json` written with feature gap data
- [ ] Phase 5: Summary with overall sync status
- [ ] Phase 5: `.last-synced` timestamp written
- [ ] Phase 5: Next-action recommendations provided
