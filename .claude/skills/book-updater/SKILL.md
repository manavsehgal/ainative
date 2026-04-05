---
name: book-updater
description: Update the AI Native book chapters when dependencies change — ai-native-notes, features, Stagent API (schema, profiles, workflows), or source code. Detects what changed, regenerates affected chapters while preserving editorial standards, and syncs to the stagent.io website. Use this skill whenever the user says "update the book", "regenerate chapters", "book is stale", "sync book content", "refresh book chapters", "update book from notes", "book needs updating", or when ai-native-notes, features, schema, profiles, or API code has changed and the book should reflect those changes. Also trigger after adding new case studies, research notes, or Situational Awareness content.
---

# Book Updater Skill

Update AI Native book chapters when their upstream dependencies change, then propagate to the stagent.io website.

## Book Stats (keep current)

| Metric | Value |
|--------|-------|
| Chapters | 12 |
| Parts | 4 |
| Total Words | 33,627 |
| Avg Words/Chapter | 2,802 |
| Total Reading Time | 156 min (2.6 hrs) |
| Est. Paperback Pages | ~135 (at 250 words/page) |
| Case Studies | 43 across 10+ entities |
| Code Examples | 15 TypeScript blocks |
| Callout Types | case-study (primary) |
| License | Apache 2.0 (repository-level) |

### Chapter Inventory

| Ch | Title | Part | Words | Reading Time |
|----|-------|------|-------|-------------|
| 1 | From Hierarchy to Intelligence | 1 | 3,866 | 14 min |
| 2 | The AI-Native Blueprint | 1 | 3,050 | 12 min |
| 3 | The Refinery | 2 | 2,379 | 15 min |
| 4 | The Forge | 2 | 2,825 | 16 min |
| 5 | Blueprints | 2 | 2,342 | 14 min |
| 6 | The Arena | 3 | 2,601 | 12 min |
| 7 | Institutional Memory | 3 | 2,397 | 14 min |
| 8 | The Swarm | 3 | 2,587 | 16 min |
| 9 | The Governance Layer | 3 | 3,184 | 13 min |
| 10 | The World Model | 4 | 2,699 | 15 min |
| 11 | The Machine That Builds Machines | 4 | 3,281 | 14 min |
| 12 | The Road Ahead | 4 | 2,416 | 10 min |

**After any update, recount words and update this table and the stats above.** Use `wc -w book/chapters/*.md` for totals and per-chapter counts. Paperback pages = total words / 250 (rounded up).

---

## Phase 1: Detect What Changed

Determine which upstream dependencies have changed since the last book update. The `lastGeneratedBy` timestamp in each chapter's frontmatter marks when it was last regenerated.

### Dependency Graph

```
ai-native-notes/*.md ──────────┐
ai-native-notes/situational-awareness/*.md ─┤
features/roadmap.md ───────────┤
features/*.md (per-feature) ───┤
src/lib/db/schema.ts ──────────┤──→ chapter-mapping.ts ──→ book/chapters/*.md
src/lib/agents/profiles/ ──────┤                              │
src/lib/agents/execution-manager.ts ─┤                        │
src/lib/workflows/ ────────────┤                              │
src/lib/schedules/ ────────────┤                              ▼
src/lib/documents/ ────────────┘                   stagent.github.io
ai-native-notes/ai-native-book-strategy.md ──→ (editorial constraints for all chapters)
```

### Change Detection Commands

```bash
# 1. Check ai-native-notes changes since last book generation
LAST_BOOK_COMMIT=$(git log -1 --format=%H -- book/chapters/)
git diff --name-only $LAST_BOOK_COMMIT HEAD -- ai-native-notes/

# 2. Check source code changes that chapters reference
git diff --name-only $LAST_BOOK_COMMIT HEAD -- src/lib/db/schema.ts src/lib/agents/ src/lib/workflows/ src/lib/schedules/ src/lib/documents/

# 3. Check feature spec changes
git diff --name-only $LAST_BOOK_COMMIT HEAD -- features/

# 4. Check chapter-mapping for new/changed mappings
git diff --name-only $LAST_BOOK_COMMIT HEAD -- src/lib/book/chapter-mapping.ts
```

