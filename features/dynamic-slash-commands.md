---
title: Dynamic Slash Commands
status: completed
priority: P2
milestone: post-mvp
source: dogfooding discovery (skills unavailable in chat, 2026-03-31)
dependencies: [chat-command-mentions, chat-input-composer, project-scoped-profiles]
---

# Dynamic Slash Commands

## Description

Stagent's chat slash command system is entirely static — defined as a hardcoded array in `tool-catalog.ts`. When a user types `/` in chat, they see Stagent's built-in tools (tasks, projects, workflows, etc.) but nothing from their project's skills or custom profiles.

This feature extends the slash command popover with a dynamic "Skills" group populated from the active project's discovered skills. When a project has custom Claude Code skills in `.claude/skills/`, those skills appear as slash commands in chat. Selecting a skill inserts a template that activates the skill's profile for the conversation.

### How It Works

1. User opens chat for a project with `.claude/skills/` containing custom skills
2. Auto-environment-scan has already run, discovering the skills
3. Project-scoped-profiles has made them available via the profiles API
4. User types `/` → the popover shows a "Skills" group with the project's skills
5. User selects a skill → template text is inserted: `Use the {skill-name} profile: `
6. User completes their instruction → chat engine routes to the profile

## User Story

As a developer working on a project with custom Claude Code skills, I want to invoke those skills directly from the chat input by typing `/skill-name`, so I can quickly access project-specific agent capabilities without leaving the conversation.

## Technical Approach

### Tool Catalog Extension

Modify `src/lib/chat/tool-catalog.ts`:

- Add `"Skills"` to the `ToolGroup` union type
- Add `Skills` to `TOOL_GROUP_ICONS` — use `Sparkles` from lucide-react
- Insert `"Skills"` into `TOOL_GROUP_ORDER` after `"Profiles"`
- New function: `getToolCatalogWithSkills(opts?)`:

```typescript
export function getToolCatalogWithSkills(opts?: {
  includeBrowser?: boolean;
  projectProfiles?: Array<{ id: string; name: string; description: string }>;
}): ToolCatalogEntry[] {
  const base = getToolCatalog(opts);
  if (!opts?.projectProfiles?.length) return base;

  const skillEntries: ToolCatalogEntry[] = opts.projectProfiles.map(p => ({
    name: p.id,
    description: p.description,
    group: "Skills" as ToolGroup,
  }));

  return [...base, ...skillEntries];
}
```

The dynamic catalog is NOT cached at the module level (unlike the static catalog) because it depends on the active project. Rebuilding it is cheap (array concatenation).

### Client-Side Hook

Create `src/hooks/use-project-skills.ts`:

```typescript
interface ProjectSkillEntry {
  id: string;
  name: string;
  description: string;
}

export function useProjectSkills(projectId?: string | null): {
  skills: ProjectSkillEntry[];
  loading: boolean;
}
```

- Fetches `GET /api/profiles?scope=project&projectId=xxx`
- Caches in React state, refreshes when `projectId` changes
- Returns `{ skills: [], loading: false }` when no `projectId`
- Debounces to avoid rapid re-fetches on project context switches

### Chat Command Popover

Modify `src/components/chat/chat-command-popover.tsx`:

- Accept `projectProfiles` as an optional prop
- Pass to `getToolCatalogWithSkills()` for catalog generation
- The "Skills" group renders with the Sparkles icon, same visual treatment as other groups
- cmdk filtering works automatically (searches by name + description)

### Chat Input Wiring

Modify `src/components/chat/chat-input.tsx`:

- Call `useProjectSkills(activeProjectId)` to get project skills
- Pass `projectProfiles` down to `ChatCommandPopover`
- On skill selection, insert template text: `Use the {skill-name} profile: `

### Slash Command Behavior

When a user selects a skill from the `/` popover:

1. `handleSelect()` in `use-chat-autocomplete.ts` inserts template text: `Use the {skill-name} profile: `
2. User types their instruction after the template
3. The full message is sent to the chat engine
4. The chat engine's existing profile routing (`classifyTaskProfile` or `@profile:name` mention) handles activation

This approach requires zero schema changes — no new `profileId` column on conversations, no explicit profile activation API. The natural language insertion leverages the existing routing system.

**Future enhancement (out of scope):** A tighter integration could set the conversation's active profile explicitly via `PATCH /api/chat/conversations/{id}` with a `profileId` field. This would require adding the column to the conversations table and updating the context builder to inject the profile's SKILL.md as a system prompt.

## Acceptance Criteria

- [ ] "Skills" group appears in slash command popover when project has skills
- [ ] "Skills" group does NOT appear when project has no skills or no project is active
- [ ] Each project skill shows as a selectable command with name and description
- [ ] Selecting a skill inserts template text into the chat input
- [ ] cmdk filtering works on skill names and descriptions
- [ ] Skills group uses Sparkles icon and appears after "Profiles" in group order
- [ ] Hook fetches project skills on project context change and caches results
- [ ] No performance impact on chat input (skills fetched async, not blocking render)
- [ ] Static tool catalog behavior unchanged when no project skills exist

## Scope Boundaries

**Included:**
- Dynamic "Skills" group in slash command popover
- Client-side hook for project skill fetching
- Template text insertion on skill selection
- Icon and group ordering for the new group

**Excluded:**
- Explicit profile activation API (conversation-level profileId column)
- Skill execution preview or configuration dialog before insertion
- User-level custom slash commands (beyond project skills)
- Keyboard shortcut for specific skills
- Skill usage analytics or frequency-based ordering

## References

- Depends on: [chat-command-mentions](chat-command-mentions.md) — slash command infrastructure
- Depends on: [chat-input-composer](chat-input-composer.md) — textarea with autocomplete
- Depends on: [project-scoped-profiles](project-scoped-profiles.md) — project profile discovery and API
- Existing code: `src/lib/chat/tool-catalog.ts` — static catalog to extend
- Existing code: `src/hooks/use-chat-autocomplete.ts` — "/" trigger detection
- Existing code: `src/components/chat/chat-command-popover.tsx` — popover rendering
- Existing code: `src/components/chat/chat-input.tsx` — textarea + autocomplete wiring
