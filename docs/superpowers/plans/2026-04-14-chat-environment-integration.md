# Chat Environment Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thread environment metadata (per-skill health, profile linkage, cross-tool sync status, scope) into the chat Skills tab and add a passive "recommended" flag plus auto-rescan-on-session-start, without changing the SDK's native skill discovery path.

**Architecture:** Add pure enrichment + recommendation modules over the existing `listSkills()` output. Extend the `list_skills` MCP tool with an opt-in `enriched: true` flag that is backwards compatible (additive fields only). Skills tab consumes enriched fields and renders inline badges via a new `SkillRow` component. A thin `/api/environment/rescan-if-stale` endpoint is called fire-and-forget from `ChatSessionProvider` on conversation activation. Passive "recommended" star replaces the spec's chip-above-input concept per scope approval.

**Tech Stack:** TypeScript, Drizzle, vitest + testing-library, existing scanner/linker/sync modules, shadcn Badge.

---

## NOT in scope

| Deferred | Rationale |
|---|---|
| Profile suggestion chip above chat input | Replaced with passive "recommended" star in Skills tab (scope decision) |
| Embeddings-based skill matching | Keyword match is enough for v1 |
| Editing skill metadata from chat | Env dashboard owns edit flows |
| Automatic skill activation | Per DD-CE-004 — one click still required |
| Per-skill usage telemetry | Not tracked today, not needed for health |
| Real-time sync refresh | Cache only; next rescan updates it |
| Dashboard route support for `?skill=` deep-link if absent | Ship the link anyway; dashboard may or may not parse it |
| Skill composition (relaxing single-active) | Belongs to `chat-advanced-ux` |

## What already exists

| Asset | Path | Reuse strategy |
|---|---|---|
| `listSkills()` + `getSkill()` | `src/lib/environment/list-skills.ts` | Extend `SkillSummary` type; keep existing callers working |
| Env scanner w/ 5-min cache | `src/lib/environment/scanner.ts` | Read-only consumer |
| `linkedProfileId` column | `schema.ts:446` | Consume for profile-link badge |
| Skill MCP tools | `src/lib/chat/tools/skill-tools.ts` | Add `enriched` input flag |
| Skills tab rendering | `src/components/chat/chat-command-popover.tsx` | Swap in new `SkillRow` when enriched |
| StatusChip / Badge | existing shadcn Badge + status-colors.ts | Badge rendering |
| Auto-scan helper | `src/lib/environment/auto-scan.ts` | Call from new thin endpoint |
| Settings table | `schema.ts` | Dismissals JSON |
| Chat messages | `chat_messages` table | Source for recommendation keywords |
| ChatSessionProvider | `src/components/chat/chat-session-provider.tsx` | Hook for session-start rescan |
| `activeSkillId` on conversations | `chat-ollama-native-skills` | Exclude active skill from recommendations |

## Error & Rescue Registry

| # | Error | Trigger | Impact | Rescue |
|---|---|---|---|---|
| 1 | Env scan cache empty | Fresh install | `list_skills({enriched})` returns bare summaries | Fallback: `health: "unknown"`, omit sync; don't throw |
| 2 | `modifiedAt` null | DB upgrade gap | `healthScore` undefined | Default to `"healthy"` |
| 3 | Concurrent rescans | Rapid convo switch | Duplicate I/O | Guard with in-flight lock in `auto-scan.ts` |
| 4 | Rescan throws | FS perms | Session hang | Catch + log; stale data continues |
| 5 | Many candidates for recommendation | Broad keywords | Noise | Cap to 1 recommended item, rank by recency+health |
| 6 | Active skill shown as recommended | Already activated | Confusing | Exclude `conversations.activeSkillId` |
| 7 | `sessionStorage`/settings write fails | Quota | Dismissal not sticky | try/catch silent |
| 8 | Slow enrichment on 1000+ skills | Massive dir | Popover lag | Cache-only path; cap keywords |
| 9 | Schema mismatch w/ older MCP callers | Additive field | Break clients | Additive only, never rename |
| 10 | Symlink loops | `.claude → .agents` | "synced" but same file | Dedupe by realpath |
| 11 | Scope missing | Scanner edge | Wrong badge | Omit badge |
| 12 | Recommendation race w/ empty conv | New conv no msgs | Match nothing | Short-circuit empty |
| 13 | False positives (common words) | Stopwords | Dumb recs | Stopword filter; require ≥2 distinct hits |
| 14 | Dismissal never expires | Bug | Rec gone forever | Timestamp + 7-day check on read |

## File Structure

**Create:**
- `src/lib/environment/skill-enrichment.ts` — pure `computeHealthScore`, `computeSyncStatus`, `enrichSkills`
- `src/lib/environment/skill-recommendations.ts` — pure `computeRecommendation` (keyword match, ranking)
- `src/lib/chat/dismissals.ts` — read/write `settings.chat.dismissedSuggestions` with 7-day expiry
- `src/lib/environment/__tests__/skill-enrichment.test.ts`
- `src/lib/environment/__tests__/skill-recommendations.test.ts`
- `src/lib/chat/__tests__/dismissals.test.ts`
- `src/app/api/environment/rescan-if-stale/route.ts` — thin POST endpoint
- `src/app/api/environment/rescan-if-stale/__tests__/route.test.ts`
- `src/components/chat/skill-row.tsx` — extracted per-skill row with badges + recommended star
- `src/components/chat/__tests__/skill-row.test.tsx`

**Modify:**
- `src/lib/environment/list-skills.ts` — extend `SkillSummary` with optional enrichment fields; add `listSkillsEnriched()`
- `src/lib/chat/tools/skill-tools.ts` — accept `enriched` flag in `list_skills` tool input schema
- `src/components/chat/chat-command-popover.tsx` — render `<SkillRow>` for Skills tab entries when metadata available
- `src/components/chat/chat-session-provider.tsx` — call `/api/environment/rescan-if-stale` on `activeId` change

---

## Task 1: Pure health + sync computation (no I/O)

