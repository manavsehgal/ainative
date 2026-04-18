---
title: Chat — File @-Mentions
status: completed
priority: P1
milestone: post-mvp
source: ideas/chat-context-experience.md §5.3, §8 Phase 2, Q6
dependencies: [chat-command-mentions, chat-claude-sdk-skills, workspace-context-awareness]
---

# Chat — File @-Mentions

## Description

Claude Code and Codex CLI users rely heavily on `@file:path/to/code.ts`-style file references — a fast way to pin specific files into the model's context without reading them manually first. ainative chat's `@` popover today supports seven ainative entity types (projects, tasks, workflows, documents, profiles, schedules, tables) but not filesystem paths. CLI refugees repeatedly reach for `@src/` and find nothing.

This feature extends the `@` typeahead to include files under the active project's working directory. It respects `.gitignore` so build artifacts don't pollute suggestions, and it uses tiered expansion (per Q6 resolution): files under 8 KB inline into Tier 3 context, larger files stay as references that the agent can read via the `Read` tool (which now exists on Claude thanks to Phase 1a). The result: CLI muscle memory works, and context budget stays controlled.

## User Story

As a developer chatting with ainative about a specific file, I want to type `@src/lib/db/schema.ts` and have that file inlined (or referenced) in the model's context without hand-copying, so I get CLI-parity file references in the web UI.

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
- Files shipped:
  - `src/lib/chat/files/search.ts` — pure helper over `git ls-files --cached --others --exclude-standard` + substring filtering, filename-first ranking, secondary sort by mtime. 7 unit tests.
  - `src/app/api/chat/files/search/route.ts` — `GET /api/chat/files/search?q=&projectId=&limit=20`. Server-resolves cwd (project workingDirectory or `getLaunchCwd()`), never from client input.
  - `src/hooks/use-chat-autocomplete.ts` — parallel `fileResults` state fed from API, debounced 150ms, aborts in-flight requests on each keystroke. Merges into `entityResults` for unified popover rendering.
  - `src/components/chat/chat-command-popover.tsx` — registers `file` entity type (FileCode icon, "Files" heading), renders paths in `font-mono text-xs`.
  - `src/hooks/use-chat-autocomplete.ts` — special-cases file mentions to insert `@<path>` (not `@file:<path>`), matching CLI-origin muscle memory.
  - `src/lib/chat/files/expand-mention.ts` — `expandFileMention(relPath, cwd)` helper, extracted into its own module so tests can `vi.mock("node:fs")` without pulling the DB bootstrap chain. 7 unit tests.
  - `src/lib/chat/context-builder.ts` — adds the `case "file":` branch in `buildTier3`, delegating to `expandFileMention`.

### Deferred to follow-ups (per scope reduction)

- **Fuzzy match** — shipped with substring + filename-first. Upgrade if signal shows users fuzzy-guessing.
- **Client-side file-list caching with focus invalidation** — shipped with fetch-on-keystroke + debounce.
- **Ollama large-file hover hint** — belongs in `chat-environment-integration`, not here.

## Verification run — 2026-04-14

End-to-end browser smoke driven via Claude in Chrome against the developer's running dev server on `:3000`:

| Scenario | Evidence | Outcome |
|---|---|---|
| Files group appears in `@` popover | Typed `@schema`; popover rendered a "Files" heading with 6 matches including `features/database-schema.md` (4.4 KB), `src/lib/db/schema.ts` (48.4 KB), plus several `.claude/skills/...` paths — monospace rendering with size hints | ✓ |
| Small (<8 KB) file inlines content | Typed `@schema`, selected `features/database-schema.md` (4.4 KB), asked the assistant to "quote the first heading verbatim" — assistant returned `"# Database Schema & Data Layer"` which exactly matches the file's actual first `#` heading (line 10) | ✓ |
| Large (≥8 KB) file emits reference only | Typed `@schema`, selected `src/lib/db/schema.ts` (48.4 KB), asked for an estimated line count — assistant responded: *"Based on the metadata shown in the referenced entity, the file is 48 KB … I'd estimate it's approximately 1,200–1,400 lines. Want me to read it to give you the exact count?"* Actual count is 1,259 lines. Proves content was NOT inlined (assistant would have returned an exact number) and the Read-tool hint reached the model. | ✓ |
| `.gitignore` respected | `curl /api/chat/files/search?q=node_modules&limit=5` → `{"results":[]}` — `git ls-files --exclude-standard` excludes all gitignored paths by construction | ✓ |
| Insert format is `@<path>` not `@file:<path>` | Screenshot shows textarea containing `@features/database-schema.md` after selection — the hook's special-case for `entityType === "file"` matches spec §5.3 | ✓ |
| Path-traversal guardrail | Tier 3 unit test `rejects paths that resolve outside cwd (security guardrail)` passes — `realpathSync(cwd) + startsWith(abs, cwdReal)` rejects escape paths and emits `"(invalid path — escapes working directory)"` without reading the file | ✓ |

No regressions in existing `@` mention types (Tasks/Projects/etc. continued to render alongside Files). 160/160 chat-related unit tests green across the whole test run; zero TypeScript errors on touched files.
