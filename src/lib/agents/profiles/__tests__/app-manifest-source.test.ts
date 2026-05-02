import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import yaml from "js-yaml";
import { SUPPORTED_AGENT_RUNTIMES } from "@/lib/agents/runtime/catalog";
import { loadAppManifestProfiles } from "../app-manifest-source";

describe("loadAppManifestProfiles", () => {
  let tmpRoot: string;
  let appsDir: string;
  let profilesDir: string;
  let builtinsDir: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ams-test-"));
    appsDir = path.join(tmpRoot, "apps");
    profilesDir = path.join(tmpRoot, "profiles");
    builtinsDir = path.join(tmpRoot, "builtins");
    fs.mkdirSync(appsDir, { recursive: true });
    fs.mkdirSync(profilesDir, { recursive: true });
    fs.mkdirSync(builtinsDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  function writeManifest(appId: string, manifest: Record<string, unknown>): void {
    const appDir = path.join(appsDir, appId);
    fs.mkdirSync(appDir, { recursive: true });
    fs.writeFileSync(path.join(appDir, "manifest.yaml"), yaml.dump(manifest));
  }

  it("synthesizes profile from full inline manifest entry", () => {
    writeManifest("customer-follow-up-drafter", {
      id: "customer-follow-up-drafter",
      name: "Customer follow-up drafter",
      profiles: [
        { id: "cs-coach", name: "CS coach", description: "Helpful customer-success agent" },
      ],
      blueprints: [],
      tables: [],
      schedules: [],
    });

    const profiles = loadAppManifestProfiles(appsDir, profilesDir, builtinsDir);

    expect(profiles).toHaveLength(1);
    const csCoach = profiles[0];
    expect(csCoach.id).toBe("cs-coach");
    expect(csCoach.name).toBe("CS coach");
    expect(csCoach.description).toBe("Helpful customer-success agent");
    expect(csCoach.systemPrompt).toBe("Helpful customer-success agent");
    expect(csCoach.skillMd).toBe("");
    expect(csCoach.domain).toBe("work");
    expect(csCoach.tags).toEqual(["customer-follow-up-drafter"]);
    expect(csCoach.supportedRuntimes).toEqual(SUPPORTED_AGENT_RUNTIMES);
    expect(csCoach.scope).toBe("user");
    expect(csCoach.origin).toBe("import");
    expect(csCoach.readOnly).toBe(true);
  });

  it("titleCases id when name is missing", () => {
    writeManifest("habit-tracker", {
      id: "habit-tracker",
      name: "Habit tracker",
      profiles: [{ id: "habit-coach" }],
      blueprints: [],
      tables: [],
      schedules: [],
    });

    const profiles = loadAppManifestProfiles(appsDir, profilesDir, builtinsDir);
    expect(profiles[0].name).toBe("Habit Coach");
    expect(profiles[0].description).toBe("");
    expect(profiles[0].systemPrompt).toBe("");
  });

  it("does not synthesize when profile.yaml exists in profilesDir (shadowing)", () => {
    writeManifest("customer-follow-up-drafter", {
      id: "customer-follow-up-drafter",
      name: "Customer follow-up drafter",
      profiles: [{ id: "cs-coach", name: "CS coach", description: "Stub" }],
      blueprints: [], tables: [], schedules: [],
    });
    // User authored a real profile.yaml at profilesDir/cs-coach/profile.yaml
    fs.mkdirSync(path.join(profilesDir, "cs-coach"), { recursive: true });
    fs.writeFileSync(
      path.join(profilesDir, "cs-coach", "profile.yaml"),
      "id: cs-coach\nname: User-customized\n"
    );

    const profiles = loadAppManifestProfiles(appsDir, profilesDir, builtinsDir);
    expect(profiles).toHaveLength(0);
  });

  it("does not synthesize when builtin exists for the id", () => {
    writeManifest("some-app", {
      id: "some-app", name: "Some app",
      profiles: [{ id: "general", name: "General override" }],
      blueprints: [], tables: [], schedules: [],
    });
    fs.mkdirSync(path.join(builtinsDir, "general"), { recursive: true });
    fs.writeFileSync(
      path.join(builtinsDir, "general", "profile.yaml"),
      "id: general\nname: Builtin general\n"
    );

    const profiles = loadAppManifestProfiles(appsDir, profilesDir, builtinsDir);
    expect(profiles).toHaveLength(0);
  });

  it("returns empty array when apps directory does not exist", () => {
    const missingDir = path.join(tmpRoot, "does-not-exist");
    expect(loadAppManifestProfiles(missingDir, profilesDir, builtinsDir)).toEqual([]);
  });

  it("skips malformed manifest.yaml without crashing other apps", () => {
    // App A: malformed
    fs.mkdirSync(path.join(appsDir, "broken"), { recursive: true });
    fs.writeFileSync(path.join(appsDir, "broken", "manifest.yaml"), "::: not yaml :::");
    // App B: valid
    writeManifest("good-app", {
      id: "good-app", name: "Good app",
      profiles: [{ id: "good-profile", name: "Good", description: "Works" }],
      blueprints: [], tables: [], schedules: [],
    });

    const profiles = loadAppManifestProfiles(appsDir, profilesDir, builtinsDir);
    expect(profiles).toHaveLength(1);
    expect(profiles[0].id).toBe("good-profile");
  });

  it("first-wins on profile id collision and merges app ids into tags", () => {
    writeManifest("app-a", {
      id: "app-a", name: "App A",
      profiles: [{ id: "shared-coach", name: "Shared coach", description: "First" }],
      blueprints: [], tables: [], schedules: [],
    });
    writeManifest("app-b", {
      id: "app-b", name: "App B",
      profiles: [{ id: "shared-coach", name: "Different name", description: "Second" }],
      blueprints: [], tables: [], schedules: [],
    });

    const profiles = loadAppManifestProfiles(appsDir, profilesDir, builtinsDir);
    expect(profiles).toHaveLength(1);
    // First wins: name + description from app-a
    expect(profiles[0].name).toBe("Shared coach");
    expect(profiles[0].description).toBe("First");
    // Tags include both app ids (order depends on filesystem readdir)
    expect(profiles[0].tags.sort()).toEqual(["app-a", "app-b"]);
  });

  it("returns empty array when manifest has no profiles[]", () => {
    writeManifest("no-profiles-app", {
      id: "no-profiles-app", name: "No profiles",
      blueprints: [], tables: [], schedules: [],
    });
    const profiles = loadAppManifestProfiles(appsDir, profilesDir, builtinsDir);
    expect(profiles).toHaveLength(0);
  });
});
