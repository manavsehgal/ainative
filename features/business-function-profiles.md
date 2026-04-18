---
title: Business Function Profiles
status: completed
priority: P1
milestone: post-mvp
source: ideas/vision/machine-builds-machine-claude-ext-rsrch.md
dependencies: [agent-profile-catalog, workflow-blueprints]
---

# Business Function Profiles

## Description

Add 6 new builtin agent profiles targeting core business functions — marketing, sales, customer support, finance, content, and operations — plus 5 new workflow blueprints that compose these profiles into common business processes. Each profile ships with genuine domain-knowledge SKILL.md instructions, not generic placeholders.

Existing 14 profiles (general, code-reviewer, researcher, document-writer, project-manager, technical-writer, data-analyst, devops-engineer, sweep, wealth-manager, health-fitness-coach, travel-planner, shopping-assistant, learning-coach) remain untouched. These are ADDITIONS that expand the profile catalog toward business operations, making the "AI Business Operating System" positioning concrete and immediately usable.

The profiles and blueprints use the existing `profile.yaml` + `SKILL.md` format and the existing `WorkflowBlueprint` YAML format. No new infrastructure is required — this is content creation within established frameworks.

## User Story

As a solo founder, I want to deploy AI agents for marketing, sales, support, and finance from day one, so that I can run business operations without hiring a team.

## Technical Approach

### New Agent Profiles (6)

Each profile gets a directory in `src/lib/agents/profiles/builtins/` with `profile.yaml` and `SKILL.md`.

**1. `marketing-strategist`**
- **Domain:** work
- **Tags:** marketing, strategy, campaigns, seo, social-media, email, content-planning
- **SKILL.md focus:** Market research and competitive analysis, content calendar planning, SEO keyword strategy, email campaign design, social media content planning, marketing metrics analysis (CAC, LTV, conversion rates). Emphasis on data-driven decision making and growth frameworks (AARRR pirate metrics, Jobs-to-be-Done).
- **Allowed tools:** Read, Grep, Glob, WebSearch, WebFetch, Write, Edit
- **Auto-approve:** Read, Grep, Glob, WebSearch, WebFetch
- **Preferred runtime:** anthropic-direct
- **Max turns:** 25
- **Tests:** `[{task: "Create a content marketing strategy for a B2B SaaS startup", expectedKeywords: [audience, funnel, content-calendar, seo, conversion]}]`

**2. `sales-researcher`**
- **Domain:** work
- **Tags:** sales, research, leads, prospecting, outreach, crm, pipeline
- **SKILL.md focus:** Lead identification and qualification frameworks (BANT, MEDDIC), prospect research methodology, personalized outreach templates, competitive intelligence gathering, pipeline analysis and forecasting. Structured output for CRM import.
- **Allowed tools:** Read, Grep, Glob, WebSearch, WebFetch, Write
- **Auto-approve:** Read, Grep, Glob, WebSearch, WebFetch
- **Preferred runtime:** anthropic-direct
- **Max turns:** 20
- **Tests:** `[{task: "Research potential leads for an AI consulting firm", expectedKeywords: [lead, qualification, outreach, personalized, pipeline]}]`

**3. `customer-support-agent`**
- **Domain:** work
- **Tags:** support, customer-service, triage, tickets, escalation, knowledge-base
- **SKILL.md focus:** Ticket classification (urgency, category, sentiment), response template selection, knowledge base search patterns, escalation criteria, tone calibration for different customer emotions, resolution tracking. Emphasis on empathy, clarity, and first-contact resolution.
- **Allowed tools:** Read, Grep, Glob, WebSearch, WebFetch, Write
- **Auto-approve:** Read, Grep, Glob, WebSearch
- **Auto-deny:** Bash (prevent system access from support context)
- **Preferred runtime:** anthropic-direct
- **Max turns:** 15
- **Tests:** `[{task: "Classify and respond to a frustrated customer complaint about billing", expectedKeywords: [empathy, resolution, escalation, follow-up]}]`

**4. `financial-analyst`**
- **Domain:** work
- **Tags:** finance, analysis, budgeting, forecasting, reporting, metrics, revenue
- **SKILL.md focus:** Financial statement analysis, budget variance reporting, cash flow forecasting, unit economics calculation (MRR, ARR, churn, burn rate), investor reporting formats, expense categorization. Emphasis on accuracy, source citation, and clearly stating assumptions.
- **Allowed tools:** Read, Grep, Glob, Write
- **Auto-approve:** Read, Grep, Glob
- **Auto-deny:** Bash, Edit (prevent mutation of financial data files)
- **Preferred runtime:** anthropic-direct
- **Max turns:** 20
- **Tests:** `[{task: "Analyze monthly revenue data and create a financial summary", expectedKeywords: [revenue, margin, forecast, trend, variance]}]`

**5. `content-creator`**
- **Domain:** work
- **Tags:** content, writing, blog, copywriting, social-media, newsletter, editing
- **SKILL.md focus:** Content creation across formats (blog posts, social media, newsletters, landing page copy, email sequences), brand voice consistency, headline optimization, SEO-aware writing, editing checklists (clarity, grammar, tone, CTA effectiveness). Emphasis on audience-appropriate voice and measurable content goals.
- **Allowed tools:** Read, Grep, Glob, WebSearch, WebFetch, Write, Edit
- **Auto-approve:** Read, Grep, Glob, WebSearch, WebFetch
- **Preferred runtime:** anthropic-direct
- **Max turns:** 25
- **Tests:** `[{task: "Write a blog post about AI automation for small businesses", expectedKeywords: [audience, headline, structure, cta, seo]}]`

