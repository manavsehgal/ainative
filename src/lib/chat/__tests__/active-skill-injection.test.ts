import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockState } = vi.hoisted(() => ({
  mockState: {
    activeSkillId: null as string | null,
    activeSkillIds: [] as string[],
    skills: {} as Record<string, { name: string; content: string }>,
    runtimeId: "ollama" as string, // default: Ollama (ainativeInjectsSkills: true)
  },
}));

// ── Mocks ──────────────────────────────────────────────────────────────

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from() {
        return this;
      },
      where() {
        return this;
      },
      get() {
        return Promise.resolve({
          activeSkillId: mockState.activeSkillId,
          activeSkillIds: mockState.activeSkillIds,
          runtimeId: mockState.runtimeId,
        });
      },
    }),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  conversations: {
    id: "id",
    activeSkillId: "activeSkillId",
    activeSkillIds: "activeSkillIds",
    runtimeId: "runtimeId",
  },
  projects: { id: "id" },
  tasks: { id: "id" },
  workflows: { id: "id" },
  documents: { id: "id" },
  schedules: { id: "id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: () => ({}),
  desc: () => ({}),
  and: () => ({}),
}));

vi.mock("@/lib/data/chat", () => ({
  getMessages: async () => [],
  // chat-conversation-branches v1: context-builder now walks ancestors via
  // this helper. Default to an empty linear conversation, matching the old
  // getMessages stub.
  getMessagesWithAncestors: async () => ({ messages: [], depthCapped: false }),
  MAX_BRANCH_DEPTH: 8,
}));

vi.mock("@/lib/agents/profiles/registry", () => ({
  getProfile: () => null,
}));

vi.mock("@/lib/environment/list-skills", () => ({
  getSkill: (id: string) => {
    const skill = mockState.skills[id];
    if (!skill) return null;
    return {
      id,
      name: skill.name,
      tool: "claude-code",
      scope: "project",
      preview: "",
      sizeBytes: Buffer.byteLength(skill.content),
      absPath: "/mock/path/SKILL.md",
      content: skill.content,
    };
  },
}));

import { buildChatContext } from "../context-builder";

beforeEach(() => {
  mockState.activeSkillId = null;
  mockState.activeSkillIds = [];
  mockState.skills = {};
  mockState.runtimeId = "ollama";
});