### Map Changes to Affected Chapters

Read `src/lib/book/chapter-mapping.ts` — it maps each chapter to its specific dependencies (docs, sourceFiles, caseStudies). Cross-reference changed files against this mapping to determine which chapters need regeneration.

Key mappings:
- **schema.ts changes** → Ch 2, 3, 7, 10 (blueprint, refinery, memory, world model)
- **profiles/ changes** → Ch 4, 7, 8, 9 (forge, memory, swarm, governance)
- **workflows/ changes** → Ch 5, 10, 12 (blueprints, world model, road ahead)
- **schedules/ changes** → Ch 6, 10, 12 (arena, world model, road ahead)
- **documents/ changes** → Ch 3 (refinery)
- **New ai-native-notes** → Chapters mapped via caseStudies in chapter-mapping.ts
- **Book strategy changes** → ALL chapters (editorial constraints apply globally)

---

## Phase 2: Regenerate Affected Chapters

### Chapter Generation Approach

Each chapter update follows this pattern:

1. **Read the current chapter** — understand existing structure, sections, case studies, code examples
2. **Read changed dependencies** — the specific files that triggered this update
3. **Read the book strategy** — `ai-native-notes/ai-native-book-strategy.md` for editorial constraints
4. **Edit surgically** — modify only sections affected by the changes; preserve the rest

The book is 33,600+ words of carefully crafted prose. **Do not regenerate entire chapters for incremental changes.** Surgical edits preserve voice consistency and prevent regression of previously reviewed content.

### Chapter Structure Convention

Every chapter follows this structure:

```markdown
---
title: "Chapter Title"
subtitle: "Chapter Subtitle"
chapter: N
part: N
readingTime: X
lastGeneratedBy: "ISO-timestamp"
relatedDocs: ["slug1", "slug2"]
relatedJourney: "journey-slug"
---

## Opening Section (thesis + narrative hook)

> [!case-study]
> **Company/Author** — Key insight with attribution.

## Technical Sections (2-4 per chapter)

```typescript
// Building with Stagent: description
// Realistic code example from actual API
```

## Stagent Today (current implementation state)

## Roadmap Vision (future directions)
```

### Required Sections

- **Opening**: Thesis statement + narrative context
- **Case studies**: `> [!case-study]` blocks with inline attribution
- **Code examples**: TypeScript using real Stagent API patterns
- **Stagent Today**: Current state of implementation (grounded in code)
- **Roadmap Vision**: Future directions with concrete next steps

---

## Phase 3: Editorial Standards

These standards were established across 12 chapters and must be preserved during updates. Read `references/editorial-standards.md` for the complete reference.

### Content Integration (Altitude Matching)

When integrating external research (from ai-native-notes), follow the altitude matching principle from the book strategy:

1. **Translate, don't transplant.** Express external concepts through existing book patterns and case studies. "Scalable oversight" becomes "the swarm coordinator as a governance mechanism."
2. **Maintain practitioner tone.** Frame as engineering decisions, not predictions. "The trendlines have not stopped" — not "AGI by 2027."
3. **Connect to existing patterns.** Every addition must reference at least one chapter, case study, or Stagent feature.
4. **Respect the grounding principle.** Every claim maps to running code. External research without implementation connections gets a pointer ("see X for the macro trajectory"), not absorption.

### Forbidden Patterns

After any chapter update, verify none of these appear in book chapters:

```bash
# Tone check — run after every update
grep -ri "superintelligence\|AGI by 2027\|existential risk\|national security\|geopolitical" book/chapters/
```

**Never include in book chapters:**
- The word "superintelligence"
- Specific AGI timeline predictions
- Geopolitical competition framing (US vs China, national security)
- Civilizational-stakes rhetoric ("most important century," existential risk)
- Infrastructure economics (TSMC fabs, datacenter locations, CHIPS Act)
- Content without connection to at least one Stagent feature or case study

The single pre-existing use of "existential" in Ch 12 (referring to business decisions) is acceptable.

### Case Study Attribution Format

All case studies use inline attribution (no footnotes). Three patterns:

