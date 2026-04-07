import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
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
  let isBuiltin: typeof import("../registry").isBuiltin;

  beforeEach(async () => {
    // Reset module cache so each test gets a fresh registry
    vi.resetModules();
    const mod = await import("../registry");
    getProfile = mod.getProfile;
    listProfiles = mod.listProfiles;
    getProfileTags = mod.getProfileTags;
    reloadProfiles = mod.reloadProfiles;
    isBuiltin = mod.isBuiltin;
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

  it("returns all 21 builtin profiles", () => {
    const profiles = listProfiles().filter((p) => isBuiltin(p.id));
    const ids = profiles.map((p) => p.id);

    // Original 14
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
    expect(ids).toContain("sweep");
    // 6 business function profiles
    expect(ids).toContain("marketing-strategist");
    expect(ids).toContain("sales-researcher");
    expect(ids).toContain("customer-support-agent");
    expect(ids).toContain("financial-analyst");
    expect(ids).toContain("content-creator");
    expect(ids).toContain("operations-coordinator");
    // Clone lifecycle profile
    expect(ids).toContain("upgrade-assistant");
    expect(profiles.length).toBe(21);
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
    const builtinProfiles = listProfiles().filter((p) => isBuiltin(p.id));
    const workProfiles = builtinProfiles.filter((p) => p.domain === "work");
    const personalProfiles = builtinProfiles.filter(
      (p) => p.domain === "personal"
    );

    expect(workProfiles.length).toBe(16); // general, code-reviewer, researcher, document-writer, project-manager, data-analyst, technical-writer, devops-engineer, sweep + 6 business profiles + upgrade-assistant
    expect(personalProfiles.length).toBe(5); // wealth-manager, travel-planner, health-fitness-coach, shopping-assistant, learning-coach
  });

  it("detects a newly added on-disk profile after the cache is warm", async () => {
    const originalHome = process.env.HOME;
    const tempHome = fs.mkdtempSync(
      path.join(os.tmpdir(), "registry-cache-regression-")
    );

    try {
      process.env.HOME = tempHome;
      vi.resetModules();

      const registry = await import("../registry");
      const warmProfiles = registry.listProfiles();
      const initialCount = warmProfiles.length;
      const profileId = `registry-cache-regression-${Date.now()}`;
      const profileDir = path.join(tempHome, ".claude", "skills", profileId);

      fs.mkdirSync(profileDir, { recursive: true });
      fs.writeFileSync(
        path.join(profileDir, "profile.yaml"),
        yaml.dump({
          id: profileId,
          name: "Registry Cache Regression",
          version: "1.0.0",
          domain: "work",
          tags: ["regression", "cache"],
        })
      );
      fs.writeFileSync(
        path.join(profileDir, "SKILL.md"),
        `---
name: ${profileId}
description: Profile added after the registry cache is warm.
---

This profile exists to verify automatic cache refresh for on-disk changes.
`
      );

      const loaded = registry.getProfile(profileId);

      expect(loaded).toBeDefined();
      expect(loaded?.name).toBe("Registry Cache Regression");
      expect(registry.listProfiles().length).toBe(initialCount + 1);
    } finally {
      process.env.HOME = originalHome;
      fs.rmSync(tempHome, { recursive: true, force: true });
      vi.resetModules();
    }
  });
});
