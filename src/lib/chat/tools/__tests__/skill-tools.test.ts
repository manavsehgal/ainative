import { describe, it, expect, vi, beforeEach } from "vitest";

/** Mutable test state shared across module-level mocks. */
const { mockState } = vi.hoisted(() => ({
  mockState: {
    skills: [] as Array<{
      id: string;
      name: string;
      tool: string;
      scope: string;
      preview: string;
      sizeBytes: number;
      absPath: string;
      content: string;
    }>,
    conversations: new Map<string, {
      id: string;
      activeSkillId: string | null;
      activeSkillIds: string[];
      runtimeId: string;
    }>(),
    lastUpdateId: null as string | null,
    lastUpdateValues: null as Record<string, unknown> | null,
    lastSelectedId: null as string | null,
  },
}));

vi.mock("@/lib/environment/list-skills", () => ({
  listSkills: () => mockState.skills.map(({ content: _content, ...rest }) => rest),
  getSkill: (id: string) => {
    const hit = mockState.skills.find((s) => s.id === id);
    return hit ?? null;
  },
}));

vi.mock("@/lib/db", () => {
  const selectBuilder = {
    from() {
      return this;
    },
    where() {
      return this;
    },
    get() {
      const id = mockState.lastSelectedId;
      return Promise.resolve(
        id ? mockState.conversations.get(id) : undefined
      );
    },
  };
  // Hoisted fields for the select chain — updated from the eq() stub
  mockState.lastSelectedId = null;
  return {
    db: {
      select: () => selectBuilder,
      update: () => ({
        set: (values: Record<string, unknown>) => {
          mockState.lastUpdateValues = values;
          return {
            where: () => {
              // Apply the update to the tracked conversation so follow-up
              // reads see the new state.
              if (mockState.lastUpdateId) {
                const row = mockState.conversations.get(mockState.lastUpdateId);
                if (row) {
                  mockState.conversations.set(mockState.lastUpdateId, {
                    ...row,
                    activeSkillId:
                      "activeSkillId" in values
                        ? (values.activeSkillId as string | null)
                        : row.activeSkillId,
                    activeSkillIds:
                      "activeSkillIds" in values
                        ? (values.activeSkillIds as string[])
                        : row.activeSkillIds,
                  });
                }
              }
              return Promise.resolve();
            },
          };
        },
      }),
    },
  };
});

