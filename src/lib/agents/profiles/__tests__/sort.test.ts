import type { AgentProfile } from "../types";

import { sortProfilesByName } from "../sort";

function makeProfile(id: string, name: string): AgentProfile {
  return {
    id,
    name,
    description: `${name} description`,
    domain: "work",
    tags: [],
    systemPrompt: "",
    skillMd: "",
    allowedTools: [],
    mcpServers: {},
    canUseToolPolicy: false,
    maxTurns: 20,
    outputFormat: "text",
    version: "1.0.0",
    author: "test",
    source: "test",
    tests: [],
    supportedRuntimes: ["claude-code"],
    runtimeOverrides: {},
  };
}

describe("sortProfilesByName", () => {
  it("sorts profiles alphabetically so sweep remains discoverable", () => {
    const sorted = sortProfilesByName([
      makeProfile("sweep", "Sweep"),
      makeProfile("general", "General"),
      makeProfile("api-tester", "API Tester"),
    ]);

    expect(sorted.map((profile) => profile.id)).toEqual([
      "api-tester",
      "general",
      "sweep",
    ]);
  });
});
