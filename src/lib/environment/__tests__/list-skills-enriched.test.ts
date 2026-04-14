import { describe, it, expect, vi } from "vitest";

vi.mock("../data", () => ({
  getLatestScan: () => ({ id: "scan-1" }),
  getArtifacts: () => [
    {
      id: "art-1",
      scanId: "scan-1",
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
      createdAt: new Date(),
    },
    {
      id: "art-2",
      scanId: "scan-1",
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
      createdAt: new Date(),
    },
  ],
}));

import { listSkillsEnriched } from "../list-skills";

describe("listSkillsEnriched", () => {
  it("returns enriched skills with syncStatus and linkedProfileId populated", () => {
    const nowMs = new Date("2026-04-14T00:00:00Z").getTime();
    const enriched = listSkillsEnriched({ nowMs });
    expect(enriched).toHaveLength(1);
    expect(enriched[0].name).toBe("code-reviewer");
    expect(enriched[0].syncStatus).toBe("synced");
    expect(enriched[0].linkedProfileId).toBe("code-reviewer-profile");
    expect(enriched[0].healthScore).toBe("healthy");
  });
});