vi.mock("@/lib/db/schema", () => ({
  conversations: {
    id: "id",
    activeSkillId: "activeSkillId",
    activeSkillIds: "activeSkillIds",
    runtimeId: "runtimeId",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: (_col: unknown, val: unknown) => {
    // Side channel so the select/update chains know which row to touch.
    const id = typeof val === "string" ? val : null;
    mockState.lastSelectedId = id;
    mockState.lastUpdateId = id;
    return {};
  },
}));

vi.mock("@/lib/agents/runtime/catalog", () => ({
  getRuntimeFeatures: (runtimeId: string) => {
    if (runtimeId === "ollama") {
      return { supportsSkillComposition: false, maxActiveSkills: 1 };
    }
    if (
      runtimeId === "claude-code" ||
      runtimeId === "openai-codex-app-server" ||
      runtimeId === "anthropic-direct" ||
      runtimeId === "openai-direct"
    ) {
      return { supportsSkillComposition: true, maxActiveSkills: 3 };
    }
    throw new Error(`Unknown runtime: ${runtimeId}`);
  },
}));

import { skillTools } from "../skill-tools";

function getTool(name: string) {
  const tools = skillTools({ projectId: "proj-1" } as never);
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new Error(`Tool not found: ${name}`);
  return tool;
}

async function call(toolName: string, args: Record<string, unknown> = {}) {
  const tool = getTool(toolName);
  return tool.handler(args);
}

function parse(result: {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}) {
  return {
    data: JSON.parse(result.content[0].text) as Record<string, unknown>,
    isError: result.isError ?? false,
  };
}

beforeEach(() => {
  mockState.skills = [];
  mockState.conversations.clear();
  mockState.lastUpdateId = null;
  mockState.lastUpdateValues = null;
  mockState.lastSelectedId = null;
});

describe("skill-tools", () => {
  describe("list_skills", () => {
    it("returns all discoverable skills with id/name/tool/scope/preview/size, no absPath", async () => {
      mockState.skills = [
        {
          id: ".claude/skills/capture",
          name: "capture",
          tool: "claude-code",
          scope: "project",
          preview: "Capture web content as markdown.",
          sizeBytes: 2048,
          absPath: "/abs/.claude/skills/capture/SKILL.md",
          content: "# capture\n\nBody.",
        },
      ];
      const { data, isError } = parse(await call("list_skills"));
      expect(isError).toBe(false);
      expect(data.count).toBe(1);
      const skills = data.skills as Array<Record<string, unknown>>;
      expect(skills[0]).toMatchObject({
        id: ".claude/skills/capture",
        name: "capture",
        tool: "claude-code",
        scope: "project",
        sizeBytes: 2048,
      });
      expect("absPath" in skills[0]).toBe(false); // never surface to LLM
    });

    it("returns count=0 when no skills are discovered", async () => {
      const { data } = parse(await call("list_skills"));
      expect(data.count).toBe(0);
      expect(data.skills).toEqual([]);
    });
  });

  describe("get_skill", () => {
    it("returns full SKILL.md content for a known id", async () => {
      mockState.skills = [
        {
          id: ".agents/skills/codegen",
          name: "codegen",
          tool: "codex",
          scope: "user",
          preview: "Codegen helper.",
          sizeBytes: 1000,
          absPath: "/abs/.agents/skills/codegen/SKILL.md",
          content: "# codegen\n\nFull body here.",
        },
      ];
      const { data, isError } = parse(
        await call("get_skill", { id: ".agents/skills/codegen" })
      );
      expect(isError).toBe(false);
      expect(data.content).toContain("Full body here");
      expect(data.name).toBe("codegen");
    });

    it("returns an error when the id is not found", async () => {
      const { data, isError } = parse(
        await call("get_skill", { id: "nope" })
      );
      expect(isError).toBe(true);
      expect(data.error).toContain("Skill not found");
    });
  });

  describe("activate_skill", () => {
    it("binds a skill to a conversation and returns confirmation", async () => {
      mockState.skills = [
        {
          id: ".claude/skills/capture",
          name: "capture",
          tool: "claude-code",
          scope: "project",
          preview: "…",
          sizeBytes: 500,
          absPath: "/abs/path",
          content: "# capture",
        },
      ];
      mockState.conversations.set("conv-1", { id: "conv-1", activeSkillId: null, activeSkillIds: [], runtimeId: "claude-code" });

      const { data, isError } = parse(
        await call("activate_skill", {
          conversationId: "conv-1",
          skillId: ".claude/skills/capture",
        })
      );
      expect(isError).toBe(false);
      expect(data.activatedSkillId).toBe(".claude/skills/capture");
      expect(data.skillName).toBe("capture");
      expect(mockState.lastUpdateValues).toMatchObject({
        activeSkillId: ".claude/skills/capture",
      });
      expect(mockState.conversations.get("conv-1")?.activeSkillId).toBe(
        ".claude/skills/capture"
      );
    });

    it("errors on unknown conversation", async () => {
      mockState.skills = [
        {
          id: ".claude/skills/capture",
          name: "capture",
          tool: "claude-code",
          scope: "project",
          preview: "…",
          sizeBytes: 500,
          absPath: "/abs/path",
          content: "# capture",
        },
      ];
      const { data, isError } = parse(
        await call("activate_skill", {
          conversationId: "ghost",
          skillId: ".claude/skills/capture",
        })
      );
      expect(isError).toBe(true);
      expect(data.error).toContain("Conversation not found");
    });

    it("errors on unknown skill id (validates before writing)", async () => {
      mockState.conversations.set("conv-1", { id: "conv-1", activeSkillId: null, activeSkillIds: [], runtimeId: "claude-code" });
      const { data, isError } = parse(
        await call("activate_skill", {
          conversationId: "conv-1",
          skillId: "not-a-real-skill",
        })
      );
      expect(isError).toBe(true);
      expect(data.error).toContain("Skill not found");
      expect(mockState.lastUpdateValues).toBeNull(); // no write happened
    });

    it("replaces a previously active skill (single-active rule)", async () => {
      mockState.skills = [
        {
          id: "first",
          name: "first",
          tool: "claude-code",
          scope: "project",
          preview: "",
          sizeBytes: 100,
          absPath: "/a",
          content: "# first",
        },
        {
          id: "second",
          name: "second",
          tool: "claude-code",
          scope: "project",
          preview: "",
          sizeBytes: 100,
          absPath: "/b",
          content: "# second",
        },
      ];
      mockState.conversations.set("conv-1", {
        id: "conv-1",
        activeSkillId: "first",
        activeSkillIds: [],
        runtimeId: "claude-code",
      });

      await call("activate_skill", {
        conversationId: "conv-1",
        skillId: "second",
      });
      expect(mockState.conversations.get("conv-1")?.activeSkillId).toBe("second");
    });

    it("mode:add appends a second skill on a composition-capable runtime", async () => {
      mockState.skills = [
        { id: "first-skill", name: "first", tool: "x", scope: "project", preview: "", sizeBytes: 100, absPath: "/a", content: "# first\nUse foo." },
        { id: "second-skill", name: "second", tool: "x", scope: "project", preview: "", sizeBytes: 100, absPath: "/b", content: "# second\nUse bar." },
      ];
      mockState.conversations.set("conv-1", {
        id: "conv-1",
        activeSkillId: "first-skill",
        activeSkillIds: [],
        runtimeId: "claude-code",
      });
      const { data, isError } = parse(
        await call("activate_skill", {
          conversationId: "conv-1",
          skillId: "second-skill",
          mode: "add",
          force: true,
        })
      );
      expect(isError).toBe(false);
      expect(data.activeSkillIds).toEqual(["first-skill", "second-skill"]);
    });

    it("mode:add fails on Ollama with capability hint", async () => {
      mockState.skills = [
        { id: "any", name: "any", tool: "x", scope: "project", preview: "", sizeBytes: 100, absPath: "/a", content: "# any" },
      ];
      mockState.conversations.set("conv-1", {
        id: "conv-1",
        activeSkillId: null,
        activeSkillIds: [],
        runtimeId: "ollama",
      });
      const { data, isError } = parse(
        await call("activate_skill", {
          conversationId: "conv-1",
          skillId: "any",
          mode: "add",
        })
      );
      expect(isError).toBe(true);
      expect(data.error).toMatch(/composition/i);
    });

    it("mode:add enforces maxActiveSkills (Claude allows 3)", async () => {
      mockState.skills = [
        { id: "a", name: "a", tool: "x", scope: "project", preview: "", sizeBytes: 100, absPath: "/a", content: "" },
        { id: "b", name: "b", tool: "x", scope: "project", preview: "", sizeBytes: 100, absPath: "/b", content: "" },
        { id: "c", name: "c", tool: "x", scope: "project", preview: "", sizeBytes: 100, absPath: "/c", content: "" },
        { id: "d", name: "d", tool: "x", scope: "project", preview: "", sizeBytes: 100, absPath: "/d", content: "" },
      ];
      mockState.conversations.set("conv-1", {
        id: "conv-1",
        activeSkillId: "a",
        activeSkillIds: ["b", "c"],
        runtimeId: "claude-code",
      });
      const { data, isError } = parse(
        await call("activate_skill", {
          conversationId: "conv-1",
          skillId: "d",
          mode: "add",
          force: true,
        })
      );
      expect(isError).toBe(true);
      expect(data.error).toMatch(/max active skills/i);
    });

    it("mode:add returns conflicts without writing when conflicts detected (no force)", async () => {
      mockState.skills = [
        { id: "tdd", name: "tdd", tool: "x", scope: "project", preview: "", sizeBytes: 100, absPath: "/a", content: "Always write tests first." },
        { id: "spike", name: "spike", tool: "x", scope: "project", preview: "", sizeBytes: 100, absPath: "/b", content: "Never write tests during a spike." },
      ];
      mockState.conversations.set("conv-1", {
        id: "conv-1",
        activeSkillId: "tdd",
        activeSkillIds: [],
        runtimeId: "claude-code",
      });
      const { data, isError } = parse(
        await call("activate_skill", {
          conversationId: "conv-1",
          skillId: "spike",
          mode: "add",
        })
      );
      expect(isError).toBe(false);
      expect(data.requiresConfirmation).toBe(true);
      expect(Array.isArray(data.conflicts)).toBe(true);
      // Must NOT have written
      expect(mockState.conversations.get("conv-1")?.activeSkillIds).toEqual([]);
    });

    it("default mode:replace clears prior composed skills (back-compat)", async () => {
      mockState.skills = [
        { id: "new", name: "new", tool: "x", scope: "project", preview: "", sizeBytes: 100, absPath: "/n", content: "" },
      ];
      mockState.conversations.set("conv-1", {
        id: "conv-1",
        activeSkillId: "old",
        activeSkillIds: ["other"],
        runtimeId: "claude-code",
      });
      await call("activate_skill", { conversationId: "conv-1", skillId: "new" });
      expect(mockState.conversations.get("conv-1")?.activeSkillId).toBe("new");
      expect(mockState.conversations.get("conv-1")?.activeSkillIds).toEqual([]);
    });
  });

  describe("deactivate_skill", () => {
    it("clears the active skill and returns the previous id", async () => {
      mockState.conversations.set("conv-1", {
        id: "conv-1",
        activeSkillId: ".claude/skills/capture",
        activeSkillIds: [],
        runtimeId: "claude-code",
      });
      const { data, isError } = parse(
        await call("deactivate_skill", { conversationId: "conv-1" })
      );
      expect(isError).toBe(false);
      expect(data.previousSkillId).toBe(".claude/skills/capture");
      expect(data.activeSkillId).toBeNull();
      expect(mockState.conversations.get("conv-1")?.activeSkillId).toBeNull();
    });

    it("is idempotent when no skill was active", async () => {
      mockState.conversations.set("conv-1", { id: "conv-1", activeSkillId: null, activeSkillIds: [], runtimeId: "claude-code" });
      const { data, isError } = parse(
        await call("deactivate_skill", { conversationId: "conv-1" })
      );
      expect(isError).toBe(false);
      expect(data.previousSkillId).toBeNull();
      expect(data.activeSkillId).toBeNull();
    });

    it("errors on unknown conversation", async () => {
      const { data, isError } = parse(
        await call("deactivate_skill", { conversationId: "ghost" })
      );
      expect(isError).toBe(true);
      expect(data.error).toContain("Conversation not found");
    });
  });
});
