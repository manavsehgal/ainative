import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { scanProjectProfiles, getProjectProfile } from "../project-profiles";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "project-profiles-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function createSkillsDir(projectDir: string) {
  const skillsDir = path.join(projectDir, ".claude", "skills");
  fs.mkdirSync(skillsDir, { recursive: true });
  return skillsDir;
}

describe("scanProjectProfiles", () => {
  it("returns empty array when no .claude/skills/ exists", () => {
    const profiles = scanProjectProfiles(tmpDir);
    expect(profiles).toEqual([]);
  });

  it("discovers SKILL.md-only skills with minimal profile", () => {
    const skillsDir = createSkillsDir(tmpDir);
    const skillDir = path.join(skillsDir, "my-skill");
    fs.mkdirSync(skillDir);
    fs.writeFileSync(
      path.join(skillDir, "SKILL.md"),
      "---\nname: My Custom Skill\ndescription: Does cool things\n---\n\nInstructions here."
    );

    const profiles = scanProjectProfiles(tmpDir);

    expect(profiles).toHaveLength(1);
    expect(profiles[0].id).toBe("my-skill");
    expect(profiles[0].name).toBe("My Custom Skill");
    expect(profiles[0].description).toBe("Does cool things");
    expect(profiles[0].domain).toBe("work");
    expect(profiles[0].tags).toEqual(["project-skill"]);
    expect(profiles[0].scope).toBe("project");
    expect(profiles[0].readOnly).toBe(true);
    expect(profiles[0].projectDir).toBe(tmpDir);
    expect(profiles[0].supportedRuntimes).toEqual(["claude-code"]);
  });

  it("discovers profile.yaml + SKILL.md full profiles", () => {
    const skillsDir = createSkillsDir(tmpDir);
    const skillDir = path.join(skillsDir, "full-profile");
    fs.mkdirSync(skillDir);

    fs.writeFileSync(
      path.join(skillDir, "profile.yaml"),
      `id: full-profile\nname: Full Profile\nversion: "1.0.0"\ndomain: work\ntags:\n  - custom\n`
    );
    fs.writeFileSync(
      path.join(skillDir, "SKILL.md"),
      "---\nname: Full Profile\ndescription: A full profile with YAML\n---\n\nFull instructions."
    );

    const profiles = scanProjectProfiles(tmpDir);

    expect(profiles).toHaveLength(1);
    expect(profiles[0].id).toBe("full-profile");
    expect(profiles[0].scope).toBe("project");
    expect(profiles[0].readOnly).toBe(true);
  });

  it("skips directories with neither profile.yaml nor SKILL.md", () => {
    const skillsDir = createSkillsDir(tmpDir);
    fs.mkdirSync(path.join(skillsDir, "empty-dir"));

    const profiles = scanProjectProfiles(tmpDir);
    expect(profiles).toEqual([]);
  });

  it("uses cache on repeated calls", () => {
    const skillsDir = createSkillsDir(tmpDir);
    const skillDir = path.join(skillsDir, "cached-skill");
    fs.mkdirSync(skillDir);
    fs.writeFileSync(
      path.join(skillDir, "SKILL.md"),
      "---\nname: Cached\ndescription: Test caching\n---\n"
    );

    const first = scanProjectProfiles(tmpDir);
    const second = scanProjectProfiles(tmpDir);

    // Same reference means cache was used
    expect(first).toBe(second);
  });
});

describe("getProjectProfile", () => {
  it("returns a specific profile by ID", () => {
    const skillsDir = createSkillsDir(tmpDir);
    const skillDir = path.join(skillsDir, "specific");
    fs.mkdirSync(skillDir);
    fs.writeFileSync(
      path.join(skillDir, "SKILL.md"),
      "---\nname: Specific\ndescription: Find me\n---\n"
    );

    const profile = getProjectProfile(tmpDir, "specific");
    expect(profile).toBeDefined();
    expect(profile!.id).toBe("specific");
  });

  it("returns undefined for non-existent profile", () => {
    createSkillsDir(tmpDir);
    const profile = getProjectProfile(tmpDir, "nonexistent");
    expect(profile).toBeUndefined();
  });
});
