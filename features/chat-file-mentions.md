---
title: Chat — File @-Mentions
status: planned
priority: P1
milestone: post-mvp
source: ideas/chat-context-experience.md §5.3, §8 Phase 2, Q6
dependencies: [chat-command-mentions, chat-claude-sdk-skills, workspace-context-awareness]
---

# Chat — File @-Mentions

## Description

Claude Code and Codex CLI users rely heavily on `@file:path/to/code.ts`-style file references — a fast way to pin specific files into the model's context without reading them manually first. Stagent chat's `@` popover today supports seven Stagent entity types (projects, tasks, workflows, documents, profiles, schedules, tables) but not filesystem paths. CLI refugees repeatedly reach for `@src/` and find nothing.

This feature extends the `@` typeahead to include files under the active project's working directory. It respects `.gitignore` so build artifacts don't pollute suggestions, and it uses tiered expansion (per Q6 resolution): files under 8 KB inline into Tier 3 context, larger files stay as references that the agent can read via the `Read` tool (which now exists on Claude thanks to Phase 1a). The result: CLI muscle memory works, and context budget stays controlled.

## User Story

As a developer chatting with Stagent about a specific file, I want to type `@src/lib/db/schema.ts` and have that file inlined (or referenced) in the model's context without hand-copying, so I get CLI-parity file references in the web UI.

## Technical Approach

### 1. Search API

New endpoint `GET /api/chat/files/search?q=&cwd=&limit=20`:

- `cwd` parameter: active project `workingDirectory` if present, else launch cwd (Q4)
- Walk the directory with `.gitignore` respected (reuse any existing git-aware walker in the codebase; otherwise `ignore` npm package)
- Fuzzy match `q` against path (weight filename matches higher than directory matches)
- Return `[{ path, sizeBytes, mtime }]` sorted by recency + score

Cache directory listing client-side and invalidate on visibility/focus events. Optional chokidar-based invalidation is out of scope.

### 2. `@` popover integration

Extend `src/components/chat/chat-command-popover.tsx` (or the namespace-refactored popover when that lands) so the `@` typeahead has a "Files" category alongside existing entity categories. Typeahead behavior per §5.3:

- `@` alone → recent + suggested (entities pinned to current project + recently edited files)
- `@<letter>` → fuzzy match across entity types AND file paths
- `@<type>:` → filter to that entity type (existing behavior)
- `@src/` → filesystem path completion (new)

Render file rows with monospace path (JetBrains Mono) and a size hint (`2.3 KB`).

### 3. Tiered expansion (Q6a resolution)

On selection, a file mention inserts a token like `@src/lib/db/schema.ts`. When building context in `src/lib/chat/context-builder.ts` Tier 3 expansion:

- If `sizeBytes < 8192`: inline the file content in a fenced code block with the path as a header
- If `sizeBytes >= 8192`: leave the mention as a reference; the agent will use its `Read` tool if needed. Claude can do this natively after Phase 1a; Codex via App Server file tools; Ollama shows a capability hint (no file read available)

Respect overall Tier 3 budget (currently ~8K tokens). If multiple file mentions would exceed, degrade newer/larger ones to references first.

### 4. Security / path scoping

Never serve files outside the resolved `cwd`. Reject absolute paths, `..` traversal, and symlinks that escape the project root.

### 5. Runtime awareness

On Ollama (no `Read` tool), large-file references are effectively inert. Show a popover subtext when hovering a large file result on Ollama: "Large files cannot be read on Ollama — inline only." This ties into `chat-command-namespace-refactor`'s capability hint banner.

## Acceptance Criteria

- [ ] Typing `@src/` triggers filesystem path completion in the `@` popover
- [ ] `GET /api/chat/files/search` returns gitignore-respecting file matches under the resolved cwd
- [ ] Files <8 KB inline their contents into Tier 3 context with path header
- [ ] Files ≥8 KB are represented as references the agent can fetch via `Read` (Claude/Codex)
- [ ] Tier 3 budget is respected; over-budget mentions degrade newer/larger to reference-only
- [ ] Path traversal outside cwd is rejected at the API layer
- [ ] File search results include size and are sorted by recency + fuzzy score
- [ ] On Ollama, large-file references show a capability hint (not readable by current runtime)
- [ ] `cwd` resolves to the active project's `workingDirectory` when set, else launch cwd

## Scope Boundaries

**Included:**
- File search API
- `@` popover "Files" category with fuzzy path completion
- Tiered file expansion in context builder
- Path traversal / symlink escape guard
- Runtime-aware capability hint for large files on Ollama

**Excluded:**
- Editor-style file previews inside the popover (future enhancement)
- Saving file mentions as documents in the Document pool
- Image/PDF-aware previews (use existing Document features)
- chokidar filesystem watching for live-updating file listings
- Multi-file glob mentions (`@src/**/*.ts`) — out of scope

## References

- Source: `ideas/chat-context-experience.md` §5.3 (references namespace), §8 Phase 2, Q4 (cwd resolution), Q6 (tiered expansion)
- Depends on: `chat-command-mentions` (existing `@` infrastructure), `chat-claude-sdk-skills` (gives agents the `Read` tool for large-file references), `workspace-context-awareness` (cwd resolution)
- Existing code: `src/components/chat/chat-command-popover.tsx`, `src/hooks/use-chat-autocomplete.ts`, `src/lib/chat/context-builder.ts`
