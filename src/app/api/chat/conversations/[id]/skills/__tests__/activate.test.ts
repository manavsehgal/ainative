import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocked service module — controls return values for each test.
// ---------------------------------------------------------------------------
const mockActivateSkill = vi.fn();

vi.mock("@/lib/chat/skill-composition", () => ({
  activateSkill: (...args: unknown[]) => mockActivateSkill(...args),
}));

// Import the route handler AFTER the mock is set up.
import { POST } from "../activate/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeRequest(body: unknown, conversationId = "conv-1"): [NextRequest, { params: Promise<{ id: string }> }] {
  const req = new NextRequest("http://localhost/api/chat/conversations/conv-1/skills/activate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return [req, { params: Promise.resolve({ id: conversationId }) }];
}

beforeEach(() => {
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("POST /api/chat/conversations/[id]/skills/activate", () => {
  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest("http://localhost/...", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req, { params: Promise.resolve({ id: "conv-1" }) });
    expect(res.status).toBe(400);
    const json = await res.json() as Record<string, unknown>;
    expect(typeof json.error).toBe("string");
  });

  it("returns 400 when skillId is missing", async () => {
    const [req, ctx] = makeRequest({ mode: "replace" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
  });

  it("returns 200 with activation payload on success (replace mode)", async () => {
    mockActivateSkill.mockResolvedValueOnce({
      kind: "ok",
      activatedSkillId: "my-skill",
      activeSkillIds: ["my-skill"],
      skillName: "My Skill",
    });
    const [req, ctx] = makeRequest({ skillId: "my-skill" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json.activatedSkillId).toBe("my-skill");
    expect(json.activeSkillIds).toEqual(["my-skill"]);
    expect(json.skillName).toBe("My Skill");
    expect(mockActivateSkill).toHaveBeenCalledWith({
      conversationId: "conv-1",
      skillId: "my-skill",
      mode: "replace",
      force: false,
    });
  });

  it("returns 200 with requiresConfirmation when conflicts detected", async () => {
    mockActivateSkill.mockResolvedValueOnce({
      kind: "conflicts",
      activeSkillIds: ["first"],
      conflicts: [
        { skillA: "first", skillB: "second", sharedTopic: "tests", excerptA: "Always …", excerptB: "Never …" },
      ],
      hint: "Re-call with force=true to add anyway",
    });
    const [req, ctx] = makeRequest({ skillId: "second", mode: "add" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json.requiresConfirmation).toBe(true);
    expect(Array.isArray(json.conflicts)).toBe(true);
    expect((json.conflicts as unknown[]).length).toBe(1);
  });

  it("returns 404 when conversation is not found", async () => {
    mockActivateSkill.mockResolvedValueOnce({
      kind: "error",
      message: "Conversation not found: ghost",
    });
    const [req, ctx] = makeRequest({ skillId: "any-skill" }, "ghost");
    const res = await POST(req, ctx);
    expect(res.status).toBe(404);
    const json = await res.json() as Record<string, unknown>;
    expect((json.error as string)).toContain("Conversation not found");
  });

  it("returns 404 when skill is not found", async () => {
    mockActivateSkill.mockResolvedValueOnce({
      kind: "error",
      message: "Skill not found: no-such-skill",
    });
    const [req, ctx] = makeRequest({ skillId: "no-such-skill" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns 400 for other logic errors (e.g. max skills reached)", async () => {
    mockActivateSkill.mockResolvedValueOnce({
      kind: "error",
      message: "Max active skills (3) reached on 'claude-code' — deactivate one first",
    });
    const [req, ctx] = makeRequest({ skillId: "any", mode: "add", force: true });
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
    const json = await res.json() as Record<string, unknown>;
    expect((json.error as string)).toMatch(/max active skills/i);
  });

  it("passes force=true to the service", async () => {
    mockActivateSkill.mockResolvedValueOnce({
      kind: "ok",
      activatedSkillId: "any",
      activeSkillIds: ["first", "any"],
      skillName: "Any",
    });
    const [req, ctx] = makeRequest({ skillId: "any", mode: "add", force: true });
    await POST(req, ctx);
    expect(mockActivateSkill).toHaveBeenCalledWith(
      expect.objectContaining({ force: true, mode: "add" })
    );
  });
});
