---
title: AI-Assisted Profile Creation & Editing UX Overhaul
status: completed
priority: P1
milestone: post-mvp
source: conversation
dependencies: [agent-profile-catalog, task-definition-ai, profile-surface-stability]
---

# AI-Assisted Profile Creation & Editing UX Overhaul

## Description

Profile creation is an expert-mode form with 12+ fields, no guidance on how each field affects agent behavior, no smart lookups, and no AI assistance. Task creation already has a proven AI Assist pattern (Sparkles button → Claude SDK → structured JSON → Apply buttons). This feature brings that same pattern to profiles: describe what you want in natural language, AI generates everything including SKILL.md, refine as needed.

Beyond AI generation, this overhaul adds three foundational UX layers: (1) field help text explaining how every field affects agent runtime behavior, (2) smart autocomplete for tags, tools, and keywords from existing data, and (3) inline smoke test definition so evals are a first-class part of profile creation — not an afterthought.

The goal is transforming profile creation from "fill out every field manually" to "describe what you want, AI fills everything, refine as needed" — making the first custom profile achievable in under 60 seconds.

## User Stories

As a **first-time user**, I want to describe my desired agent in plain language and have AI generate a complete profile so I don't need to understand every configuration field before creating my first agent.

As a **power user**, I want contextual help text on every field and smart autocomplete for tags and tools so I can configure profiles faster and with fewer errors.

As a **quality-conscious user**, I want to define smoke tests at profile creation time so my agent's behavior is verifiable from day one.

As an **iterating user**, I want AI to refine my existing SKILL.md or suggest additional tests for a profile I've already created.

## Technical Approach

### Phase 1: Field Help Text & Auto-Population
- Add descriptive "how this will be used" subtext to all 14 form fields in `ProfileFormView`
- Auto-increment version (patch bump) when editing an existing profile
- Default author to system username via `GET /api/settings/author-default`
- No structural changes — text content updates only

### Phase 2: Smart Lookups (TagInput)
- New shared `TagInput` component: comma-separated input with autocomplete Popover
- `useTagSuggestions` hook: fetches all profile tags, deduplicates, caches
- `KNOWN_TOOLS` constant: static list of Claude Code tools for tool field autocomplete
- Replace plain Input fields for tags, allowedTools, autoApprove, autoDeny, test keywords

### Phase 3: Inline Smoke Test Editor
- New `SmokeTestEditor` component as a FormSectionCard in the profile form grid
- Add/remove test rows with task textarea + keyword TagInput
- Pre-populated by AI Assist when applied
- Serialized to `ProfileSmokeTest[]` on submit

### Phase 4: AI Assist Backend
- New `POST /api/profiles/assist` endpoint following task assist pattern
- `runClaudeProfileAssist()` in claude.ts — single-turn SDK query, JSON response
- System prompt encodes SKILL.md best practices from 15 built-in profiles
- Three modes: `generate` (full profile), `refine-skillmd` (improve existing), `suggest-tests`
- Budget guardrails with `activityType: "profile_assist"`

### Phase 5: AI Assist Frontend
- New `ProfileAssistPanel` component modeled after `AIAssistPanel`
- Goal textarea + Generate button → loading states → result preview with per-section Apply buttons
- "Apply All" primary action + individual section applies
- First-time UX: clickable example prompt chips when no custom profiles exist

### Phase 6: Integration & Polish
- "Start from Template" button in ProfileBrowser → dialog of built-in profiles
- AI-generated badge (Sparkles icon) on profile cards
- "Create new profile..." link in task/workflow profile selector dropdowns
- "Refine SKILL.md" and "Suggest Tests" secondary AI actions on edit form

## Acceptance Criteria

- [ ] Every form field has descriptive help text explaining runtime impact
- [ ] Version auto-increments (patch bump) when editing an existing profile
- [ ] Author defaults to system username on new profile creation
- [ ] Tags field offers autocomplete from existing profile tags
- [ ] Allowed Tools field offers autocomplete from known tool list
- [ ] Auto-Approve/Auto-Deny fields suggest from current allowed tools
- [ ] Smoke tests can be defined inline during profile creation (add/remove/edit)
- [ ] AI Assist generates complete profile from natural language goal description
- [ ] Generated SKILL.md follows Claude Code skill best practices (frontmatter, role statement, guidelines, output format)
- [ ] Generated tests include realistic tasks with relevant expected keywords
- [ ] "Apply All" populates every form field from AI response
- [ ] Per-section Apply buttons allow selective adoption
- [ ] Profile assist usage recorded in ledger with budget enforcement
- [ ] "Start from Template" shows built-in profiles as creation starting points
- [ ] "Refine SKILL.md" mode improves existing SKILL.md content
- [ ] "Suggest Tests" mode generates tests from current SKILL.md
- [ ] First-time users see clickable example prompts

## Scope Boundaries

**Included:**
- Field help text for all profile form fields
- Smart autocomplete for tags, tools, keywords
- Auto-populated fields (version bump, author default)
- Inline smoke test editor
- AI-assisted full profile generation (generate, refine, suggest-tests modes)
- ProfileAssistPanel component with progressive disclosure
- Template dialog in profile browser
- First-time UX enhancements
- Integration links in task/workflow profile selectors

**Excluded:**
- Profile marketplace / community sharing (separate feature)
- Profile A/B testing (compare two profiles on same task) — future
- Test-driven profile creation (define evals first, auto-iterate until passing) — v2
- Profile recommendation engine based on task history — separate feature
- Natural language search in profile browser ("find me a security agent") — separate feature
- Changes to profile detail view or profile execution pipeline

## References

- Depends on: [`agent-profile-catalog`](agent-profile-catalog.md) — profile registry, form, and detail view
- Depends on: [`task-definition-ai`](task-definition-ai.md) — AI Assist pattern to clone
- Depends on: [`profile-surface-stability`](profile-surface-stability.md) — stable profile surfaces
- Related: [`agent-self-improvement`](agent-self-improvement.md) — learned context system
- Related: [`cross-provider-profile-compatibility`](cross-provider-profile-compatibility.md) — multi-runtime support
- Architecture: `ProfileFormView` at `src/components/profiles/profile-form-view.tsx`
- Architecture: AI Assist pattern at `src/components/tasks/ai-assist-panel.tsx` + `src/lib/agents/runtime/claude.ts`
