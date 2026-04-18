---
title: Project-Scoped Profiles
status: completed
priority: P1
milestone: post-mvp
source: dogfooding discovery (folder skills invisible to chat, 2026-03-31)
dependencies: [agent-profile-catalog, environment-scanner, auto-environment-scan]
---

# Project-Scoped Profiles

## Description

ainative's profile registry scans `~/.claude/skills/` for agent profiles (TDR-007), but ignores project-level `.claude/skills/` directories. This means a project's custom Claude Code skills — which may include specialized reviewers, domain experts, or workflow-specific agents — are invisible to ainative's chat, task execution, and profile selector.

This feature bridges project-level skills to the profile system by reading them **in-place** from the project's `.claude/skills/` directory. Project skills are NOT copied to `~/.claude/skills/` — the project repo remains the source of truth. They appear as read-only, project-scoped profiles that are available only when the project is active.

### Key Design Decision: Read In-Place, Not Copy

Copying project skills to `~/.claude/skills/` creates a sync problem: which version is canonical? By reading in-place, we avoid drift between the project's skill definitions and ainative's profile registry. The tradeoff is that project profiles only exist while the project context is active — which is the correct behavior since they belong to the project, not the user.

### SKILL.md-Only Skills

Many Claude Code skills have only a `SKILL.md` file with no `profile.yaml` sidecar. These are valid skills but lack ainative metadata (tools, MCP servers, domain, tags). For these, we generate a minimal in-memory profile:

- `id`: directory name (kebab-case)
- `name`: from SKILL.md frontmatter `name:` field, falling back to directory name
- `description`: from SKILL.md frontmatter `description:` field
- `domain`: "work" (safe default)
- `tags`: `["project-skill"]`
- `supportedRuntimes`: `["claude-code"]`
- `skillMd`: full SKILL.md content

This lets any Claude Code skill appear in ainative without requiring the project author to add ainative-specific configuration.

## User Story

As a developer working on a project with custom Claude Code skills (`.claude/skills/`), I want those skills to automatically appear as available agent profiles in ainative, so I can use them in chat and task execution without manually importing them.

## Technical Approach

### Profile Type Extension

Add optional fields to `AgentProfile` in `src/lib/agents/profiles/types.ts`:

```typescript
scope?: "builtin" | "user" | "project";
readOnly?: boolean;
projectDir?: string;  // absolute path, only set for project-scoped
```

### Project Profile Scanner

Create `src/lib/agents/profiles/project-profiles.ts`:

- **`scanProjectProfiles(projectDir: string): AgentProfile[]`** — reads `path.join(projectDir, ".claude", "skills")`, iterates subdirectories. For each dir:
  - If `profile.yaml` + `SKILL.md` exist: parse with `ProfileConfigSchema`, pair with SKILL.md content (same as `scanProfiles()` in registry.ts)
  - If only `SKILL.md` exists: call `generateMinimalProfile()`
  - Skip dirs with neither file
  - Mark all profiles: `scope: "project"`, `readOnly: true`, `projectDir`

- **`getProjectProfile(projectDir: string, id: string): AgentProfile | undefined`** — lookup by ID from cached scan results

- **`generateMinimalProfile(skillDir: string): AgentProfile`** — reads SKILL.md, extracts frontmatter, generates minimal profile in memory

- **Cache**: Uses the same mtime-based directory signature pattern as the registry (`getSkillsDirectorySignature`), keyed by `projectDir`. Cache invalidates when any file in the project's `.claude/skills/` changes.

### Registry Extension

Add to `src/lib/agents/profiles/registry.ts`:

- **`listAllProfiles(projectDir?: string): AgentProfile[]`** — calls existing `listProfiles()` for user/builtin profiles, calls `scanProjectProfiles()` for project profiles, unions results. Marks builtins with `scope: "builtin"`, non-builtins with `scope: "user"`.

### API Extension

Modify `GET /api/profiles` (`src/app/api/profiles/route.ts`):

- Accept `?scope=project&projectId=xxx` — looks up project's `workingDirectory`, returns only project-scoped profiles
- Accept `?scope=all&projectId=xxx` — returns all profiles (builtin + user + project)
- Default behavior (no params) unchanged — returns user + builtin profiles

### CRUD Guard Rails

Existing CRUD operations (`createProfile`, `updateProfile`, `deleteProfile`) remain user-scope only. The API layer rejects mutations targeting project-scoped profiles with a clear error: "Project-scoped profiles are read-only. Edit them in your project's .claude/skills/ directory."

### ID Collision Handling

If a project has `.claude/skills/foo/` and the user has `~/.claude/skills/foo/`, both are returned by `listAllProfiles()` with different `scope` values. The UI groups them separately. The task classifier (`classifyTaskProfile` in `router.ts`) prefers the project-scoped version when a project context is active.

## Acceptance Criteria

- [ ] Project skills with `profile.yaml` + `SKILL.md` appear as project-scoped profiles
- [ ] Project skills with only `SKILL.md` appear with generated minimal profile metadata
- [ ] Project profiles are marked `scope: "project"` and `readOnly: true`
- [ ] `GET /api/profiles?scope=project&projectId=xxx` returns project-scoped profiles
- [ ] `GET /api/profiles?scope=all&projectId=xxx` returns all three scopes
- [ ] Default `GET /api/profiles` (no params) returns only user + builtin (backward compatible)
- [ ] CRUD operations reject project-scoped profiles with clear error message
- [ ] Cache invalidates when project `.claude/skills/` contents change (mtime-based)
- [ ] Projects without `.claude/skills/` return empty project profiles (no error)
- [ ] ID collisions between project and user profiles don't cause errors (both returned, different scopes)

## Scope Boundaries

**Included:**
- Read-only discovery of project-level `.claude/skills/` as profiles
- Minimal profile generation for SKILL.md-only skills
- API support for scope-filtered profile queries
- Cache with mtime-based invalidation per projectDir
- Guard rails preventing CRUD on project profiles

**Excluded:**
- Copying project skills to `~/.claude/skills/` (explicit anti-goal)
- Profile editing UI for project skills (edit in IDE/editor instead)
- Cross-project skill comparison (see `cross-project-comparison` feature)
- Profile import from project to user scope (could be future "pin" feature)
- Codex project skills (only `.claude/skills/` for now, not `.codex/skills/`)

## References

- Depends on: [agent-profile-catalog](agent-profile-catalog.md) — profile type, registry, validation
- Depends on: [environment-scanner](environment-scanner.md) — project-level skill discovery
- Depends on: [auto-environment-scan](auto-environment-scan.md) — triggers scan that makes skills visible
- Consumed by: [dynamic-slash-commands](dynamic-slash-commands.md) — surfaces project profiles in chat
- Architecture: TDR-007 (Profile as Skill Directory) — extends to project scope
- Code: `src/lib/agents/profiles/registry.ts` — existing scanProfiles() pattern to mirror
- Code: `src/lib/validators/profile.ts` — ProfileConfigSchema for validation
