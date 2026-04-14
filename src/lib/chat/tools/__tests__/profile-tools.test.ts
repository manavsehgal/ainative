import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/agents/profiles/list-fused-profiles", () => ({
  listFusedProfiles: vi.fn(async (projectDir: string | null) =>
    [
      {
        id: "general",
        name: "General",
        description: "Reg",
        domain: "general",
        tags: [],
      },
      projectDir
        ? {
            id: "project-only",
            name: "Project Only",
            description: "Proj",
            domain: "skill",
            tags: [],
            origin: "filesystem-project",
          }
        : null,
    ].filter(Boolean)
  ),
}));

describe("list_profiles chat tool", () => {
  it("returns fused profiles when called with a projectDir", async () => {
    const { getListProfilesTool } = await import("@/lib/chat/tools/profile-tools");
    const tool = getListProfilesTool("/fake/project");
    const result = await tool.handler({});
    // ok() wraps data as MCP content — parse the JSON text back out
    const text = result.content[0].text;
    const list = JSON.parse(text) as { id: string }[];
    expect(Array.isArray(list)).toBe(true);
    expect(list.some((p) => p.id === "project-only")).toBe(true);
  });

  it("returns registry-only profiles when projectDir is null", async () => {
    const { getListProfilesTool } = await import("@/lib/chat/tools/profile-tools");
    const tool = getListProfilesTool(null);
    const result = await tool.handler({});
    const text = result.content[0].text;
    const list = JSON.parse(text) as { id: string }[];
    expect(list.every((p) => p.id !== "project-only")).toBe(true);
  });
});