**Pattern 1: Company/Author — "Quote" — Source, Date**
```markdown
> [!case-study]
> **Sequoia/Block** — "Hierarchy is an information routing protocol..." — Jack Dorsey & Roelof Botha, *Hierarchy Collapses When Intelligence Is Cheap*, March 2026.
```

**Pattern 2: System Name — Description with attribution**
```markdown
> [!case-study]
> **Harvey Spectre** -- "The beginning of a company world model..." Monitoring-triggered description.
```

**Pattern 3: Pattern Name — Results with attribution**
```markdown
> [!case-study]
> **Geoffrey Huntley's Ralph Wiggum Technique** -- Description with $50K for $297 results.
```

### Copyright & Licensing

- **Book content**: Covered by repository-level Apache 2.0 license (Manav Sehgal, 2025)
- **Case studies**: Use fair-use excerpts with proper inline attribution (author, title, date)
- **External research** (Aschenbrenner, Anthropic, etc.): Reference by name with citations; quote briefly for commentary/criticism under fair use
- **Code examples**: All TypeScript examples demonstrate Stagent's own API; no third-party code
- **No full reproduction** of external articles — only quotes, data points, and framework descriptions with attribution
- **Case study sources** are publicly available blog posts, essays, and conference talks; attribution preserves the source relationship

### Integrated External Sources

| Source | What It Provides | Chapters Using It |
|---|---|---|
| Aschenbrenner, *Situational Awareness* (2024) | OOMs framework, compute trajectory, alignment governance, RSI bottlenecks | Ch 1, 4, 6, 9, 11, 12 |
| Anthropic Autonomy Research (Feb 2026) | Autonomy as co-constructed concept | Ch 9 |
| Sequoia/Block essay (Mar 2026) | IC/DRI/Player-Coach roles, dual world models | Ch 1, 10, 12 |
| ICLR 2026 RSI Workshop | Recursive self-improvement patterns | Ch 11 |
| Stripe engineering blog (Feb 2026) | Minions architecture, 1300+ PRs/week | Ch 2, 3, 4, 5, 8, 9, 12 |
| Ramp engineering blog | Inspect system, 30% of PRs | Ch 2, 3, 4, 9, 12 |
| Harvey/Gabe Pereyra | Coordination agents, legal transformation | Ch 1, 4, 8, 9, 10, 12 |
| 8090/Chamath Palihapitiya | Software Factory, Assembly Lines | Ch 1, 2, 3, 7, 10, 12 |
| Karpathy | Autoresearch, AGENT.md | Ch 2, 5, 6, 7, 8, 11, 12 |
| Gas Town/Steve Yegge | NDI, MEOW, Deacon patrol | Ch 5, 6, 8 |

### Voice & Tone

- **First-person plural** ("we have built," "our approach")
- **Technical-approachable**: assumes engineering literacy, avoids jargon walls
- **Show, don't tell**: every claim backed by code example, case study, or data point
- **Practitioner-focused**: "here is what works" over "here is what might work"
- **Reading time**: ~250 words/minute; update `readingTime` frontmatter when word count changes significantly

---

## Phase 4: Update Chapter Mapping

If new dependencies were added (new ai-native-notes, new source files, new features), update `src/lib/book/chapter-mapping.ts`:

```typescript
// Add new case study to relevant chapters
"ch-1": {
  docs: [],
  caseStudies: ["sequoa-hierarchy-to-intelligence", "harvey-legal-is-next", "making-machine-that-builds-machines", "new-case-study-slug"],
},
```

Also update the `CHAPTER_SLUGS` map if chapters are added/renamed/removed.

---

## Phase 5: Update Frontmatter

After editing any chapter, update its frontmatter:

```yaml
lastGeneratedBy: "2026-04-05T00:00:00.000Z"  # Current date
readingTime: X  # Recalculate: wc -w chapter.md / 250, rounded
```

---

## Phase 6: Verify

### Content Verification