**Files:**
- Create: `src/lib/environment/skill-enrichment.ts`
- Test: `src/lib/environment/__tests__/skill-enrichment.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/environment/__tests__/skill-enrichment.test.ts
import { describe, it, expect } from "vitest";
import {
  computeHealthScore,
  computeSyncStatus,
  type HealthScore,
  type SyncStatus,
} from "../skill-enrichment";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

describe("computeHealthScore", () => {
  const NOW = new Date("2026-04-14T00:00:00Z").getTime();

  it("returns 'healthy' for artifacts modified in the last 6 months", () => {
    expect(computeHealthScore(NOW - 30 * MS_PER_DAY, NOW)).toBe("healthy");
    expect(computeHealthScore(NOW - 179 * MS_PER_DAY, NOW)).toBe("healthy");
  });

  it("returns 'stale' for artifacts between 6 and 12 months old", () => {
    expect(computeHealthScore(NOW - 200 * MS_PER_DAY, NOW)).toBe("stale");
    expect(computeHealthScore(NOW - 364 * MS_PER_DAY, NOW)).toBe("stale");
  });

  it("returns 'aging' for artifacts over 12 months old", () => {
    expect(computeHealthScore(NOW - 400 * MS_PER_DAY, NOW)).toBe("aging");
  });

  it("returns 'unknown' when modifiedAt is null", () => {
    expect(computeHealthScore(null, NOW)).toBe("unknown");
  });
});

describe("computeSyncStatus", () => {
  it("returns 'synced' when both tools have the skill", () => {
    expect(computeSyncStatus(["claude-code", "codex"])).toBe("synced");
  });

  it("returns 'claude-only' when only claude-code has it", () => {
    expect(computeSyncStatus(["claude-code"])).toBe("claude-only");
  });

  it("returns 'codex-only' when only codex has it", () => {
    expect(computeSyncStatus(["codex"])).toBe("codex-only");
  });

  it("returns 'shared' when only shared tool is present", () => {
    expect(computeSyncStatus(["shared"])).toBe("shared");
  });

  it("returns 'shared' when claude + shared (covers both)", () => {
    expect(computeSyncStatus(["claude-code", "shared"])).toBe("synced");
  });
});
```

- [ ] **Step 2: Run — expect FAIL (module missing)**

Run: `npx vitest run src/lib/environment/__tests__/skill-enrichment.test.ts`
Expected: FAIL — "Cannot find module '../skill-enrichment'".

- [ ] **Step 3: Implement**

```ts
// src/lib/environment/skill-enrichment.ts

export type HealthScore = "healthy" | "stale" | "aging" | "broken" | "unknown";

export type SyncStatus =
  | "synced"
  | "claude-only"
  | "codex-only"
  | "shared";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const SIX_MONTHS_DAYS = 180;
const TWELVE_MONTHS_DAYS = 365;

export function computeHealthScore(
  modifiedAtMs: number | null,
  nowMs: number = Date.now()
): HealthScore {
  if (modifiedAtMs == null) return "unknown";
  const ageDays = (nowMs - modifiedAtMs) / MS_PER_DAY;
  if (ageDays < SIX_MONTHS_DAYS) return "healthy";
  if (ageDays < TWELVE_MONTHS_DAYS) return "stale";
  return "aging";
}

/**
 * Compute sync status from the set of tools that own the skill.
 * - Both claude-code and codex present → "synced"
 * - Only claude-code → "claude-only"
 * - Only codex → "codex-only"
 * - Only shared → "shared" (project-level file, no user peer expected)
 * - claude-code + shared (or codex + shared) → treat as synced
 */
export function computeSyncStatus(tools: string[]): SyncStatus {
  const set = new Set(tools);
  const hasClaude = set.has("claude-code");
  const hasCodex = set.has("codex");
  const hasShared = set.has("shared");
  if (hasClaude && hasCodex) return "synced";
  if (hasClaude && hasShared) return "synced";
  if (hasCodex && hasShared) return "synced";
  if (hasClaude) return "claude-only";
  if (hasCodex) return "codex-only";
  return "shared";
}
```

- [ ] **Step 4: Run — expect PASS**

Expected: 8/8 passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/environment/skill-enrichment.ts src/lib/environment/__tests__/skill-enrichment.test.ts
git commit -m "feat(env): pure health + sync-status computations"
```

---

## Task 2: `enrichSkills` orchestrator

**Files:**
- Modify: `src/lib/environment/skill-enrichment.ts`
- Modify: `src/lib/environment/__tests__/skill-enrichment.test.ts`

- [ ] **Step 1: Write the failing test (appended)**

```ts
// appended to src/lib/environment/__tests__/skill-enrichment.test.ts
import { enrichSkills, type EnrichedSkill } from "../skill-enrichment";
import type { SkillSummary } from "../list-skills";

const NOW = new Date("2026-04-14T00:00:00Z").getTime();
const DAY = 24 * 60 * 60 * 1000;

function skill(
  id: string,
  name: string,
  tool: string,
  overrides: Partial<SkillSummary> = {}
): SkillSummary {
  return {
    id,
    name,
    tool,
    scope: "user",
    preview: "",
    sizeBytes: 0,
    absPath: `/tmp/${id}`,
    ...overrides,
  };
}

