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
});
