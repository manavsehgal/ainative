import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { listFusedProfiles } from "@/lib/agents/profiles/list-fused-profiles";

describe("listFusedProfiles", () => {
  let projectDir: string;
  let userSkillsDir: string;

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "stagent-skills-"));
    userSkillsDir = mkdtempSync(join(tmpdir(), "stagent-user-skills-"));
    mkdirSync(join(projectDir, ".claude", "skills"), { recursive: true });
  });

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
    rmSync(userSkillsDir, { recursive: true, force: true });
  });

  function writeSkill(baseDir: string, name: string, frontmatter: string) {
    mkdirSync(join(baseDir, name), { recursive: true });
    writeFileSync(
      join(baseDir, name, "SKILL.md"),
      `---\n${frontmatter}\n---\n\nbody for ${name}\n`
    );
  }

  it("returns registry profiles when no filesystem skills exist", async () => {
    const result = await listFusedProfiles(projectDir, userSkillsDir);
    // Should contain at least one registry profile (builtin)
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((p) => typeof p.id === "string")).toBe(true);
  });

  it("surfaces a project .claude/skills/<name> entry", async () => {
    writeSkill(
      join(projectDir, ".claude", "skills"),
      "my-project-skill",
      `name: my-project-skill\ndescription: Test project skill`
    );
    const result = await listFusedProfiles(projectDir, userSkillsDir);
    expect(result.some((p) => p.id === "my-project-skill")).toBe(true);
    const skill = result.find((p) => p.id === "my-project-skill")!;
    expect(skill.name).toBe("my-project-skill");
    expect(skill.description).toBe("Test project skill");
    expect(skill.origin).toBe("filesystem-project");
  });

  it("sets projectDir to the project root (not the skills subdirectory) on filesystem-project entries", async () => {
    writeSkill(
      join(projectDir, ".claude", "skills"),
      "my-scoped-skill",
      `name: my-scoped-skill\ndescription: Scoped`
    );
    const result = await listFusedProfiles(projectDir, userSkillsDir);
    const skill = result.find((p) => p.id === "my-scoped-skill")!;
    expect(skill.projectDir).toBe(projectDir);
    // Negative: must not be the .claude/skills subdirectory
    expect(skill.projectDir).not.toContain(".claude/skills");
  });

  it("surfaces a user ~/.claude/skills/<name> entry", async () => {
    writeSkill(
      userSkillsDir,
      "my-user-skill",
      `name: my-user-skill\ndescription: Test user skill`
    );
    const result = await listFusedProfiles(projectDir, userSkillsDir);
    expect(result.some((p) => p.id === "my-user-skill")).toBe(true);
    expect(
      result.find((p) => p.id === "my-user-skill")!.origin
    ).toBe("filesystem-user");
  });

  it("dedupes by id — registry profile wins over filesystem skill with same id", async () => {
    // "general" is a known builtin registry profile id; write a filesystem
    // skill with the same id to force a collision.
    writeSkill(
      join(projectDir, ".claude", "skills"),
      "general",
      `name: general\ndescription: This should be overridden by registry`
    );
    const result = await listFusedProfiles(projectDir, userSkillsDir);
    const entries = result.filter((p) => p.id === "general");
    expect(entries).toHaveLength(1);
    // Registry description should win (not the filesystem-overridden one)
    expect(entries[0].description).not.toBe("This should be overridden by registry");
  });

  it("logs and skips a malformed SKILL.md (no name field in frontmatter)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    writeSkill(
      join(projectDir, ".claude", "skills"),
      "broken-skill",
      `description: Missing name field — broken`
    );
    const result = await listFusedProfiles(projectDir, userSkillsDir);
    expect(result.some((p) => p.id === "broken-skill")).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("returns an empty-safe result when projectDir does not exist", async () => {
    const result = await listFusedProfiles("/nonexistent/path", userSkillsDir);
    // Should still return registry + user skills, no throw
    expect(Array.isArray(result)).toBe(true);
  });
});