```bash
# 1. Word counts (update stats table)
wc -w book/chapters/*.md

# 2. Tone check
grep -ri "superintelligence\|AGI by 2027\|existential risk\|national security\|geopolitical" book/chapters/

# 3. Verify all case studies have attribution
grep -c "\[!case-study\]" book/chapters/*.md

# 4. Verify all chapters have required sections
for f in book/chapters/*.md; do
  echo "=== $(basename $f) ==="
  grep -c "## Stagent Today\|## Roadmap Vision" "$f"
done

# 5. Verify code examples reference real API
grep -l '```typescript' book/chapters/*.md
```

### Build Verification

```bash
# Ensure the Stagent app still builds
npm run build 2>&1 | tail -5
```

---

## Phase 7: Propagate to stagent.io Website

After updating book chapters in the Stagent repo, sync to the website.

### Option A: Invoke the Apply Book Update Skill

If working in the stagent.github.io repo, invoke `/apply-book-update` — that skill handles the full sync workflow (compare, copy, update code files, verify build).

### Option B: Update the Apply Book Update Skill

If the book's structure has changed (new chapters, new parts, new callout types, changed frontmatter fields), also update the downstream skill at:

```
/Users/manavsehgal/Developer/stagent.github.io/.claude/skills/apply-book-update/SKILL.md
```

Updates needed when:
- **Chapters added/removed/renamed** → Update the Chapter Manifest table
- **New callout types** → Add to steps 5b-5e (types, parser, component, CSS)
- **Part structure changed** → Update part assignments in step 5a
- **New frontmatter fields** → Update the Chapter File Format section
- **Word counts changed** → Update `wordCount` values in `src/lib/book/content.ts` (run `wc -w` on each chapter); landing page stats (words, pages) are computed dynamically from these values

The apply-book-update skill should always reflect the current book structure. After updating it, the skill's Chapter Manifest should match this skill's Chapter Inventory table.

### Website Files Affected by Book Changes

| File | When to Update |
|------|---------------|
| `src/data/book/chapters/*.md` | Every sync |
| `public/book/images/*` | Every sync |
| `src/lib/book/content.ts` | Chapters added/removed/reordered, or wordCount changes |
| `src/lib/book/types.ts` | New callout variants |
| `src/lib/book/markdown-parser.ts` | New callout variants |
| `src/components/book/content-blocks.tsx` | New callout variants |
| `src/styles/book.css` | New callout variants |
| `src/lib/book/reading-paths.ts` | Chapters added/removed |
| `src/pages/book/index.astro` | Stats are dynamic — no manual updates needed |

### Landing Page Stats Architecture

The book landing page computes all hero stats dynamically from `content.ts`:

- `totalReadingTime` = sum of `CHAPTERS[].readingTime`
- `totalWords` = sum of `CHAPTERS[].wordCount`
- `totalPages` = `ceil(totalWords / 250)`

Hero displays: chapters, reading time, parts, **words**, **pages**. JSON-LD uses `numberOfPages: totalPages`.

**When syncing, always update `wordCount` in content.ts** by running `wc -w` on each source chapter file. All landing page stats derive from it automatically.

### Trailing Slash Requirement

The website has `trailingSlash: 'always'` in `astro.config.mjs`. All book URLs must end with `/`:

- Correct: `/book/ch-1-from-hierarchy-to-intelligence/`
- Wrong: `/book/ch-1-from-hierarchy-to-intelligence` (404)

When verifying after sync, always use trailing slashes in dev server URLs.

---

## Phase 8: Report

Produce a summary of what was updated:

```markdown
## Book Update Report

### Trigger
[What changed: new ai-native-notes, schema update, feature addition, etc.]

### Chapters Modified
- Ch X: [section added/updated, reason]
- Ch Y: [section added/updated, reason]

### Stats (updated)
| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Total Words | X | Y | +Z |
| Paperback Pages | X | Y | +Z |
| Reading Time | X min | Y min | +Z min |

### Editorial Checks
- [ ] Tone check passed (no forbidden terms)
- [ ] All case studies attributed
- [ ] All chapters have Stagent Today + Roadmap Vision
- [ ] Code examples reference real API
- [ ] Frontmatter updated (lastGeneratedBy, readingTime)
- [ ] Chapter mapping updated if new dependencies

### Website Sync
- [ ] Chapters copied to stagent.github.io
- [ ] Code files updated (if structural change)
- [ ] Build verified
- [ ] apply-book-update skill updated (if structure changed)
```
