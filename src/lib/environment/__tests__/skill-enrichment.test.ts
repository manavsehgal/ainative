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

  it("returns 'synced' when claude + shared", () => {
    expect(computeSyncStatus(["claude-code", "shared"])).toBe("synced");
  });
});

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