**6. `operations-coordinator`**
- **Domain:** work
- **Tags:** operations, coordination, process, sop, reporting, efficiency, logistics
- **SKILL.md focus:** Standard operating procedure documentation, process mapping and optimization, cross-functional coordination plans, operational metrics dashboards (throughput, cycle time, error rate), vendor management checklists, incident response playbooks. Emphasis on clarity, repeatability, and measurable outcomes.
- **Allowed tools:** Read, Grep, Glob, Write, Edit, Bash
- **Auto-approve:** Read, Grep, Glob
- **Preferred runtime:** anthropic-direct
- **Max turns:** 20
- **Tests:** `[{task: "Document the standard operating procedure for onboarding a new client", expectedKeywords: [steps, checklist, timeline, responsible, deliverable]}]`

### New Workflow Blueprints (5)

Each blueprint gets a YAML file in `src/lib/workflows/blueprints/builtins/`.

**1. `lead-research-pipeline`**
- **Domain:** work
- **Pattern:** sequence
- **Steps:** Research & Identify (sales-researcher) → Qualify & Prioritize (sales-researcher) → Create Outreach Plan (content-creator)
- **Variables:** target_industry (text), company_size (select: startup/smb/enterprise), outreach_goal (text)

**2. `content-marketing-pipeline`**
- **Domain:** work
- **Pattern:** checkpoint
- **Steps:** Strategy & Planning (marketing-strategist) → Content Creation (content-creator, requires approval) → Review & Optimize (marketing-strategist)
- **Variables:** topic (text), content_type (select: blog/social/newsletter/email-sequence), target_audience (text)

**3. `customer-support-triage`**
- **Domain:** work
- **Pattern:** sequence
- **Steps:** Classify & Prioritize (customer-support-agent) → Draft Response (customer-support-agent) → Quality Review (operations-coordinator)
- **Variables:** ticket_content (textarea), urgency (select: low/medium/high/critical), customer_tier (select: free/paid/enterprise)

**4. `financial-reporting`**
- **Domain:** work
- **Pattern:** checkpoint
- **Steps:** Data Gathering (financial-analyst) → Analysis & Insights (financial-analyst, requires approval) → Report Generation (document-writer)
- **Variables:** reporting_period (select: weekly/monthly/quarterly), focus_area (select: revenue/expenses/cash-flow/unit-economics), audience (select: internal/investor/board)

**5. `business-daily-briefing`**
- **Domain:** work
- **Pattern:** sequence
- **Steps:** Gather Signals (researcher) → Analyze & Prioritize (operations-coordinator) → Compile Briefing (document-writer)
- **Variables:** business_name (text), focus_areas (textarea), briefing_depth (select: quick/standard/detailed)

### Profile Metadata

All 6 new profiles use:
- `supportedRuntimes: [claude-code, openai-codex-app-server, anthropic-direct, openai-direct]`
- `preferredRuntime: anthropic-direct`
- `author: ainative`
- `version: "1.0.0"`

### Registry Integration

No code changes needed — the existing `ensureBuiltins()` function in `src/lib/agents/profiles/registry.ts` auto-copies new builtin directories to `~/.claude/skills/` on first access. The existing `scanProfiles()` picks them up automatically.

Similarly, the blueprint registry in `src/lib/workflows/blueprints/registry.ts` auto-discovers new YAML files in the builtins directory.

## Acceptance Criteria

- [ ] 6 new profile directories exist in `src/lib/agents/profiles/builtins/` with `profile.yaml` and `SKILL.md`
- [ ] Each SKILL.md contains genuine domain-knowledge instructions (not generic/placeholder text)
- [ ] Each profile.yaml has valid schema: id, name, version, domain, tags, allowedTools, canUseToolPolicy, supportedRuntimes, preferredRuntime, maxTurns, tests
- [ ] 5 new blueprint YAML files exist in `src/lib/workflows/blueprints/builtins/`
- [ ] Each blueprint has valid schema: id, name, description, version, domain, tags, pattern, variables, steps
- [ ] Blueprint steps reference valid profile IDs (new and existing profiles)
- [ ] `npx ainative` lists all 20 profiles (14 existing + 6 new) in the profiles surface
- [ ] All 13 blueprints (8 existing + 5 new) appear in the workflow blueprint picker
- [ ] Smoke tests pass for each new profile (task execution returns expected keywords)
- [ ] New profiles appear in the profile AI-assist suggestions when matching business function keywords

## Scope Boundaries

**Included:**
- 6 new builtin agent profile directories (profile.yaml + SKILL.md each)
- 5 new workflow blueprint YAML files
- Genuine domain-knowledge SKILL.md content for each profile

**Excluded:**
- Renaming or modifying existing 14 profiles
- MCP server integrations for business tools (CRM, email, etc.) — separate feature
- Cloud-hosted profile sharing or marketplace — deferred
- UI changes to profile catalog or blueprint picker — existing surfaces auto-discover new entries
- Profile-specific learned context seeding — profiles start fresh like existing builtins

## References

- Source: `ideas/vision/machine-builds-machine-claude-ext-rsrch.md` — Section 7 (Tier 1: rename/repackage profiles, create business workflow blueprints)
- Source: `ideas/vision/ainative-OpenClaw-Companion-Research-Report.md` — Section 3.1 (SOUL.md format, 187+ production templates across 19 categories)
- Related features: agent-profile-catalog (completed), workflow-blueprints (completed), product-messaging-refresh (new positioning references these profiles)
- Existing patterns: `src/lib/agents/profiles/builtins/researcher/` (profile structure reference), `src/lib/workflows/blueprints/builtins/research-report.yaml` (blueprint structure reference)
