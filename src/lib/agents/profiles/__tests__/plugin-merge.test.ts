import { describe, it, expect, afterEach } from "vitest";
import {
  mergePluginProfiles,
  clearPluginProfiles,
  clearAllPluginProfiles,
  getProfile,
  listProfiles,
} from "../registry";
import type { AgentProfile } from "../types";

function fakeProfile(id: string): AgentProfile {
  return {
    id,
    name: id,
    description: "test",
    domain: "personal",
    tags: [],
    systemPrompt: "",
    skillMd: "",
    allowedTools: [],
    mcpServers: {},
    canUseToolPolicy: "auto",
    maxTurns: 10,
    outputFormat: "text",
    version: "0.1.0",
    author: "test",
    source: "test",
    tests: [],
    importMeta: undefined,
    supportedRuntimes: ["claude"],
    preferredRuntime: "claude",
    runtimeOverrides: undefined,
    capabilityOverrides: undefined,
    origin: "manual",
  } as AgentProfile;
}

describe("plugin profile merge", () => {
  afterEach(() => {
    clearAllPluginProfiles();
  });

  it("registers profiles with namespaced ids", () => {
    mergePluginProfiles([
      { pluginId: "finance-pack", profile: fakeProfile("finance-pack/personal-cfo") },
    ]);
    expect(getProfile("finance-pack/personal-cfo")).toBeTruthy();
  });

  it("clearPluginProfiles removes only that plugin's profiles", () => {
    mergePluginProfiles([
      { pluginId: "finance-pack", profile: fakeProfile("finance-pack/personal-cfo") },
      { pluginId: "ops-pack", profile: fakeProfile("ops-pack/incident-lead") },
    ]);
    clearPluginProfiles("finance-pack");
    expect(getProfile("finance-pack/personal-cfo")).toBeUndefined();
    expect(getProfile("ops-pack/incident-lead")).toBeTruthy();
  });

  it("listProfiles surfaces plugin profiles alongside builtins", () => {
    const before = listProfiles().length;
    mergePluginProfiles([
      { pluginId: "test-pack", profile: fakeProfile("test-pack/x") },
    ]);
    expect(listProfiles().length).toBe(before + 1);
  });
});
