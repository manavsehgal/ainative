import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentRuntimeId } from "@/lib/agents/runtime/catalog";

const {
  mockGetRuntimeSetupStates,
  mockListConfiguredRuntimeIds,
  mockGetRoutingPreference,
  mockTestRuntimeConnection,
  mockGetProfile,
  mockProfileSupportsRuntime,
  mockSuggestRuntime,
} = vi.hoisted(() => ({
  mockGetRuntimeSetupStates: vi.fn(),
  mockListConfiguredRuntimeIds: vi.fn(),
  mockGetRoutingPreference: vi.fn(),
  mockTestRuntimeConnection: vi.fn(),
  mockGetProfile: vi.fn(),
  mockProfileSupportsRuntime: vi.fn(),
  mockSuggestRuntime: vi.fn(),
}));

vi.mock("@/lib/settings/runtime-setup", () => ({
  getRuntimeSetupStates: mockGetRuntimeSetupStates,
  listConfiguredRuntimeIds: mockListConfiguredRuntimeIds,
}));

vi.mock("@/lib/settings/routing", () => ({
  getRoutingPreference: mockGetRoutingPreference,
}));

vi.mock("@/lib/agents/runtime/index", () => ({
  testRuntimeConnection: mockTestRuntimeConnection,
}));

vi.mock("@/lib/agents/profiles/registry", () => ({
  getProfile: mockGetProfile,
}));

vi.mock("@/lib/agents/profiles/compatibility", () => ({
  profileSupportsRuntime: mockProfileSupportsRuntime,
}));

vi.mock("@/lib/agents/router", () => ({
  suggestRuntime: mockSuggestRuntime,
}));

import {
  RequestedModelUnavailableError,
  resolveChatExecutionTarget,
  resolveResumeExecutionTarget,
  resolveTaskExecutionTarget,
} from "../execution-target";

function makeStates(configured: AgentRuntimeId[]) {
  const all: AgentRuntimeId[] = [
    "claude-code",
    "openai-codex-app-server",
    "anthropic-direct",
    "openai-direct",
    "ollama",
  ];

  return Object.fromEntries(
    all.map((runtimeId) => [
      runtimeId,
      {
        runtimeId,
        configured: configured.includes(runtimeId),
      },
    ])
  );
}

describe("execution target resolver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRuntimeSetupStates.mockResolvedValue(
      makeStates(["claude-code", "openai-codex-app-server"])
    );
    mockListConfiguredRuntimeIds.mockReturnValue([
      "claude-code",
      "openai-codex-app-server",
    ]);
    mockGetRoutingPreference.mockResolvedValue("latency");
    mockProfileSupportsRuntime.mockReturnValue(true);
    mockSuggestRuntime.mockImplementation(
      (
        _title: string,
        _description: string | undefined,
        _profileId: string | undefined,
        availableRuntimeIds: AgentRuntimeId[]
      ) => ({
        runtimeId: availableRuntimeIds[0],
        reason: "test",
      })
    );
    mockTestRuntimeConnection.mockImplementation((runtimeId: AgentRuntimeId) => {
      if (runtimeId === "claude-code") {
        return Promise.resolve({
          connected: false,
          error: "Claude Code process exited with code 1",
        });
      }
      return Promise.resolve({ connected: true });
    });
  });

  it("falls back from an unavailable requested task runtime to a compatible alternate", async () => {
    mockGetProfile.mockReturnValue({
      id: "upgrade-assistant",
      allowedTools: ["Bash(git status)", "Read", "Write"],
    });

    const target = await resolveTaskExecutionTarget({
      title: "Upgrade local branch",
      description: "Merge upstream main safely",
      requestedRuntimeId: "claude-code",
      profileId: "upgrade-assistant",
    });

    expect(target.requestedRuntimeId).toBe("claude-code");
    expect(target.effectiveRuntimeId).toBe("openai-codex-app-server");
    expect(target.fallbackApplied).toBe(true);
    expect(target.fallbackReason).toContain("Fell back to OpenAI Codex App Server");
  });

  it("auto-selects a healthy runtime when no task runtime was requested", async () => {
    mockGetProfile.mockReturnValue({
      id: "general",
      allowedTools: [],
      preferredRuntime: "anthropic-direct",
    });
    mockSuggestRuntime.mockReturnValue({
      runtimeId: "openai-codex-app-server",
      reason: "test",
    });

    const target = await resolveTaskExecutionTarget({
      title: "Fix failing build",
      description: "Debug and patch the repo",
      profileId: "general",
    });

    expect(target.requestedRuntimeId).toBeNull();
    expect(target.effectiveRuntimeId).toBe("openai-codex-app-server");
    expect(target.fallbackApplied).toBe(false);
  });

  it("falls back chat turns to the mapped alternate model when the requested runtime is unavailable", async () => {
    const target = await resolveChatExecutionTarget({
      requestedRuntimeId: "claude-code",
      requestedModelId: "sonnet",
    });

    expect(target.requestedRuntimeId).toBe("claude-code");
    expect(target.effectiveRuntimeId).toBe("openai-codex-app-server");
    expect(target.effectiveModelId).toBe("gpt-5.3-codex");
    expect(target.fallbackApplied).toBe(true);
  });

  it("refuses resume when the last effective runtime is unavailable", async () => {
    await expect(
      resolveResumeExecutionTarget({
        requestedRuntimeId: "claude-code",
        effectiveRuntimeId: "claude-code",
      })
    ).rejects.toThrow("Claude Code process exited with code 1");
  });

  it("throws a named error when no chat runtime is healthy", async () => {
    mockTestRuntimeConnection.mockResolvedValue({
      connected: false,
      error: "all down",
    });

    await expect(
      resolveChatExecutionTarget({
        requestedRuntimeId: "claude-code",
        requestedModelId: "sonnet",
      })
    ).rejects.toBeInstanceOf(RequestedModelUnavailableError);
  });
});
