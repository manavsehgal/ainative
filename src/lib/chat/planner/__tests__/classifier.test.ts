import { describe, it, expect } from "vitest";
import { classifyMessage } from "../classifier";
import type { PlannerContext } from "../types";

const ctx: PlannerContext = { projectId: null, history: [] };

describe("classifyMessage — compose path", () => {
  it("classifies 'build me a weekly portfolio check-in' as compose", () => {
    const v = classifyMessage("build me a weekly portfolio check-in", ctx);
    expect(v.kind).toBe("compose");
    if (v.kind !== "compose") return;
    expect(v.plan.profileId).toBe("wealth-manager");
    expect(v.plan.blueprintId).toBe("investment-research");
  });

  it("classifies 'create an app for reading list tracking' as compose → researcher", () => {
    const v = classifyMessage("create an app for reading list tracking", ctx);
    expect(v.kind).toBe("compose");
    if (v.kind !== "compose") return;
    expect(v.plan.profileId).toBe("researcher");
  });

  it("is case-insensitive", () => {
    const v = classifyMessage("BUILD ME a portfolio app", ctx);
    expect(v.kind).toBe("compose");
  });

  it("falls through to conversation when trigger matches but no keyword", () => {
    const v = classifyMessage("build me a list of books", ctx);
    expect(v.kind).toBe("conversation");
  });
});

describe("classifyMessage — scaffold path", () => {
  it("classifies 'I need a tool that pulls my GitHub issues' as scaffold", () => {
    const v = classifyMessage(
      "I need a tool that pulls my GitHub issues",
      ctx
    );
    expect(v.kind).toBe("scaffold");
    if (v.kind !== "scaffold") return;
    expect(v.plan.plugin.id).toMatch(/github/);
    expect(v.plan.plugin.language).toBe("python");
    expect(v.plan.plugin.transport).toBe("stdio");
    expect(v.plan.plugin.tools.length).toBeGreaterThan(0);
  });

  it("classifies 'integrate with Jira' as scaffold → jira-mine", () => {
    const v = classifyMessage("integrate with Jira for ticket tracking", ctx);
    expect(v.kind).toBe("scaffold");
    if (v.kind !== "scaffold") return;
    expect(v.plan.plugin.id).toMatch(/jira/);
  });

  it("falls through to conversation when scaffold trigger matches but no noun found", () => {
    const v = classifyMessage("connect to the idea", ctx);
    expect(v.kind).toBe("conversation");
  });

  it("scaffold-first: ambiguous message prefers scaffold when plugin noun found", () => {
    const v = classifyMessage(
      "build me a tool that pulls my github issues",
      ctx
    );
    expect(v.kind).toBe("scaffold");
  });
});

describe("classifyMessage — conversation path", () => {
  it("classifies 'what did we discuss yesterday' as conversation", () => {
    const v = classifyMessage("what did we discuss yesterday?", ctx);
    expect(v.kind).toBe("conversation");
  });

  it("classifies empty string as conversation", () => {
    expect(classifyMessage("", ctx).kind).toBe("conversation");
    expect(classifyMessage("   ", ctx).kind).toBe("conversation");
  });

  it("classifies a greeting as conversation", () => {
    expect(classifyMessage("hi, how are you?", ctx).kind).toBe("conversation");
  });
});

describe("classifyMessage — totality", () => {
  it("never throws on arbitrary input", () => {
    const inputs = [
      "\0\0\0",
      "a".repeat(10000),
      "🤖🤖🤖",
      "'); DROP TABLE users; --",
      "```build me``` `portfolio`",
    ];
    for (const s of inputs) {
      expect(() => classifyMessage(s, ctx)).not.toThrow();
    }
  });
});
