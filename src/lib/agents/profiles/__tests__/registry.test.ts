import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

// We test the registry by mocking fs to avoid touching the real filesystem.
// The module under test uses import.meta.dirname so we mock that via the
// builtins directory path.

const MOCK_SKILLS_DIR = path.join(
  process.env.HOME ?? ".",
  ".claude",
  "skills"
);

describe("profile registry", () => {
  // We need to dynamically import registry after mocking
  let getProfile: typeof import("../registry").getProfile;
  let listProfiles: typeof import("../registry").listProfiles;
  let getProfileTags: typeof import("../registry").getProfileTags;
  let reloadProfiles: typeof import("../registry").reloadProfiles;

  beforeEach(async () => {
    // Reset module cache so each test gets a fresh registry
    vi.resetModules();
    const mod = await import("../registry");
    getProfile = mod.getProfile;
    listProfiles = mod.listProfiles;
    getProfileTags = mod.getProfileTags;
    reloadProfiles = mod.reloadProfiles;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads builtin profiles from .claude/skills/", () => {
    // The registry should find profiles copied by ensureBuiltins
    const profiles = listProfiles();
    expect(profiles.length).toBeGreaterThanOrEqual(1);

    // Verify the general profile exists (it's always a builtin)
    const general = getProfile("general");
    expect(general).toBeDefined();
    expect(general!.name).toBe("General");
    expect(general!.domain).toBe("work");
  });

  it("returns all 13 builtin profiles", () => {
    const profiles = listProfiles();
    const ids = profiles.map((p) => p.id);

    expect(ids).toContain("general");
    expect(ids).toContain("code-reviewer");
    expect(ids).toContain("researcher");
    expect(ids).toContain("document-writer");
    expect(ids).toContain("project-manager");
    expect(ids).toContain("data-analyst");
    expect(ids).toContain("wealth-manager");
    expect(ids).toContain("travel-planner");
    expect(ids).toContain("technical-writer");
    expect(ids).toContain("devops-engineer");
    expect(ids).toContain("health-fitness-coach");
    expect(ids).toContain("shopping-assistant");
    expect(ids).toContain("learning-coach");
    expect(profiles.length).toBe(13);
  });

  it("getProfile returns undefined for unknown id", () => {
    expect(getProfile("nonexistent")).toBeUndefined();
  });

  it("profiles have skillMd content from SKILL.md", () => {
    const codeReviewer = getProfile("code-reviewer");
    expect(codeReviewer).toBeDefined();
    expect(codeReviewer!.skillMd).toContain("code reviewer");
    expect(codeReviewer!.skillMd.length).toBeGreaterThan(50);
  });

  it("profiles have canUseToolPolicy from profile.yaml", () => {
    const codeReviewer = getProfile("code-reviewer");
    expect(codeReviewer?.canUseToolPolicy).toBeDefined();
    expect(codeReviewer!.canUseToolPolicy!.autoApprove).toContain("Read");
    expect(codeReviewer!.canUseToolPolicy!.autoApprove).toContain("Grep");
  });

  it("getProfileTags returns tag map", () => {
    const tagMap = getProfileTags();
    expect(tagMap.get("researcher")).toContain("research");
    expect(tagMap.get("wealth-manager")).toContain("finance");
  });

  it("systemPrompt is set to skillMd for backward compat", () => {
    const general = getProfile("general");
    expect(general).toBeDefined();
    expect(general!.systemPrompt).toBe(general!.skillMd);
  });

  it("reloadProfiles clears cache and re-scans", () => {
    const before = listProfiles().length;
    reloadProfiles();
    const after = listProfiles().length;
    // After reload, should still find the same profiles
    expect(after).toBe(before);
  });

  it("profiles extract description from SKILL.md frontmatter", () => {
    const researcher = getProfile("researcher");
    expect(researcher).toBeDefined();
    expect(researcher!.description).toContain("research");
  });

  it("profiles have correct domain values", () => {
    const workProfiles = listProfiles().filter((p) => p.domain === "work");
    const personalProfiles = listProfiles().filter(
      (p) => p.domain === "personal"
    );

    expect(workProfiles.length).toBe(8); // general, code-reviewer, researcher, document-writer, project-manager, data-analyst, technical-writer, devops-engineer
    expect(personalProfiles.length).toBe(5); // wealth-manager, travel-planner, health-fitness-coach, shopping-assistant, learning-coach
  });
});
