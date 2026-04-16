import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/settings/helpers", () => ({
  getSettingSync: vi.fn(),
}));

vi.mock("../profile-linker", () => ({
  linkArtifactsToProfiles: vi.fn(),
}));

// The module under test depends on suggestProfilesTiered + createProfileFromSuggestion,
// which live in the same file. We test via the real function but stub its
// collaborators (getArtifacts + listProfiles) through their imported modules.
vi.mock("../data", () => ({
  getArtifacts: vi.fn(() => []),
}));

vi.mock("@/lib/agents/profiles/registry", () => ({
  listProfiles: vi.fn(() => []),
  createPromotedProfile: vi.fn(),
}));

import { autoPromoteUnlinkedSkills } from "../profile-generator";
import { getSettingSync } from "@/lib/settings/helpers";
import { linkArtifactsToProfiles } from "../profile-linker";
import { getArtifacts } from "../data";
import { createPromotedProfile } from "@/lib/agents/profiles/registry";

const mockGetSettingSync = getSettingSync as ReturnType<typeof vi.fn>;
const mockLinker = linkArtifactsToProfiles as ReturnType<typeof vi.fn>;
const mockGetArtifacts = getArtifacts as ReturnType<typeof vi.fn>;
const mockCreateProfile = createPromotedProfile as ReturnType<typeof vi.fn>;

function unlinkedSkill(name: string) {
  return {
    id: `art-${name}`,
    scanId: "scan-1",
    tool: "claude-code",
    category: "skill",
    scope: "user",
    name,
    relPath: `${name}/SKILL.md`,
    absPath: `/home/u/.claude/skills/${name}/SKILL.md`,
    contentHash: "abc",
    preview: `---\nname: ${name}\ndescription: A ${name} skill\n---\n`,
    metadata: null,
    sizeBytes: 100,
    modifiedAt: new Date(),
    createdAt: new Date(),
    linkedProfileId: null,
  };
}

describe("autoPromoteUnlinkedSkills", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty result when setting is disabled", () => {
    mockGetSettingSync.mockReturnValue("false");
    mockGetArtifacts.mockReturnValue([unlinkedSkill("alpha")]);

    const result = autoPromoteUnlinkedSkills("scan-1");

    expect(result.created).toEqual([]);
    expect(mockCreateProfile).not.toHaveBeenCalled();
    expect(mockLinker).not.toHaveBeenCalled();
  });

  it("returns empty result when setting is missing (default off)", () => {
    mockGetSettingSync.mockReturnValue(null);
    mockGetArtifacts.mockReturnValue([unlinkedSkill("alpha")]);

    const result = autoPromoteUnlinkedSkills("scan-1");

    expect(result.created).toEqual([]);
    expect(mockCreateProfile).not.toHaveBeenCalled();
  });

  it("creates profiles for every Tier 2 suggestion and re-links when enabled", () => {
    mockGetSettingSync.mockReturnValue("true");
    mockGetArtifacts.mockReturnValue([
      unlinkedSkill("alpha"),
      unlinkedSkill("beta"),
    ]);

    const result = autoPromoteUnlinkedSkills("scan-1");

    expect(mockCreateProfile).toHaveBeenCalledTimes(2);
    expect(result.created).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
    expect(mockLinker).toHaveBeenCalledWith("scan-1");
  });

  it("counts 'already exists' failures as skipped, not errors", () => {
    mockGetSettingSync.mockReturnValue("true");
    mockGetArtifacts.mockReturnValue([unlinkedSkill("gamma")]);
    mockCreateProfile.mockImplementationOnce(() => {
      throw new Error("profile already exists");
    });

    const result = autoPromoteUnlinkedSkills("scan-1");

    expect(result.created).toEqual([]);
    expect(result.skipped).toHaveLength(1);
    expect(result.errors).toEqual([]);
    // No re-link when nothing was created
    expect(mockLinker).not.toHaveBeenCalled();
  });

  it("records non-duplicate errors and still re-links when some profiles succeeded", () => {
    mockGetSettingSync.mockReturnValue("true");
    mockGetArtifacts.mockReturnValue([
      unlinkedSkill("delta"),
      unlinkedSkill("epsilon"),
    ]);
    mockCreateProfile
      .mockImplementationOnce(() => {
        /* succeeds */
      })
      .mockImplementationOnce(() => {
        throw new Error("disk full");
      });

    const result = autoPromoteUnlinkedSkills("scan-1");

    expect(result.created).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toBe("disk full");
    expect(mockLinker).toHaveBeenCalledWith("scan-1");
  });
});
