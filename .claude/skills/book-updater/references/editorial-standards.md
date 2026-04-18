# AI Native Business Book — Editorial Standards Reference

This document captures the full editorial standards, conventions, and patterns established across 12 chapters and 33,600+ words of the AI Native Business book. It serves as the definitive reference for maintaining consistency during chapter updates.

## Table of Contents

1. [Book Architecture](#book-architecture)
2. [Chapter Structure Convention](#chapter-structure-convention)
3. [Case Study Attribution Patterns](#case-study-attribution-patterns)
4. [Code Example Standards](#code-example-standards)
5. [External Research Integration](#external-research-integration)
6. [Copyright and Fair Use](#copyright-and-fair-use)
7. [Voice and Tone](#voice-and-tone)
8. [Forbidden Patterns](#forbidden-patterns)
9. [Frontmatter Specification](#frontmatter-specification)
10. [Dependency Sources](#dependency-sources)
11. [Case Study Inventory](#case-study-inventory)
12. [Book Pipeline](#book-pipeline)

---

## Book Architecture

### 4 Parts, 12 Chapters

| Part | Title | Theme | Chapters |
|------|-------|-------|----------|
| 1 | The Thesis | Why AI changes organizational design | Ch 1-2 |
| 2 | The Factory Floor | Implementation: intake, execution, orchestration | Ch 3-6 |
| 3 | The Intelligence Layer | Memory, coordination, governance | Ch 7-9 |
| 4 | The Autonomous Organization | World model, self-building, future | Ch 10-12 |

### Narrative Arc

The book traces a progression:
1. **Historical analysis** (2,000 years of hierarchy) → why the constraint is breaking
2. **Factory metaphor** → concrete architecture for what replaces hierarchy
3. **Implementation** → working code for each station in the factory
4. **Autonomy** → governance, memory, and self-improvement patterns
5. **Recursion** → the book building itself as proof of the system

### Reader Personas

- **Skeptic** (Ch 1-2): Needs proof that AI-native organizations work
- **Builder** (Ch 3-6): Needs copy-paste patterns and configurations
- **Visionary** (Ch 7-12): Needs advanced patterns and future directions

---

## Chapter Structure Convention

Every chapter follows this skeleton. Sections may be named differently but the roles remain:

### Required Sections

1. **Opening** (thesis + narrative hook)
   - States the chapter's core argument in the first 2-3 paragraphs
   - Connects to the factory metaphor or the book's overall thesis
   - Often opens with a case study callout

2. **Technical Sections** (2-4 per chapter)
   - Deep dive into specific patterns, architectures, or mechanisms
   - Mix narrative prose with code examples
   - Case studies woven into the argument (not appended as sidebars)

3. **ainative Today**
   - Inventory of what currently exists in the codebase
   - References specific files: `src/lib/agents/execution-manager.ts`, etc.
   - Grounded in real implementation, not aspirational claims

4. **Roadmap Vision**
   - Future directions with concrete next steps
   - Connected to case study patterns (e.g., "Gas Town's NDI pattern → crash-surviving sessions")
   - Honest about what's implemented vs. what's planned

### Content Blocks

The markdown uses these block types:

```markdown
## Section Title                         (H2 only — no deeper nesting)

> [!case-study]                          (case study callout)
> **Company** — "Quote" — Source, Date.

```typescript                            (code example — TypeScript only)
// Building with ainative: description
const result = await fetch("/api/...");
```

Standard **bold**, *italic*, `inline code`, and > blockquote formatting.
```

---

## Case Study Attribution Patterns

### Three Attribution Formats

**Format 1: Formal quote with source citation**
Used for published essays, blog posts, and conference talks.
```markdown
> [!case-study]
> **Sequoia/Block** — "Hierarchy is an information routing protocol built around a simple
> human limitation." — Jack Dorsey & Roelof Botha, *Hierarchy Collapses When Intelligence
> Is Cheap*, March 2026.
```

**Format 2: System description with company name**
Used for product/architecture descriptions.
```markdown
> [!case-study]
> **Stripe Minions** -- Over 1,300 pull requests merged per week, fully unattended.
> Human-reviewed, zero human-written code.
```

**Format 3: Named pattern with results**
Used for techniques and methodologies.
```markdown
> [!case-study]
> **Geoffrey Huntley's Ralph Wiggum Technique** -- `while :; do cat PROMPT.md | claude-code; done`
> One engineer completed a $50K contract for $297 in API costs.
```

### Attribution Rules

- **Always name the company/person** — never "one company" or "a researcher"
- **Include dates** when available (month + year for published materials)
- **Quote directly** when the original wording carries insight; paraphrase for facts
- **No footnotes** — all attribution is inline within the case study block
- **Italicize titles** of published works: *Situational Awareness*, *Hierarchy Collapses When Intelligence Is Cheap*

---

## Code Example Standards

### TypeScript Only

All code examples use TypeScript. The book is about ainative, which is TypeScript.

### Realistic API Patterns

Code examples demonstrate real ainative API usage:

```typescript
// Building with ainative: [descriptive label]
const task = await fetch("/api/tasks", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: "Descriptive task title",
    projectId: "proj-8f3a-4b2c",  // Realistic UUIDs
    assignedAgent: "claude-code",
    agentProfile: "code-reviewer",
    priority: 1,
  }),
}).then((r) => r.json());
```

### Code Example Rules

- **Comment the first line** with `// Building with ainative: [what this demonstrates]`
- **Use realistic data** — UUIDs, timestamps, project names
- **Comment non-obvious lines** but not every line
- **Show the happy path** — error handling only when it's the teaching point
- **Reference real API routes** — `/api/tasks`, `/api/profiles`, `/api/settings`, etc.
- **One example per concept** — keep examples focused on a single pattern

---

## External Research Integration

### The Altitude Matching Principle

The book operates at the **implementation layer**. External sources often operate at higher altitudes (macro-strategic, geopolitical). When incorporating external material:

1. **Translate, don't transplant.** Every external concept must be expressed through existing book patterns. Example: Aschenbrenner's "OOMs of progress" becomes "the quantitative explanation for why Stripe went from zero to 1,300 agent PRs per week."

2. **Maintain practitioner tone.** Frame as engineering decisions, not predictions or warnings. Say "the trendlines have not stopped" — not "AGI by 2027."

3. **Connect to existing patterns.** Every addition must reference at least one chapter, case study, or ainative feature.

4. **Respect the grounding principle.** The book's credibility comes from every claim mapping to running code. External research that cannot be connected to implementation patterns gets a pointer reference ("see X for the macro trajectory"), not narrative absorption.

### Integration Examples

**Good (altitude-matched):**
> Aschenbrenner's analysis decomposes progress into three sources: compute scaling, algorithmic efficiency, and "unhobbling" — the transition from chatbot to agent that this entire book depends on.

**Bad (altitude mismatch):**
> AGI is expected by 2027, which will lead to an intelligence explosion producing superintelligence within 1-2 years.

**Good (connected to pattern):**
> The "evaluation is easier than generation" principle from alignment research is the theoretical foundation for Stripe's CI-gates-as-governance approach.

**Bad (disconnected):**
> Alignment research shows that current techniques may break down at superhuman capability levels.

---

## Copyright and Fair Use

### License
The entire ainative repository, including book content, is licensed under **Apache 2.0** (Copyright 2025, Manav Sehgal).

### Fair Use of External Sources
- **Case studies** draw from publicly available blog posts, essays, and conference talks
- **Quotes** are brief excerpts used for commentary and criticism (fair use)
- **Data points** (1,300 PRs/week, 30% of PRs, $297 API cost) are factual claims with attribution
- **Frameworks** (OOMs, factory metaphor) are described with attribution to originator
- **No full reproduction** of external articles — only selected quotes, data, and framework descriptions

### Attribution Requirements
- Name the author and company for every case study
- Include the publication title (italicized) and date when available
- For recurring case studies (Stripe appears in 7 chapters), the first mention in each chapter includes full attribution; subsequent mentions in the same chapter can use shorthand

### Code Examples
- All TypeScript examples demonstrate ainative's own API
- No third-party code is reproduced
- API patterns are original implementations

---

## Voice and Tone

### Person
- **First-person plural**: "we have built," "our approach," "we discovered"
- Positions the reader alongside the author as co-builders

### Register
- **Technical-approachable**: assumes engineering literacy, avoids jargon walls
- Explains concepts when first introduced, then uses them freely
- Uses analogies to ground abstract concepts (factory metaphor, arena metaphor)

### Stance
- **Show, don't tell**: every claim backed by code, case study, or data
- **Practitioner-focused**: "here is what works" over "here is what might work"
- **Honest about limitations**: "ainative Today" sections state exactly what exists vs. what's planned
- **No hype**: let the case study numbers speak (1,300 PRs/week, $297 for $50K contract)

### Formatting
- Prose paragraphs (not bullet lists) for narrative sections
- Bullet lists only for inventories (features, files, profiles)
- Bold for terms being defined: **Directly Responsible Individuals (DRIs)**
- Inline code for file paths, function names, and CLI commands: `src/lib/agents/execution-manager.ts`

---

## Forbidden Patterns

The following must never appear in book chapters:

| Pattern | Why |
|---------|-----|
| "superintelligence" | Adopts civilizational framing that undermines practitioner credibility |
| "AGI by 2027" (or any specific AGI timeline) | Book's thesis works without AGI — agents are already capable enough |
| "existential risk" | Wrong altitude — the book is about building organizations |
| "national security" | Geopolitical framing doesn't belong in an architecture book |
| "geopolitical" | See above |
| TSMC, CHIPS Act, datacenter locations | Infrastructure economics ≠ organizational architecture |
| "most important century" | Civilizational rhetoric destroys practitioner credibility |
| Predictions about job loss percentages | Speculative; the book describes what's being built, not what will be lost |

**Exception**: "existential" may appear in business context ("the cost of being wrong is existential" in Ch 12, referring to business decisions).

### Tone Check Command

```bash
grep -rni "superintelligence\|AGI by 2027\|existential risk\|national security\|geopolitical\|most important century\|TSMC\|CHIPS Act" book/chapters/
```

Run after every chapter update. Zero matches expected (except the Ch 12 "existential" business usage).

---

## Frontmatter Specification

```yaml
---
title: "Chapter Title"              # Required. In quotes.
subtitle: "Chapter Subtitle"        # Required. In quotes.
chapter: N                          # Required. Integer 1-12.
part: N                             # Required. Integer 1-4.
readingTime: X                      # Required. Minutes (words / 250, rounded).
lastGeneratedBy: "ISO-timestamp"    # Required. When chapter was last updated.
relatedDocs: ["slug1", "slug2"]     # Optional. Playbook feature doc slugs.
relatedJourney: "journey-slug"      # Optional. One of: personal-use, work-use, power-user, developer.
---
```

### Part Assignments

- Part 1: Ch 1-2
- Part 2: Ch 3-6
- Part 3: Ch 7-9
- Part 4: Ch 10-12

---

## Dependency Sources

### Primary Source: `src/lib/book/chapter-mapping.ts`

This file is the single source of truth for which dependencies feed each chapter:

```typescript
export const CHAPTER_MAPPING: Record<string, ChapterMapping> = {
  "ch-1": {
    docs: [],
    caseStudies: ["sequoa-hierarchy-to-intelligence", "harvey-legal-is-next", "making-machine-that-builds-machines"],
  },
  "ch-2": {
    docs: ["home-workspace", "dashboard-kanban"],
    sourceFiles: ["src/lib/db/schema.ts"],
    caseStudies: ["stripe-minions", "ramp-background-agent", "karpathy-one-gpu-research-lab", "making-machine-that-builds-machines"],
  },
  // ... (read the file for full mapping)
};
```

### Global Dependencies (affect all chapters)

- `ai-native-notes/ai-native-book-strategy.md` — editorial strategy
- `src/lib/db/schema.ts` — referenced by multiple chapters for "10 tables" claim (now 43 tables; chapters reference the core 10)

---

## Case Study Inventory

### Primary Case Studies (recurring across chapters)

| Entity | Key Claim | Appearances |
|--------|-----------|-------------|
| Stripe Minions | 1,300+ PRs/week, zero human-written code | Ch 2,3,4,5,8,9,12 |
| Ramp Inspect | 30% of merged PRs from agents | Ch 2,3,4,9,12 |
| Harvey Spectre | Monitoring-triggered coordination agents | Ch 1,4,8,9,10,12 |
| 8090/Chamath | Software Factory, Assembly Lines, Knowledge Graph | Ch 1,2,3,7,10,12 |
| Sequoia/Block | Hierarchy → Intelligence, dual world models | Ch 1,10,12 |
| Karpathy | 100 experiments/night, AGENT.md, autoresearch | Ch 2,5,6,7,8,11,12 |
| Gas Town/Yegge | NDI, MEOW, Mayor/Polecats/Deacon | Ch 5,6,8 |
| Geoffrey Huntley | Ralph Wiggum loop, $50K for $297 | Ch 5,6 |
| Aschenbrenner | OOMs framework, alignment governance, RSI bottlenecks | Ch 1,4,6,9,11,12 |
| Anthropic | Autonomy research (Feb 2026) | Ch 9 |

### Data Points Referenced

These specific numbers are used across chapters and should remain consistent:

- Stripe: **1,300+ PRs per week**
- Ramp: **30% of merged PRs**
- Karpathy: **100 experiments overnight**, single GPU, 5-min budget per experiment
- Ralph Wiggum: **$50K contract for $297** API costs
- Gas Town: **75,000 lines of Go**, 2,000 commits, 17 days
- Harvey: **coordination agents > production agents**
- Trust gap: **11% of organizations** have agents in production
- Cost differential: **$0.03-$0.25/min** (agent) vs **$3-$6.50/min** (human)
- Devin: **67% merge rate**

---

## Book Pipeline

The book is self-generating (described in Ch 11). The generation pipeline:

1. **Capture** — `/capture` skill scrapes articles → `ai-native-notes/`
2. **Chapter Mapping** — `src/lib/book/chapter-mapping.ts` maps dependencies
3. **Chapter Generator** — `src/lib/book/chapter-generator.ts` builds prompts from mappings
4. **Document Writer** — Agent profile generates/updates chapter markdown
5. **Quality Review** — Two-pass review (terminology, API accuracy, attribution, structure)
6. **Freshness Detection** — `src/lib/book/update-detector.ts` flags stale chapters via git

### Key Infrastructure Files

| File | Purpose |
|------|---------|
| `src/lib/book/chapter-mapping.ts` | Dependency graph: chapter → docs, sources, case studies |
| `src/lib/book/chapter-generator.ts` | Prompt assembly for chapter generation |
| `src/lib/book/content.ts` | Runtime chapter loader |
| `src/lib/book/update-detector.ts` | Git-based staleness detection |
| `ai-native-notes/ai-native-book-strategy.md` | Master editorial strategy |
| `book/chapters/*.md` | Output: 12 chapter markdown files |
