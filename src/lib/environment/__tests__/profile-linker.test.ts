import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => {
  const rows: Array<Record<string, unknown>> = [];
  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            all: vi.fn(() => rows),
          })),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            run: vi.fn(),
          })),
        })),
      })),
      __rows: rows,
    },
  };
});

vi.mock("@/lib/db/schema", () => ({
  environmentArtifacts: {
    scanId: "scan_id",
    category: "category",
    id: "id",
    linkedProfileId: "linked_profile_id",
  },
}));

vi.mock("@/lib/agents/profiles/registry", () => ({
  listAllProfiles: vi.fn(() => []),
}));

import { linkArtifactsToProfiles } from "../profile-linker";
import { listAllProfiles } from "@/lib/agents/profiles/registry";
import { db } from "@/lib/db";

const mockListAllProfiles = listAllProfiles as ReturnType<typeof vi.fn>;

function makeArtifact(id: string, name: string, absPath: string) {
  return {
    id,
    scanId: "scan-1",
    tool: "claude-code",
    category: "skill",
    scope: "user",
    name,
    relPath: `skills/${name}/SKILL.md`,
    absPath,
    contentHash: "abc123",
    preview: null,
    metadata: null,
    sizeBytes: 100,
    modifiedAt: Date.now(),
    linkedProfileId: null,
    createdAt: new Date(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("linkArtifactsToProfiles", () => {
  it("returns zeros when no skill artifacts exist", () => {
    // Mock select to return empty array for skill artifacts
    const mockAll = vi.fn(() => []);
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          all: mockAll,
        })),
      })),
    });

    const result = linkArtifactsToProfiles("scan-1");
    expect(result.linked).toBe(0);
    expect(result.unlinked).toBe(0);
    expect(result.unlinkedArtifactIds).toEqual([]);
  });

  it("links artifacts to matching profiles by directory basename", () => {
    const artifacts = [
      makeArtifact("a1", "code-reviewer", "/home/.claude/skills/code-reviewer/SKILL.md"),
      makeArtifact("a2", "researcher", "/home/.claude/skills/researcher/SKILL.md"),
    ];

    const mockAll = vi.fn(() => artifacts);
    const mockRun = vi.fn();
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          all: mockAll,
        })),
      })),
    });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          run: mockRun,
        })),
      })),
    });

    mockListAllProfiles.mockReturnValue([
      { id: "code-reviewer", name: "Code Reviewer" },
      { id: "researcher", name: "Researcher" },
    ]);

    const result = linkArtifactsToProfiles("scan-1");
    expect(result.linked).toBe(2);
    expect(result.unlinked).toBe(0);
    expect(db.update).toHaveBeenCalledTimes(2);
  });

  it("marks unmatched artifacts as unlinked", () => {
    const artifacts = [
      makeArtifact("a1", "code-reviewer", "/home/.claude/skills/code-reviewer/SKILL.md"),
      makeArtifact("a2", "unknown-skill", "/home/.claude/skills/unknown-skill/SKILL.md"),
    ];

    const mockAll = vi.fn(() => artifacts);
    const mockRun = vi.fn();
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          all: mockAll,
        })),
      })),
    });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          run: mockRun,
        })),
      })),
    });

    mockListAllProfiles.mockReturnValue([
      { id: "code-reviewer", name: "Code Reviewer" },
    ]);

    const result = linkArtifactsToProfiles("scan-1");
    expect(result.linked).toBe(1);
    expect(result.unlinked).toBe(1);
    expect(result.unlinkedArtifactIds).toContain("a2");
  });
});