describe("active skill Tier 0 injection", () => {
  it("does NOT inject anything when activeSkillId is null (common case)", async () => {
    const ctx = await buildChatContext({ conversationId: "conv-1" });
    expect(ctx.systemPrompt).not.toContain("## Active Skill:");
  });

  it("injects the skill's SKILL.md content under an Active Skill header when bound", async () => {
    mockState.activeSkillId = ".claude/skills/capture";
    mockState.skills[".claude/skills/capture"] = {
      name: "capture",
      content: "# capture\n\nCapture web content as markdown.",
    };

    const ctx = await buildChatContext({ conversationId: "conv-1" });
    expect(ctx.systemPrompt).toContain("## Active Skill: capture");
    expect(ctx.systemPrompt).toContain("Capture web content as markdown");
  });

  it("silently emits no section when the bound skill id is not found (skill deleted)", async () => {
    mockState.activeSkillId = "dangling-id";
    const ctx = await buildChatContext({ conversationId: "conv-1" });
    expect(ctx.systemPrompt).not.toContain("## Active Skill:");
  });

  it("caps very large SKILL.md content to the token budget", async () => {
    mockState.activeSkillId = "huge-skill";
    mockState.skills["huge-skill"] = {
      name: "capture",
      content: "A".repeat(100_000), // ~25K tokens at 4 chars/token
    };
    const ctx = await buildChatContext({ conversationId: "conv-1" });
    // Budget is 4_000 tokens = ~16_000 chars; expect truncation marker
    expect(ctx.systemPrompt).toContain("...(truncated)");
    // Full 100K chars must NOT be inline
    expect(ctx.systemPrompt.length).toBeLessThan(50_000);
  });

  describe("runtime capability flag (ainativeInjectsSkills)", () => {
    it("does NOT inject on claude-code (native skill support — would duplicate)", async () => {
      mockState.runtimeId = "claude-code";
      mockState.activeSkillId = ".claude/skills/capture";
      mockState.skills[".claude/skills/capture"] = {
        name: "capture",
        content: "# capture\n\nBody.",
      };
      const ctx = await buildChatContext({ conversationId: "conv-1" });
      expect(ctx.systemPrompt).not.toContain("## Active Skill:");
      expect(ctx.systemPrompt).not.toContain("Body.");
    });

    it("does inject composed skills on claude-code when activeSkillIds are set", async () => {
      mockState.runtimeId = "claude-code";
      mockState.activeSkillId = ".claude/skills/researcher";
      mockState.activeSkillIds = [".claude/skills/technical-writer"];
      mockState.skills[".claude/skills/researcher"] = {
        name: "researcher",
        content: "Always gather sources first.",
      };
      mockState.skills[".claude/skills/technical-writer"] = {
        name: "technical-writer",
        content: "Prefer crisp, publishable prose.",
      };

      const ctx = await buildChatContext({ conversationId: "conv-1" });
      expect(ctx.systemPrompt).toContain("## Active Skill: researcher");
      expect(ctx.systemPrompt).toContain("## Active Skill: technical-writer");
    });

    it("does NOT inject on openai-codex-app-server (native skill support — would duplicate)", async () => {
      mockState.runtimeId = "openai-codex-app-server";
      mockState.activeSkillId = ".agents/skills/capture";
      mockState.skills[".agents/skills/capture"] = {
        name: "capture",
        content: "# capture\n\nBody.",
      };
      const ctx = await buildChatContext({ conversationId: "conv-1" });
      expect(ctx.systemPrompt).not.toContain("## Active Skill:");
    });

    it("DOES inject on ollama (no native support — ainative must inject)", async () => {
      mockState.runtimeId = "ollama";
      mockState.activeSkillId = ".claude/skills/capture";
      mockState.skills[".claude/skills/capture"] = {
        name: "capture",
        content: "# capture\n\nOllama needs this.",
      };
      const ctx = await buildChatContext({ conversationId: "conv-1" });
      expect(ctx.systemPrompt).toContain("## Active Skill: capture");
      expect(ctx.systemPrompt).toContain("Ollama needs this.");
    });

    it("falls through and injects when runtimeId is unknown (safer default than dropping)", async () => {
      mockState.runtimeId = "some-future-runtime-not-in-catalog";
      mockState.activeSkillId = ".claude/skills/capture";
      mockState.skills[".claude/skills/capture"] = {
        name: "capture",
        content: "# capture\n\nBody.",
      };
      const ctx = await buildChatContext({ conversationId: "conv-1" });
      // Unknown runtime → catalog throws → catch → fall through to injection.
      expect(ctx.systemPrompt).toContain("## Active Skill: capture");
    });
  });

  describe("composition budget trimming", () => {
    it("keeps multiple composed skills when the combined payload fits", async () => {
      mockState.runtimeId = "claude-code";
      mockState.activeSkillId = ".claude/skills/researcher";
      mockState.activeSkillIds = [".claude/skills/technical-writer"];
      mockState.skills[".claude/skills/researcher"] = {
        name: "researcher",
        content: "Collect sources.",
      };
      mockState.skills[".claude/skills/technical-writer"] = {
        name: "technical-writer",
        content: "Write clearly.",
      };

      const ctx = await buildChatContext({ conversationId: "conv-1" });
      expect(ctx.systemPrompt).toContain("## Active Skill: researcher");
      expect(ctx.systemPrompt).toContain("## Active Skill: technical-writer");
      expect(ctx.systemPrompt).not.toContain("## Active Skill Note");
    });

    it("omits oldest composed skills first when the combined payload exceeds budget", async () => {
      mockState.runtimeId = "claude-code";
      mockState.activeSkillId = ".claude/skills/oldest";
      mockState.activeSkillIds = [
        ".claude/skills/middle",
        ".claude/skills/newest",
      ];
      mockState.skills[".claude/skills/oldest"] = {
        name: "oldest",
        content: "O".repeat(8_000),
      };
      mockState.skills[".claude/skills/middle"] = {
        name: "middle",
        content: "M".repeat(8_000),
      };
      mockState.skills[".claude/skills/newest"] = {
        name: "newest",
        content: "N".repeat(2_000),
      };

      const ctx = await buildChatContext({ conversationId: "conv-1" });
      expect(ctx.systemPrompt).toContain("## Active Skill Note");
      expect(ctx.systemPrompt).toContain("Omitted 1 older active skill to fit the prompt budget: oldest.");
      expect(ctx.systemPrompt).not.toContain("## Active Skill: oldest");
      expect(ctx.systemPrompt).toContain("## Active Skill: middle");
      expect(ctx.systemPrompt).toContain("## Active Skill: newest");
    });

    it("truncates the newest remaining skill when even one section exceeds budget", async () => {
      mockState.runtimeId = "claude-code";
      mockState.activeSkillId = ".claude/skills/oldest";
      mockState.activeSkillIds = [".claude/skills/newest"];
      mockState.skills[".claude/skills/oldest"] = {
        name: "oldest",
        content: "O".repeat(8_000),
      };
      mockState.skills[".claude/skills/newest"] = {
        name: "newest",
        content: "N".repeat(40_000),
      };

      const ctx = await buildChatContext({ conversationId: "conv-1" });
      expect(ctx.systemPrompt).toContain("## Active Skill Note");
      expect(ctx.systemPrompt).toContain("oldest");
      expect(ctx.systemPrompt).toContain("## Active Skill: newest");
      expect(ctx.systemPrompt).toContain("...(truncated)");
      expect(ctx.systemPrompt).not.toContain("## Active Skill: oldest");
    });
  });
});