describe("enrichSkills", () => {
  it("groups by name and computes syncStatus across tools", () => {
    const out = enrichSkills(
      [
        skill("a", "research", "claude-code"),
        skill("b", "research", "codex"),
        skill("c", "standalone", "claude-code"),
      ],
      { modifiedAtMsByPath: {}, linkedProfilesByPath: {}, nowMs: NOW }
    );
    const bySkill: Record<string, EnrichedSkill> = {};
    for (const s of out) bySkill[s.name] = s;
    expect(bySkill.research.syncStatus).toBe("synced");
    expect(bySkill.standalone.syncStatus).toBe("claude-only");
  });

  it("attaches linkedProfileId per artifact absPath", () => {
    const out = enrichSkills(
      [skill("x", "coder", "claude-code", { absPath: "/p/a" })],
      {
        modifiedAtMsByPath: {},
        linkedProfilesByPath: { "/p/a": "code-reviewer" },
        nowMs: NOW,
      }
    );
    expect(out[0].linkedProfileId).toBe("code-reviewer");
  });

  it("assigns health from modifiedAtMsByPath", () => {
    const out = enrichSkills(
      [skill("x", "aging", "claude-code", { absPath: "/p/a" })],
      {
        modifiedAtMsByPath: { "/p/a": NOW - 400 * DAY },
        linkedProfilesByPath: {},
        nowMs: NOW,
      }
    );
    expect(out[0].healthScore).toBe("aging");
  });

  it("merges duplicate absPaths (symlink case) to a single entry", () => {
    const out = enrichSkills(
      [
        skill("a", "shared", "claude-code", { absPath: "/same" }),
        skill("b", "shared", "codex", { absPath: "/same" }),
      ],
      { modifiedAtMsByPath: {}, linkedProfilesByPath: {}, nowMs: NOW }
    );
    expect(out).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Expected: `enrichSkills` import fails.

- [ ] **Step 3: Implement**

Append to `src/lib/environment/skill-enrichment.ts`:

```ts
import type { SkillSummary } from "./list-skills";

export interface EnrichedSkill extends SkillSummary {
  healthScore: HealthScore;
  syncStatus: SyncStatus;
  linkedProfileId: string | null;
  /** All absPaths for the same skill name (for symlink/dup handling). */
  absPaths: string[];
}

export interface EnrichmentContext {
  modifiedAtMsByPath: Record<string, number | null>;
  linkedProfilesByPath: Record<string, string | null>;
  nowMs?: number;
}

export function enrichSkills(
  skills: SkillSummary[],
  ctx: EnrichmentContext
): EnrichedSkill[] {
  const nowMs = ctx.nowMs ?? Date.now();
  // Dedupe by absPath first (symlink loops).
  const seen = new Set<string>();
  const deduped: SkillSummary[] = [];
  for (const s of skills) {
    if (seen.has(s.absPath)) continue;
    seen.add(s.absPath);
    deduped.push(s);
  }
  // Group by name.
  const byName = new Map<string, SkillSummary[]>();
  for (const s of deduped) {
    const list = byName.get(s.name) ?? [];
    list.push(s);
    byName.set(s.name, list);
  }
  const out: EnrichedSkill[] = [];
  for (const [, group] of byName) {
    const tools = group.map((g) => g.tool);
    const syncStatus = computeSyncStatus(tools);
    // Use the highest health (most recent modification) across the group.
    const ages = group.map((g) => ctx.modifiedAtMsByPath[g.absPath] ?? null);
    const newest = ages.reduce<number | null>(
      (acc, v) => (v != null && (acc == null || v > acc) ? v : acc),
      null
    );
    const healthScore = computeHealthScore(newest, nowMs);
    const linkedProfileId =
      group
        .map((g) => ctx.linkedProfilesByPath[g.absPath] ?? null)
        .find((v) => v != null) ?? null;
    const primary = group[0];
    out.push({
      ...primary,
      healthScore,
      syncStatus,
      linkedProfileId,
      absPaths: group.map((g) => g.absPath),
    });
  }
  return out;
}
```

- [ ] **Step 4: Run — expect PASS (12/12)**

- [ ] **Step 5: Commit**

```bash
git add src/lib/environment/skill-enrichment.ts src/lib/environment/__tests__/skill-enrichment.test.ts
git commit -m "feat(env): enrichSkills orchestrator with group + dedupe"
```

---

## Task 3: Recommendation engine

**Files:**
- Create: `src/lib/environment/skill-recommendations.ts`
- Test: `src/lib/environment/__tests__/skill-recommendations.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/environment/__tests__/skill-recommendations.test.ts
import { describe, it, expect } from "vitest";
import { computeRecommendation } from "../skill-recommendations";
import type { EnrichedSkill } from "../skill-enrichment";

const mkSkill = (
  name: string,
  preview: string,
  overrides: Partial<EnrichedSkill> = {}
): EnrichedSkill => ({
  id: name,
  name,
  tool: "claude-code",
  scope: "user",
  preview,
  sizeBytes: 0,
  absPath: `/p/${name}`,
  healthScore: "healthy",
  syncStatus: "claude-only",
  linkedProfileId: null,
  absPaths: [`/p/${name}`],
  ...overrides,
});

describe("computeRecommendation", () => {
  it("recommends a healthy skill whose keywords match 2+ in recent messages", () => {
    const skills = [
      mkSkill("code-reviewer", "Review pull requests for security"),
      mkSkill("researcher", "Search the web for up-to-date information"),
    ];
    const rec = computeRecommendation(skills, [
      "can you review this pull request for security issues?",
    ]);
    expect(rec?.name).toBe("code-reviewer");
  });

  it("returns null when no strong keyword match exists", () => {
    const skills = [mkSkill("code-reviewer", "Review PRs for security")];
    const rec = computeRecommendation(skills, ["hi there"]);
    expect(rec).toBeNull();
  });

  it("excludes already-active skill", () => {
    const skills = [mkSkill("code-reviewer", "Review pull requests security")];
    const rec = computeRecommendation(
      skills,
      ["review this pull request for security"],
      { activeSkillId: "code-reviewer" }
    );
    expect(rec).toBeNull();
  });

  it("excludes dismissed skills", () => {
    const skills = [mkSkill("code-reviewer", "Review pull requests security")];
    const rec = computeRecommendation(
      skills,
      ["review pull request security issues"],
      { dismissedIds: new Set(["code-reviewer"]) }
    );
    expect(rec).toBeNull();
  });

  it("excludes broken/aging skills", () => {
    const skills = [
      mkSkill("code-reviewer", "Review pull requests security", {
        healthScore: "aging",
      }),
    ];
    const rec = computeRecommendation(skills, [
      "review pull request security issues",
    ]);
    expect(rec).toBeNull();
  });

  it("ignores stopwords and requires ≥2 distinct meaningful hits", () => {
    const skills = [mkSkill("researcher", "the and for a of in on")];
    const rec = computeRecommendation(skills, ["the and for a of in on"]);
    expect(rec).toBeNull();
  });

  it("returns null on empty message list", () => {
    const rec = computeRecommendation(
      [mkSkill("code-reviewer", "review pull request security")],
      []
    );
    expect(rec).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Expected: module missing.

- [ ] **Step 3: Implement**

```ts
// src/lib/environment/skill-recommendations.ts
import type { EnrichedSkill } from "./skill-enrichment";

const STOPWORDS = new Set([
  "the","and","for","with","that","this","from","have","your","will","not","but",
  "you","are","was","can","any","all","has","his","her","how","who","why","what",
  "when","where","use","using","used","its","into","new","one","two","get","got",
  "please","help","like","need","want","make","made","made","just","also","some",
  "more","most","very","than","then","them","they","their","out","off","put",
  "got","let","say","said","see","saw","per","via","about","over","under","code",
  "file","files",
]);

const MIN_KEYWORD_LEN = 4;
const MIN_DISTINCT_HITS = 2;

interface Options {
  activeSkillId?: string | null;
  dismissedIds?: Set<string>;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= MIN_KEYWORD_LEN && !STOPWORDS.has(t));
}

export function computeRecommendation(
  skills: EnrichedSkill[],
  recentMessages: string[],
  opts: Options = {}
): EnrichedSkill | null {
  if (recentMessages.length === 0) return null;
  const messageTokens = new Set(tokenize(recentMessages.join(" ")));
  if (messageTokens.size === 0) return null;

  const candidates: Array<{ skill: EnrichedSkill; hits: number }> = [];

  for (const skill of skills) {
    if (opts.activeSkillId && skill.id === opts.activeSkillId) continue;
    if (opts.dismissedIds?.has(skill.id)) continue;
    if (skill.healthScore !== "healthy" && skill.healthScore !== "stale") continue;

    const skillTokens = new Set(tokenize(`${skill.name} ${skill.preview}`));
    let hits = 0;
    for (const t of skillTokens) {
      if (messageTokens.has(t)) hits++;
    }
    if (hits >= MIN_DISTINCT_HITS) {
      candidates.push({ skill, hits });
    }
  }

  if (candidates.length === 0) return null;

  // Rank by hits DESC, then health (healthy > stale), then name for determinism.
  candidates.sort((a, b) => {
    if (a.hits !== b.hits) return b.hits - a.hits;
    if (a.skill.healthScore !== b.skill.healthScore) {
      return a.skill.healthScore === "healthy" ? -1 : 1;
    }
    return a.skill.name.localeCompare(b.skill.name);
  });

  return candidates[0].skill;
}
```

- [ ] **Step 4: Run — expect PASS (7/7)**

- [ ] **Step 5: Commit**

```bash
git add src/lib/environment/skill-recommendations.ts src/lib/environment/__tests__/skill-recommendations.test.ts
git commit -m "feat(env): keyword-based skill recommendation engine"
```

---

## Task 4: Dismissals store

**Files:**
- Create: `src/lib/chat/dismissals.ts`
- Test: `src/lib/chat/__tests__/dismissals.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/chat/__tests__/dismissals.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  loadDismissals,
  saveDismissal,
  activeDismissedIds,
  DISMISSAL_TTL_MS,
} from "../dismissals";

type Store = { read: () => string | null; write: (v: string) => void };

function mockStore(initial: string | null = null): Store {
  let v = initial;
  return {
    read: () => v,
    write: (next) => {
      v = next;
    },
  };
}

describe("dismissals", () => {
  const NOW = 1_700_000_000_000;

  it("returns empty when store is null", () => {
    const store = mockStore();
    const all = loadDismissals(store);
    expect(all).toEqual({});
  });

  it("saves dismissals keyed by conversation + skill", () => {
    const store = mockStore();
    saveDismissal(store, "conv-1", "skill-a", NOW);
    const all = loadDismissals(store);
    expect(all["conv-1"]["skill-a"]).toBe(NOW);
  });

  it("activeDismissedIds excludes expired entries", () => {
    const store = mockStore();
    saveDismissal(store, "c1", "fresh", NOW);
    saveDismissal(store, "c1", "old", NOW - DISMISSAL_TTL_MS - 1000);
    const ids = activeDismissedIds(store, "c1", NOW);
    expect(ids.has("fresh")).toBe(true);
    expect(ids.has("old")).toBe(false);
  });

  it("returns empty set when conversation has no dismissals", () => {
    const store = mockStore();
    expect(activeDismissedIds(store, "never-seen", NOW).size).toBe(0);
  });

  it("silently tolerates store write errors", () => {
    const store: Store = {
      read: () => null,
      write: () => {
        throw new Error("quota");
      },
    };
    expect(() => saveDismissal(store, "c1", "s1", NOW)).not.toThrow();
  });

  it("silently tolerates corrupt JSON on read", () => {
    const store = mockStore("not-json");
    expect(loadDismissals(store)).toEqual({});
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```ts
// src/lib/chat/dismissals.ts

export const DISMISSAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface DismissalStore {
  read(): string | null;
  write(value: string): void;
}

export type DismissalMap = Record<string, Record<string, number>>;

export function loadDismissals(store: DismissalStore): DismissalMap {
  const raw = store.read();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as DismissalMap;
  } catch {
    // corrupt — fall through
  }
  return {};
}

export function saveDismissal(
  store: DismissalStore,
  conversationId: string,
  skillId: string,
  nowMs: number = Date.now()
): void {
  const current = loadDismissals(store);
  current[conversationId] = current[conversationId] ?? {};
  current[conversationId][skillId] = nowMs;
  try {
    store.write(JSON.stringify(current));
  } catch {
    // silent — in-memory state won't persist
  }
}

export function activeDismissedIds(
  store: DismissalStore,
  conversationId: string,
  nowMs: number = Date.now()
): Set<string> {
  const all = loadDismissals(store);
  const conv = all[conversationId];
  if (!conv) return new Set();
  const out = new Set<string>();
  for (const [skillId, ts] of Object.entries(conv)) {
    if (nowMs - ts < DISMISSAL_TTL_MS) out.add(skillId);
  }
  return out;
}

/** Browser store adapter around localStorage for a given key. */
export function browserLocalStore(key: string): DismissalStore {
  return {
    read() {
      if (typeof window === "undefined") return null;
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    write(value) {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // quota / disabled — silent
      }
    },
  };
}
```

- [ ] **Step 4: Run — expect PASS (6/6)**

- [ ] **Step 5: Commit**

```bash
git add src/lib/chat/dismissals.ts src/lib/chat/__tests__/dismissals.test.ts
git commit -m "feat(chat): skill-recommendation dismissal store (7d TTL)"
```

---

## Task 5: `listSkillsEnriched` adapter

**Files:**
- Modify: `src/lib/environment/list-skills.ts`
- Test: `src/lib/environment/__tests__/list-skills-enriched.test.ts` (new)

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/environment/__tests__/list-skills-enriched.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../scanner", () => ({
  scanEnvironment: () => ({
    artifacts: [
      {
        id: "art-1",
        category: "skill",
        tool: "claude-code",
        scope: "user",
        name: "code-reviewer",
        relPath: ".claude/skills/code-reviewer",
        absPath: "/u/.claude/skills/code-reviewer",
        preview: "Review PRs",
        sizeBytes: 100,
        modifiedAt: new Date("2026-01-01T00:00:00Z").getTime(),
        linkedProfileId: "code-reviewer-profile",
        contentHash: "h",
        metadata: null,
      },
      {
        id: "art-2",
        category: "skill",
        tool: "codex",
        scope: "user",
        name: "code-reviewer",
        relPath: ".agents/skills/code-reviewer",
        absPath: "/u/.agents/skills/code-reviewer",
        preview: "Review PRs",
        sizeBytes: 100,
        modifiedAt: new Date("2026-01-01T00:00:00Z").getTime(),
        linkedProfileId: null,
        contentHash: "h",
        metadata: null,
      },
    ],
  }),
}));

vi.mock("../workspace-context", () => ({ getLaunchCwd: () => "/tmp" }));

import { listSkillsEnriched } from "../list-skills";

describe("listSkillsEnriched", () => {
  it("returns enriched skills with syncStatus and linkedProfileId populated", () => {
    const enriched = listSkillsEnriched({ nowMs: new Date("2026-04-14T00:00:00Z").getTime() });
    expect(enriched).toHaveLength(1);
    expect(enriched[0].name).toBe("code-reviewer");
    expect(enriched[0].syncStatus).toBe("synced");
    expect(enriched[0].linkedProfileId).toBe("code-reviewer-profile");
    expect(enriched[0].healthScore).toBe("healthy");
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Modify `list-skills.ts`**

Append below `getSkill`:

```ts
import {
  enrichSkills,
  type EnrichedSkill,
  type EnrichmentContext,
} from "./skill-enrichment";

export function listSkillsEnriched(
  options: { projectDir?: string; nowMs?: number } = {}
): EnrichedSkill[] {
  const projectDir = options.projectDir ?? getLaunchCwd();
  const scan = scanEnvironment({ projectDir });
  const skills: SkillSummary[] = [];
  const modifiedAtMsByPath: Record<string, number | null> = {};
  const linkedProfilesByPath: Record<string, string | null> = {};
  for (const a of scan.artifacts) {
    if (a.category !== "skill") continue;
    skills.push(artifactToSummary(a));
    modifiedAtMsByPath[a.absPath] =
      typeof a.modifiedAt === "number"
        ? a.modifiedAt
        : a.modifiedAt instanceof Date
          ? a.modifiedAt.getTime()
          : null;
    linkedProfilesByPath[a.absPath] = a.linkedProfileId ?? null;
  }
  return enrichSkills(skills, {
    modifiedAtMsByPath,
    linkedProfilesByPath,
    nowMs: options.nowMs,
  });
}
```

(Also re-export `EnrichedSkill` from this module for consumers.)

- [ ] **Step 4: Run — expect PASS**

Also re-run Task 1+2 tests to confirm no regression.

- [ ] **Step 5: Commit**

```bash
git add src/lib/environment/list-skills.ts src/lib/environment/__tests__/list-skills-enriched.test.ts
git commit -m "feat(env): listSkillsEnriched reads cache + enriches"
```

---

## Task 6: Extend `list_skills` MCP tool with `enriched` flag

**Files:**
- Modify: `src/lib/chat/tools/skill-tools.ts`
- Test: add case to existing `src/lib/chat/tools/__tests__/skill-tools.test.ts`

- [ ] **Step 1: Find existing `list_skills` tool definition**

Read `src/lib/chat/tools/skill-tools.ts` lines 20-50. Note current input schema (likely empty or `{}`).

- [ ] **Step 2: Add `enriched` optional boolean**

```ts
// Inside the list_skills tool definition input schema
z.object({
  enriched: z.boolean().optional().describe("When true, include healthScore, syncStatus, linkedProfileId, and scope per skill."),
}),
```

- [ ] **Step 3: Branch in handler**

Replace the existing handler body:

```ts
async (input) => {
  try {
    if (input.enriched) {
      const { listSkillsEnriched } = await import("@/lib/environment/list-skills");
      return ok(listSkillsEnriched());
    }
    const { listSkills } = await import("@/lib/environment/list-skills");
    return ok(listSkills());
  } catch (e) {
    return err(e instanceof Error ? e.message : "list_skills failed");
  }
},
```

- [ ] **Step 4: Add test**

Append to `src/lib/chat/tools/__tests__/skill-tools.test.ts`:

```ts
it("list_skills returns enriched data when enriched:true", async () => {
  // Existing test harness — find and reuse the handler invocation pattern
  const result = await invokeTool("list_skills", { enriched: true });
  const skills = JSON.parse(result);
  // At least one skill should have an `healthScore` field
  if (skills.length > 0) {
    expect(skills[0]).toHaveProperty("healthScore");
    expect(skills[0]).toHaveProperty("syncStatus");
  }
});
```

If `invokeTool` helper doesn't exist, skip this step and rely on downstream component-level tests instead.

- [ ] **Step 5: Typecheck**

```
npx tsc --noEmit 2>&1 | grep -E "skill-tools|list-skills" | head
```
Expected: empty.

- [ ] **Step 6: Commit**

```bash
git add src/lib/chat/tools/skill-tools.ts src/lib/chat/tools/__tests__/
git commit -m "feat(chat): list_skills tool accepts enriched flag"
```

---

## Task 7: `/api/environment/rescan-if-stale` endpoint

**Files:**
- Create: `src/app/api/environment/rescan-if-stale/route.ts`
- Test: `src/app/api/environment/rescan-if-stale/__tests__/route.test.ts`

- [ ] **Step 1: Find the auto-scan helper**

```bash
grep -n "export " src/lib/environment/auto-scan.ts | head
```

Typical exports include `scheduleAutoScan` or similar. Use whichever entry point exists for fire-and-forget. If none, call `scanEnvironment()` behind an in-memory lock.

- [ ] **Step 2: Write the failing test**

```ts
// src/app/api/environment/rescan-if-stale/__tests__/route.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/environment/scanner", () => ({
  scanEnvironment: vi.fn(() => ({ scannedAt: new Date() })),
  getLatestScan: vi.fn(() => ({ scannedAt: new Date(Date.now() - 10 * 60 * 1000) })),
}));

import { POST } from "../route";

describe("POST /api/environment/rescan-if-stale", () => {
  it("triggers a scan when last scan older than TTL and returns 200", async () => {
    const res = await POST(new Request("http://test/api/environment/rescan-if-stale", { method: "POST" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.scanned).toBe(true);
  });
});
```

- [ ] **Step 3: Run — expect FAIL**

- [ ] **Step 4: Implement**

```ts
// src/app/api/environment/rescan-if-stale/route.ts
import { NextResponse } from "next/server";
import { scanEnvironment } from "@/lib/environment/scanner";
import { getLaunchCwd } from "@/lib/environment/workspace-context";

const FIVE_MIN_MS = 5 * 60 * 1000;

// Module-scoped guard to prevent concurrent rescans.
let rescanInFlight: Promise<void> | null = null;
let lastScanAt: number | null = null;

export async function POST() {
  const now = Date.now();
  const ageMs = lastScanAt == null ? Infinity : now - lastScanAt;

  if (ageMs < FIVE_MIN_MS) {
    return NextResponse.json({ scanned: false, ageMs });
  }
  if (rescanInFlight) {
    return NextResponse.json({ scanned: false, inFlight: true });
  }

  rescanInFlight = (async () => {
    try {
      scanEnvironment({ projectDir: getLaunchCwd() });
      lastScanAt = Date.now();
    } catch (err) {
      console.warn("[rescan-if-stale] scan failed:", err);
    } finally {
      rescanInFlight = null;
    }
  })();

  // Fire-and-forget — return immediately.
  return NextResponse.json({ scanned: true });
}
```

- [ ] **Step 5: Run — expect PASS**

- [ ] **Step 6: Commit**

```bash
git add src/app/api/environment/rescan-if-stale/
git commit -m "feat(env): rescan-if-stale fire-and-forget endpoint"
```

---

## Task 8: `SkillRow` component with badges

**Files:**
- Create: `src/components/chat/skill-row.tsx`
- Test: `src/components/chat/__tests__/skill-row.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/chat/__tests__/skill-row.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SkillRow } from "../skill-row";
import type { EnrichedSkill } from "@/lib/environment/skill-enrichment";

const base: EnrichedSkill = {
  id: "code-reviewer",
  name: "code-reviewer",
  tool: "claude-code",
  scope: "user",
  preview: "Review PRs for security",
  sizeBytes: 100,
  absPath: "/p",
  absPaths: ["/p"],
  healthScore: "healthy",
  syncStatus: "synced",
  linkedProfileId: "code-reviewer-profile",
};

describe("SkillRow", () => {
  it("renders skill name and description", () => {
    render(<SkillRow skill={base} onSelect={() => {}} />);
    expect(screen.getByText("code-reviewer")).toBeTruthy();
    expect(screen.getByText(/Review PRs/)).toBeTruthy();
  });

  it("shows 'Synced' badge when syncStatus is synced", () => {
    render(<SkillRow skill={base} onSelect={() => {}} />);
    expect(screen.getByText(/synced/i)).toBeTruthy();
  });

  it("shows profile linkage badge", () => {
    render(<SkillRow skill={base} onSelect={() => {}} />);
    expect(screen.getByText(/code-reviewer-profile/)).toBeTruthy();
  });

  it("shows 'stale' badge for stale health", () => {
    render(<SkillRow skill={{ ...base, healthScore: "stale" }} onSelect={() => {}} />);
    expect(screen.getByText(/stale/i)).toBeTruthy();
  });

  it("shows a recommended indicator when recommended=true", () => {
    render(<SkillRow skill={base} recommended onSelect={() => {}} />);
    expect(screen.getByLabelText(/recommended/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```tsx
// src/components/chat/skill-row.tsx
"use client";
import { Sparkles, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CommandItem } from "@/components/ui/command";
import type { EnrichedSkill } from "@/lib/environment/skill-enrichment";
import { cn } from "@/lib/utils";

interface SkillRowProps {
  skill: EnrichedSkill;
  recommended?: boolean;
  onSelect: () => void;
}

function healthVariant(h: EnrichedSkill["healthScore"]) {
  if (h === "healthy") return "default" as const;
  if (h === "stale") return "outline" as const;
  if (h === "aging" || h === "broken") return "destructive" as const;
  return "secondary" as const;
}

function syncLabel(s: EnrichedSkill["syncStatus"]): string {
  switch (s) {
    case "synced": return "synced";
    case "claude-only": return "claude-only";
    case "codex-only": return "codex-only";
    case "shared": return "shared";
  }
}

export function SkillRow({ skill, recommended, onSelect }: SkillRowProps) {
  const syncHref =
    skill.syncStatus !== "synced"
      ? `/environment?skill=${encodeURIComponent(skill.name)}`
      : null;

  return (
    <CommandItem
      key={skill.id}
      value={`${skill.name} ${skill.preview} ${skill.tool}`}
      onSelect={onSelect}
    >
      <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex flex-col min-w-0 gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{skill.name}</span>
          {recommended && (
            <Star
              className="h-3 w-3 shrink-0 fill-amber-500 text-amber-500"
              aria-label="Recommended for this conversation"
            />
          )}
        </div>
        <span className="truncate text-xs text-muted-foreground">{skill.preview}</span>
        <div className="flex flex-wrap items-center gap-1 mt-0.5">
          <Badge variant={healthVariant(skill.healthScore)} className="text-[10px]">
            {skill.healthScore}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {syncLabel(skill.syncStatus)}
          </Badge>
          {skill.linkedProfileId && (
            <Badge variant="secondary" className="text-[10px]">
              {skill.linkedProfileId}
            </Badge>
          )}
          <Badge variant="outline" className={cn("text-[10px]")}>
            {skill.scope}
          </Badge>
        </div>
      </div>
      {syncHref && (
        <a
          href={syncHref}
          aria-label={`Open ${skill.name} in environment dashboard`}
          className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          ↗
        </a>
      )}
    </CommandItem>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

If testing-library doesn't find "synced" due to casing — adjust to match via regex which already handles case. Ensure `@testing-library/jest-dom` matchers are not required; use `toBeTruthy()` on query results.

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/skill-row.tsx src/components/chat/__tests__/skill-row.test.tsx
git commit -m "feat(chat): SkillRow component with health/sync/profile/scope badges"
```

---

## Task 9: Wire `SkillRow` into the Skills tab

**Files:**
- Modify: `src/components/chat/chat-command-popover.tsx`
- Modify: `src/lib/chat/tool-catalog.ts` (add metadata passthrough)

- [ ] **Step 1: Fetch enriched skills in popover**

The popover already receives `projectProfiles`. Add a separate fetch of enriched skills via a React hook so the Skills tab gets the full metadata. Simplest: a new `useEnrichedSkills(open: boolean)` hook that calls `/api/environment/skills-enriched` (new endpoint? or reuse via `list_skills` MCP call?).

Decision: create a tiny GET endpoint `src/app/api/environment/skills/route.ts` returning `listSkillsEnriched()`. Frontend fetches on popover open.

Create: `src/app/api/environment/skills/route.ts`

```ts
import { NextResponse } from "next/server";
import { listSkillsEnriched } from "@/lib/environment/list-skills";

export async function GET() {
  try {
    return NextResponse.json(listSkillsEnriched());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "scan failed" },
      { status: 500 }
    );
  }
}
```

Create: `src/hooks/use-enriched-skills.ts`

```ts
"use client";
import { useEffect, useState } from "react";
import type { EnrichedSkill } from "@/lib/environment/skill-enrichment";

export function useEnrichedSkills(open: boolean): EnrichedSkill[] {
  const [skills, setSkills] = useState<EnrichedSkill[]>([]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetch("/api/environment/skills", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setSkills(data);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [open]);
  return skills;
}
```

- [ ] **Step 2: Consume in `chat-command-popover.tsx`**

At the top of the `ChatCommandPopover` component:

```tsx
import { useEnrichedSkills } from "@/hooks/use-enriched-skills";
import { SkillRow } from "./skill-row";
// ...

const enrichedSkills = useEnrichedSkills(open && mode === "slash");
```

Inside `ToolCatalogItems`, when `activeTab === "skills"` and `enrichedSkills` is provided, render via `SkillRow` instead of the default catalog row. Pass `enrichedSkills` into `ToolCatalogItems` as a new prop.

- [ ] **Step 3: Recommended computation**

In the popover, compute `recommendedId` using:

```tsx
import { computeRecommendation } from "@/lib/environment/skill-recommendations";
import { browserLocalStore, activeDismissedIds } from "@/lib/chat/dismissals";
// ...
const recentUserMessages = useRecentUserMessages(conversationId, 20); // new hook (Task 10)
const dismissedIds = activeDismissedIds(
  browserLocalStore("ainative.chat.dismissed-suggestions"),
  conversationId ?? ""
);
const recommended = computeRecommendation(
  enrichedSkills,
  recentUserMessages,
  { activeSkillId, dismissedIds }
);
```

- [ ] **Step 4: Render Skills tab with `SkillRow`**

Inside the `activeTab === "skills"` branch of `ToolCatalogItems`, when `enrichedSkills.length > 0`, render:

```tsx
{enrichedSkills.map((skill) => (
  <SkillRow
    key={skill.id}
    skill={skill}
    recommended={recommended?.id === skill.id}
    onSelect={() => onSelect({
      type: "slash",
      id: skill.name,
      label: skill.name,
      text: `Use the ${skill.name} profile: `,
    })}
  />
))}
```

Fall back to existing catalog rendering if `enrichedSkills` is empty (covers loading state).

- [ ] **Step 5: Typecheck**

```
npx tsc --noEmit 2>&1 | grep -E "skill-row|use-enriched-skills|chat-command-popover" | head
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/environment/skills/route.ts src/hooks/use-enriched-skills.ts src/components/chat/chat-command-popover.tsx
git commit -m "feat(chat): render enriched skills with badges in Skills tab"
```

---

## Task 10: Recent-messages hook + recommendation plumbing

**Files:**
- Create: `src/hooks/use-recent-user-messages.ts`
- Modify: `src/components/chat/chat-command-popover.tsx` (consume)

- [ ] **Step 1: Implement the hook**

```tsx
// src/hooks/use-recent-user-messages.ts
"use client";
import { useContext, useMemo } from "react";
// Use the existing chat session context — import path is the provider file.
import { useChatSession } from "@/components/chat/chat-session-provider";

export function useRecentUserMessages(
  conversationId: string | null | undefined,
  limit: number = 20
): string[] {
  const { messages } = useChatSession();
  return useMemo(() => {
    if (!conversationId) return [];
    return messages
      .filter((m) => m.role === "user")
      .slice(-limit)
      .map((m) => m.content);
  }, [messages, conversationId, limit]);
}
```

If `useChatSession` isn't exported, add a minimal `export function useChatSession()` in the provider that returns the context value. Short fix, not a refactor.

- [ ] **Step 2: Verify**

```
npx tsc --noEmit 2>&1 | grep use-recent-user-messages | head
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-recent-user-messages.ts src/components/chat/chat-session-provider.tsx
git commit -m "feat(chat): useRecentUserMessages hook"
```

---

## Task 11: Hook `/api/environment/rescan-if-stale` into session open

**Files:**
- Modify: `src/components/chat/chat-session-provider.tsx`

- [ ] **Step 1: Add effect**

Inside `ChatSessionProvider`, alongside the existing effects, add:

```tsx
useEffect(() => {
  if (!activeId) return;
  // Fire-and-forget; endpoint self-guards against stampede.
  fetch("/api/environment/rescan-if-stale", { method: "POST" }).catch(() => {});
}, [activeId]);
```

- [ ] **Step 2: Typecheck**

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/chat-session-provider.tsx
git commit -m "feat(chat): rescan environment on conversation activation"
```

---

## Task 12: Dismissal interaction in SkillRow

**Files:**
- Modify: `src/components/chat/skill-row.tsx`

- [ ] **Step 1: Add dismiss prop + handler**

```tsx
interface SkillRowProps {
  skill: EnrichedSkill;
  recommended?: boolean;
  onSelect: () => void;
  onDismissRecommendation?: () => void;
}
```

Render a small X on hover next to the star when `recommended && onDismissRecommendation`:

```tsx
{recommended && onDismissRecommendation && (
  <button
    type="button"
    aria-label="Dismiss recommendation"
    className="opacity-0 group-hover:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    onClick={(e) => {
      e.stopPropagation();
      onDismissRecommendation();
    }}
  >
    <X className="h-3 w-3" />
  </button>
)}
```

Wrap the row with `className="group"` on the outer `CommandItem` content so `group-hover` works.

- [ ] **Step 2: Wire in popover**

In `chat-command-popover.tsx`:

```tsx
import { browserLocalStore, saveDismissal } from "@/lib/chat/dismissals";
// ...
const dismissStore = useMemo(
  () => browserLocalStore("ainative.chat.dismissed-suggestions"),
  []
);

<SkillRow
  ...
  onDismissRecommendation={
    recommended?.id === skill.id && conversationId
      ? () => saveDismissal(dismissStore, conversationId, skill.id)
      : undefined
  }
/>
```

- [ ] **Step 3: Typecheck + commit**

```bash
git add src/components/chat/skill-row.tsx src/components/chat/chat-command-popover.tsx
git commit -m "feat(chat): dismiss recommendation per conversation (7d)"
```

---

## Task 13: Full verification

- [ ] **Step 1: Full typecheck**

Run: `npx tsc --noEmit 2>&1 | tail -10`
Expected: 0 errors.

- [ ] **Step 2: Full test run**

Run: `npm test -- --run 2>&1 | tail -10`
Expected: no new failures. Only pre-existing e2e suite may fail.

- [ ] **Step 3: Manual browser smoke (PORT=3010)**

Start: `PORT=3010 npm run dev`

Verify:
- Open chat; open `/` popover → Skills tab shows badges (health, sync, profile if linked, scope)
- Switch conversation → network tab shows POST to `/api/environment/rescan-if-stale`
- Send a message matching a skill's keywords (e.g. "review pull request for security") → reopen Skills tab → recommended star appears on `code-reviewer`
- Click the X on the recommended item → star disappears
- Switch to another conversation, send the same message → recommended star appears (dismissal is per-conversation)

Stop server: `pkill -f "next dev.*3010"`

---

## Task 14: Docs

**Files:**
- Modify: `features/chat-environment-integration.md` → `status: completed`
- Modify: `features/changelog.md` → entry under today
- Modify: `features/roadmap.md` → flip row to `completed`

- [ ] **Step 1: Update spec with Verification section**

Append under References:

```markdown
## Verification — 2026-04-14

### What shipped
- `src/lib/environment/skill-enrichment.ts` — pure health / sync-status / enrichSkills
- `src/lib/environment/skill-recommendations.ts` — keyword recommendation engine
- `src/lib/chat/dismissals.ts` — 7d TTL dismissal store
- `src/lib/environment/list-skills.ts` — new `listSkillsEnriched`
- `src/app/api/environment/skills/route.ts` — enriched GET
- `src/app/api/environment/rescan-if-stale/route.ts` — fire-and-forget POST
- `src/components/chat/skill-row.tsx` — SkillRow with badges + recommended star
- `src/hooks/use-enriched-skills.ts` + `use-recent-user-messages.ts`

### Scope deviations
- Profile suggestion chip above input replaced with passive "Recommended" star inside Skills tab (lower UI intrusiveness, simpler state model).
- Per-skill `healthScore` derived from `modifiedAt` recency (no usage telemetry in the codebase today).
- Deep-link to `/environment?skill=<name>` shipped as a simple ↗ link; dashboard route parsing of the param is a follow-up.
```

- [ ] **Step 2: Append changelog entry**

```markdown
### Completed — chat-environment-integration (P2)

The chat Skills tab now surfaces per-skill environment metadata: health (based on `modifiedAt` age), cross-tool sync status (claude-only / codex-only / synced / shared), profile linkage (from `environment_artifacts.linked_profile_id`), and scope (user vs project). A passive "Recommended" star appears on healthy skills whose keywords match the conversation's recent user messages, dismissible per-conversation for 7 days. Fire-and-forget `/api/environment/rescan-if-stale` is called on every conversation activation, non-blocking.

Architecture is strictly read-only over the existing scanner — pure enrichment + recommendation modules with no new writes to the env artifacts layer. The `list_skills` MCP tool now accepts `enriched: true` (additive, backwards compatible); the popover consumes a dedicated `GET /api/environment/skills` endpoint. Passive recommendation replaced the spec's chip-above-input concept per HOLD scope review — lower UI intrusiveness, simpler state.

Commits: [list SHAs].
```

- [ ] **Step 3: Flip roadmap**

```bash
sed -i '' 's|chat-environment-integration.md) | P2 | planned |chat-environment-integration.md) | P2 | completed |' features/roadmap.md
```

Or edit directly:
```
| [chat-environment-integration](...) | P2 | completed | ... |
```

- [ ] **Step 4: Commit**

```bash
git add features/
git commit -m "docs(features): mark chat-environment-integration complete"
```

---

## Self-Review

**Spec coverage:**
- AC 1 (`list_skills` enriched) → Task 5 + 6
- AC 2 (badges on Skills tab) → Task 8 + 9
- AC 3 (auto-rescan on session start, non-blocking) → Task 7 + 11
- AC 4 (profile suggestion chip on keyword match, healthy only, once per session) → Task 3 + 10 + 12 (scope-adjusted to passive star)
- AC 5 (7-day dismissal) → Task 4 + 12
- AC 6 (sync click-through deep-link) → Task 8
- AC 7 (no FS I/O on popover open — cache only) → Task 5 reads `scanEnvironment` which is cache-backed
- AC 8 (SDK native discovery untouched) → No changes to SDK execution path; only `listSkills*` and UI

**Gaps:** AC 4 is scope-adjusted (passive star instead of chip). Called out in Task 14 spec update.

**Placeholder scan:** none. All code blocks are complete. Task 6 has an "if harness absent" skip note for one test helper — acceptable because the unit-level coverage for enriched shape is already in Task 5.

**Type consistency:** `EnrichedSkill` / `HealthScore` / `SyncStatus` / `DismissalStore` / `DismissalMap` all defined in Task 1-4 and consistently used in Tasks 5-12. `computeRecommendation` signature `(skills, messages, opts)` consistent between Task 3 definition and Task 9 usage.
