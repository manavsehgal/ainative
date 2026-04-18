---
title: Skills Repo Import
status: completed
priority: P2
milestone: post-mvp
scope: EXPAND
source: user-request
dependencies: [agent-profile-catalog, skill-portfolio, environment-scanner]
---

# Skills Repo Import

## Description

Repo-level skill import that lets users point ainative at an entire GitHub repository (such as `https://github.com/garrytan/gstack`) and batch-import all discoverable skills as ainative agent profiles. This extends the existing single-file import at `POST /api/profiles/import` into a multi-step wizard that handles repo scanning, format adaptation (for repos that use SKILL.md-only without `profile.yaml`), deduplication against all existing profiles, source attribution, and ongoing update checking.

Three core layers:
1. **Repo scanner** — discovers all importable skills in a GitHub repo regardless of directory convention
2. **Format adapter** — converts non-ainative skill formats (like gstack's SKILL.md-with-frontmatter) into valid `profile.yaml` + `SKILL.md` pairs
3. **Import wizard UI** — four-step guided flow for selecting, previewing, deduplicating, and confirming batch imports

### Adjacency with Discovered Skills

Imported profiles land in `~/.claude/skills/{id}/` — the same directory the environment scanner reads. This means:
- Imported profiles appear automatically in the **skill portfolio** alongside discovered and built-in skills
- The **agent-profile-from-environment** suggestion engine considers imported profiles when checking for existing coverage
- The **dedup engine** runs against ALL profile sources (built-in, custom, discovered, imported) during import
- Profile browser shows provenance badges: **Built-in** (blue), **Custom** (gray), **Imported** (purple), **Discovered** (green)

## User Story

As a power user who has found a GitHub repository full of useful skills (like gstack with 28+ skills), I want to paste the repo URL into ainative and batch-import selected skills as agent profiles, so I can immediately use community-built skills without manually converting each one.

As a user who has already accumulated profiles from multiple sources, I want ainative to detect duplicates and near-matches during import, so I do not end up with conflicting or redundant profiles.

As a user who imported skills from an actively maintained repo, I want to check for updates and selectively pull changes, so my imported profiles stay current without losing local customizations.

## Technical Approach

### 1. Data Model Additions

**Extended `profile.yaml` schema** — add optional `importMeta` block to `ProfileConfigSchema` in `src/lib/validators/profile.ts`:

```typescript
const importMetaSchema = z.object({
  repoUrl: z.string().url(),          // "https://github.com/garrytan/gstack"
  repoOwner: z.string(),              // "garrytan"
  repoName: z.string(),               // "gstack"
  branch: z.string(),                 // "main"
  filePath: z.string(),               // "skills/qa" — path within repo to skill dir
  commitSha: z.string(),              // SHA at import time
  contentHash: z.string(),            // SHA-256 of SKILL.md at import time
  importedAt: z.string().datetime(),  // ISO timestamp
  sourceFormat: z.enum(["ainative", "skillmd-only", "unknown"]),
}).optional();
```

Add `importMeta: importMetaSchema` to `ProfileConfigSchema`. Optional so existing profiles are unaffected.

Extend `AgentProfile` interface in `src/lib/agents/profiles/types.ts` with matching `importMeta?` field.

**New database table** — `repo_imports` in `src/lib/db/schema.ts`:

```typescript
export const repoImports = sqliteTable("repo_imports", {
  id: text("id").primaryKey(),
  repoUrl: text("repo_url").notNull(),
  repoOwner: text("repo_owner").notNull(),
  repoName: text("repo_name").notNull(),
  branch: text("branch").notNull(),
  commitSha: text("commit_sha").notNull(),
  profileIds: text("profile_ids").notNull(), // JSON array of imported profile IDs
  skillCount: integer("skill_count").notNull(),
  lastCheckedAt: integer("last_checked_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
```

Tracks which repos have been imported and which profiles came from them, enabling batch "check for updates" per repo.

### 2. Repo Scanner

**`src/lib/import/repo-scanner.ts`** — uses GitHub API (no git clone) to scan a repository tree.

```typescript
interface RepoScanResult {
  owner: string;
  repo: string;
  branch: string;
  commitSha: string;
  discoveredSkills: DiscoveredSkill[];
  scanDurationMs: number;
}

interface DiscoveredSkill {
  name: string;
  path: string;                    // "skills/qa"
  format: "ainative" | "skillmd-only" | "unknown";
  hasProfileYaml: boolean;
  hasSkillMd: boolean;
  frontmatter: Record<string, string>;
  rawSkillMd?: string;             // fetched on selection, not during scan
  rawProfileYaml?: string;
}
```

**Discovery strategy:**
1. Single call to GitHub Trees API (`GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1`) to get the full file tree
2. Find all directories containing `SKILL.md` files
3. For each: check if `profile.yaml` exists alongside → classify as `"ainative"` or `"skillmd-only"`
4. Search paths: `skills/*/SKILL.md`, `.claude/skills/*/SKILL.md`, root-level `*/SKILL.md`, any nested pattern — greedy discovery

**`src/lib/import/github-api.ts`** — low-level helpers:
- `getRepoTree(owner, repo, branch)` — recursive tree fetch
- `getFileContent(owner, repo, path, ref)` — raw file content
- `getLatestCommitSha(owner, repo, branch)` — HEAD SHA
- `parseRepoUrl(url)` — extracts owner/repo/branch (extend existing `toRawGitHubUrl` logic from `src/app/api/profiles/import/route.ts`)

Rate limiting: single Trees API call for discovery, batch-fetch only selected skill files. Stays within unauthenticated GitHub limits (60 req/hour). Optional `GITHUB_TOKEN` support for higher limits.

### 3. Format Adapter

**`src/lib/import/format-adapter.ts`** — converts non-ainative formats into valid `ProfileConfig` + `SKILL.md` pairs.

**gstack-style mapping rules:**
| SKILL.md frontmatter | → profile.yaml field |
|---|---|
| `name` | `id` (slugified) + `name` (as-is) |
| `description` | `description` |
| `allowed-tools` | `allowedTools` |
| `version` | `version` (default `"1.0.0"`) |
| `preamble-tier` | stored in metadata (informational) |
| — | `domain`: default `"work"`, infer `"personal"` from keywords |
| — | `author`: repo owner |
| — | `source`: GitHub URL to skill directory |
| — | `tags`: inferred from directory name + frontmatter keywords |

Handles `.tmpl` template pattern: prefer `SKILL.md` if both exist; fall back to `SKILL.md.tmpl`.

### 4. Deduplication Engine

**`src/lib/import/dedup.ts`** — three-tier matching against ALL existing profiles.

```typescript
interface DedupResult {
  candidate: ProfileConfig;
  status: "new" | "exact-match" | "near-match";
  matchedProfile?: AgentProfile;
  matchReason?: string;           // "Same ID", "Same name", "Similar content (82%)"
  similarity?: number;            // 0-1 for near-matches
}
```

**Algorithm:**
1. **Exact ID match**: `candidate.id === existing.id` → `"exact-match"`
2. **Name match**: case-insensitive `candidate.name === existing.name` → `"exact-match"`
3. **Content similarity**: Extract top 20 keywords from both SKILL.md files (tokenize + stop-word removal). Jaccard similarity on keyword sets. If > 0.6 → `"near-match"`. Tag overlap > 50% boosts similarity by 0.1.

No NLP library required — lightweight keyword extraction + set comparison.

Runs against: built-in profiles, custom profiles, discovered profiles (from environment scanner), and previously imported profiles.

### 5. API Routes

New directory: `src/app/api/profiles/import-repo/`

| Route | Purpose |
|---|---|
| `POST .../scan` | Scan repo, return `RepoScanResult` |
| `POST .../preview` | Fetch selected skills, run adapter + dedup, return previews |
| `POST .../confirm` | Execute batch import, create profiles, insert `repo_imports` row |
| `POST .../check-updates` | Compare local content hashes against remote HEAD |
| `POST .../apply-updates` | Apply accepted updates, refresh profile + metadata |

### 6. Import Wizard UI

**`src/components/profiles/repo-import-wizard.tsx`** — four-step dialog:

**Step 1 — Enter URL**
- Single URL input field
- "Scan Repository" button with loading state
- On success: repo name, skill count, branch, commit SHA

**Step 2 — Select Skills**
- Scrollable checkbox list of discovered skills
- Each row: skill name, format badge ("ainative" / "SKILL.md only"), description preview
- "Select All" / "Deselect All"
- Grouped by directory path

**Step 3 — Preview & Dedup**
- Generated `profile.yaml` preview per skill
- Dedup status badge: green "New" / yellow "Similar to [name]" / red "Already exists"
- For near-matches: expandable diff against similar existing profile
- Per-skill action: "Import" / "Replace existing" / "Import as copy" (appends `-imported` suffix) / "Skip"

**Step 4 — Confirm & Import**
- Summary: X new, Y replacing, Z skipped
- Attribution preview: "Imported from garrytan/gstack at commit abc1234"
- "Import" button → progress indicator → success state with profile links

### 7. Attribution & Source Tracking

- `importMeta` block persisted in each profile's `profile.yaml`
- Profile detail view shows attribution section: "Imported from [owner/repo] on [date]" with GitHub link
- Profile card shows small "Imported" provenance badge
- `repo_imports` table enables batch operations per-repo

### 8. Update/Pull Changes

Pull-based (user-initiated), not automatic:

1. User clicks "Check for Updates" (per-profile or per-repo)
2. Fetch latest commit SHA from GitHub → compare against stored `importMeta.commitSha`
3. If changed: fetch each imported profile's source SKILL.md, compute SHA-256, compare against `importMeta.contentHash`
4. If content differs: generate text diff, present to user
5. User accepts/rejects per-skill
6. Accepted updates: overwrite local `SKILL.md`, re-run format adapter, update `importMeta`

**`src/components/profiles/repo-update-checker.tsx`** — shown in profile detail view for imported profiles and as batch action in profile browser.

### 9. Profile Browser Integration

Modify `src/components/profiles/profile-browser.tsx`:
- Import button → dropdown: "Import from URL" (existing) / "Import from Repository" (new wizard)
- Provenance badges on all profile cards
- Provenance filter alongside existing domain filter

Modify `src/components/profiles/profile-detail-view.tsx`:
- Attribution section for imported profiles
- "Check for Updates" button

### 10. Skill Portfolio Integration

Imported profiles land in `~/.claude/skills/` so the environment scanner picks them up automatically. No changes to `src/lib/environment/skill-portfolio.ts` aggregation logic. Portfolio UI should display `importMeta` provenance when available.

## Acceptance Criteria

- [ ] User can paste a GitHub repo URL and ainative scans it, discovering all SKILL.md-bearing directories
- [ ] Repos with `profile.yaml` (ainative-native) are imported directly
- [ ] Repos without `profile.yaml` (like gstack) have `profile.yaml` auto-generated from SKILL.md frontmatter
- [ ] Import wizard shows four steps: URL entry → skill selection → preview/dedup → confirm
- [ ] Dedup engine detects exact matches (same ID or name) and near-matches (content similarity > 60%)
- [ ] Dedup results shown per-skill with actionable options (import/replace/copy/skip)
- [ ] Imported profiles store `importMeta` with repo URL, commit SHA, content hash, and timestamp
- [ ] Profile browser shows provenance badges: Built-in, Custom, Imported, Discovered
- [ ] Profile detail view shows source attribution with link to GitHub for imported profiles
- [ ] "Check for Updates" compares local content hash against remote, shows diff for changed skills
- [ ] User can accept or reject updates per-skill
- [ ] `repo_imports` table tracks which repos have been imported and which profiles came from them
- [ ] Imported profiles appear in skill portfolio alongside discovered and built-in profiles
- [ ] Batch import of 28+ skills completes within 30 seconds
- [ ] Graceful error handling for private repos, rate limits, malformed SKILL.md, and network failures

## Scope Boundaries

**Included:**
- GitHub public repo scanning via API (no git clone)
- gstack-format SKILL.md adaptation (frontmatter mapping)
- ainative-native `profile.yaml` direct import
- Four-step import wizard UI
- Dedup against all profile sources (built-in, custom, discovered, imported)
- Source attribution and `importMeta` tracking
- Pull-based update checking with per-skill diff review
- `repo_imports` database table for batch tracking
- Profile browser provenance badges and filters

**Excluded:**
- Private repo support requiring OAuth (can add later with `GITHUB_TOKEN`)
- GitLab, Bitbucket, or other Git hosting platforms (GitHub only for v1)
- Automatic periodic update polling (user-initiated only for v1)
- Merge conflict resolution for local customizations vs upstream changes
- Export/publish profiles back to a repo
- Cloning repos to disk (API-only approach)
- Support for non-SKILL.md formats (raw .md without frontmatter)

## Implementation Sequence

**Phase 1 — Data model + core library**
1. Extend `ProfileConfigSchema` with `importMeta`
2. Extend `AgentProfile` interface
3. Update `scanProfiles()` to pass through `importMeta`
4. Add `repo_imports` table + migration
5. Create `src/lib/import/github-api.ts`
6. Create `src/lib/import/repo-scanner.ts`
7. Create `src/lib/import/format-adapter.ts`
8. Create `src/lib/import/dedup.ts`

**Phase 2 — API routes**
9. `POST /api/profiles/import-repo/scan`
10. `POST /api/profiles/import-repo/preview`
11. `POST /api/profiles/import-repo/confirm`
12. `POST /api/profiles/import-repo/check-updates`
13. `POST /api/profiles/import-repo/apply-updates`

**Phase 3 — UI**
14. `repo-import-wizard.tsx` (4-step dialog)
15. `repo-import-skill-row.tsx`
16. Update `profile-browser.tsx` with import dropdown + provenance badges
17. Update `profile-detail-view.tsx` with attribution + update checking
18. `repo-update-checker.tsx`

**Phase 4 — Integration + polish**
19. Verify imported profiles appear in skill portfolio
20. Add provenance filter to profile browser
21. End-to-end test: import gstack repo, verify all 28 skills adapted correctly
22. Error handling for edge cases

## References

- Existing single-profile import: `src/app/api/profiles/import/route.ts`
- Profile validator: `src/lib/validators/profile.ts`
- Profile types: `src/lib/agents/profiles/types.ts`
- Profile registry: `src/lib/agents/profiles/registry.ts`
- Profile browser UI: `src/components/profiles/profile-browser.tsx`
- Import dialog UI: `src/components/profiles/profile-import-dialog.tsx`
- Skill portfolio: `src/lib/environment/skill-portfolio.ts`
- Environment scanner: `src/lib/environment/parsers/skill.ts`
- Profile from environment: `src/lib/environment/profile-generator.ts`
- DB schema: `src/lib/db/schema.ts`
- Depends on: [agent-profile-catalog](agent-profile-catalog.md), [skill-portfolio](skill-portfolio.md), [environment-scanner](environment-scanner.md)
- Related: [agent-profile-from-environment](agent-profile-from-environment.md)
- Example target repo: https://github.com/garrytan/gstack
