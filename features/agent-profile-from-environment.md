---
title: Agent Profile from Environment
status: completed
priority: P3
milestone: post-mvp
source: ideas/environment-onboarding-plan.md
dependencies: [environment-cache, multi-agent-routing]
---

# Agent Profile from Environment

## Description

Auto-generate ainative agent profiles from discovered environment artifacts. When the scanner finds clusters of related skills, MCP servers, and permissions, it suggests profile definitions that combine them into coherent agent capabilities. This closes the loop between environment visibility and task orchestration — your CLI configuration literally becomes your agent capability.

For example: a project with a `code-review` skill, `security-best-practices` skill, and `Bash`/`Read`/`Grep` permissions suggests a "Security Reviewer" profile. A project with a `playwright` MCP server and `quality-manager` skill suggests a "QA Tester" profile.

## User Story

As a ainative user who has configured various skills and MCP servers across my CLI tools, I want ainative to automatically suggest agent profiles based on what it finds in my environment, so I can immediately start routing tasks to specialized agents without manually defining profiles from scratch.

## Technical Approach

### Profile Suggestion Rules

**`src/lib/environment/profile-rules.ts`** — Extensible rules engine:

Each rule maps an artifact cluster to a profile suggestion:

```typescript
interface ProfileRule {
  id: string;
  name: string;                           // suggested profile name
  description: string;                     // what this profile does
  requiredArtifacts: ArtifactMatcher[];   // must have ALL
  optionalArtifacts: ArtifactMatcher[];   // nice to have (boost confidence)
  suggestedTools: string[];                // allowedTools for the profile
  suggestedSystemPrompt: string;           // template system prompt
  confidence: number;                      // 0-1 base confidence
}
```

**Starter rules:**

| Rule | Required Artifacts | Suggested Profile |
|------|-------------------|-------------------|
| Security Reviewer | code-review skill + (security-best-practices OR security-threat-model skill) | System prompt focused on OWASP checks, code auditing, vulnerability detection |
| QA Tester | playwright MCP + quality-manager skill | System prompt for test creation, browser automation, coverage analysis |
| Investigator | capture skill + web-fetch permissions | System prompt for research, source gathering, citation tracking |
| Document Specialist | pdf skill + (docx OR xlsx OR pptx skill) | System prompt for document processing, format conversion, content extraction |
| Code Architect | frontend-design skill + taste skill | System prompt for code review with design system awareness |
| DevOps Engineer | (deploy skill OR CI config) + Bash permissions | System prompt for infrastructure, deployment, and pipeline work |

### Profile Generator

**`src/lib/environment/profile-generator.ts`**:
- **`suggestProfiles(scanId)`** — Runs all rules against the scan's artifacts. Returns suggestions sorted by confidence (highest first). Filters out suggestions that match already-existing profiles.
- **`generateProfileDefinition(suggestion)`** — Converts a suggestion into a full profile definition compatible with `src/lib/agents/profiles/types.ts`. Includes id, name, description, systemPrompt, allowedTools, tags.
- **`createProfileFromSuggestion(suggestion)`** — Creates the profile file in `src/lib/agents/profiles/` and registers it in the profile registry.

### Integration with Existing Profiles

The generator checks `src/lib/agents/profiles/registry.ts` to avoid suggesting profiles that already exist (by matching on name or overlapping artifact coverage). Suggestions show "Similar to existing profile: [name]" when there's partial overlap.

### API Routes

- **`GET /api/environment/profiles/suggest?scanId=xxx`** — Returns profile suggestions based on latest scan
- **`POST /api/environment/profiles/create`** — Creates a profile from a suggestion (accepts suggestion data, writes profile file)

### UI Components

- **`suggested-profiles.tsx`** — Section on the environment dashboard showing profile suggestion cards. Each card shows: suggested name, description, matched artifacts (with icons), confidence score, "Create Profile" button.
- **`profile-create-dialog.tsx`** — Review and customize the suggested profile before creating: edit name, description, system prompt. Preview the profile definition. Confirm to create.
- **`artifact-cluster-badge.tsx`** — Visual showing which artifacts contribute to a suggestion, grouped by category.

### Dashboard Integration

The "Suggested Profiles" section appears at the bottom of the environment dashboard after a scan, only if there are suggestions with confidence > 0.6. It's collapsible and dismissible.

## Acceptance Criteria

- [ ] Profile rules engine evaluates artifact clusters against rule definitions
- [ ] At least 6 starter rules produce correct suggestions for matching environments
- [ ] Suggestions include confidence scores and matched artifacts list
- [ ] Suggestions filter out profiles that already exist in the registry
- [ ] Generated profile definitions are compatible with existing profile types
- [ ] Created profiles appear in the profile registry and are usable for task routing
- [ ] Suggested profiles section appears on environment dashboard
- [ ] Profile creation dialog allows customization before creating
- [ ] Low-confidence suggestions (< 0.6) are hidden from the dashboard
- [ ] Suggestions update when environment is re-scanned

## Scope Boundaries

**Included:**
- Rules engine for artifact-to-profile mapping
- 6 starter rules covering common patterns
- Profile generation compatible with existing profile system
- Dashboard integration with suggestion cards
- Customizable creation dialog

**Excluded:**
- Machine learning or NLU-based profile suggestion (rules-based only)
- Auto-creating profiles without user confirmation
- Modifying existing profiles based on environment changes
- Custom user-defined rules (extensibility for v2)

## References

- Source: environment onboarding plan — Feature 11
- Integration: `src/lib/agents/profiles/types.ts` — profile interface
- Integration: `src/lib/agents/profiles/registry.ts` — profile registration
- Related features: multi-agent-routing (profiles are consumed by task router), environment-dashboard (hosts suggestions)
