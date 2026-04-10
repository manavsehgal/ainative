import { describe, expect, it, vi } from "vitest";

vi.mock("../auth", () => ({
  getAuthSettings: vi.fn(async () => ({
    method: "oauth",
    hasKey: false,
    apiKeySource: "oauth",
  })),
}));

vi.mock("../openai-auth", () => ({
  getOpenAIAuthSettings: vi.fn(async () => ({
    method: "oauth",
    hasKey: true,
    apiKeySource: "db",
    oauthConnected: true,
    account: { type: "chatgpt", email: "dev@example.com", planType: "pro" },
    rateLimits: null,
  })),
}));

describe("runtime setup states", () => {
  it("marks Codex App Server subscription-backed when ChatGPT auth is connected", async () => {
    const { getRuntimeSetupStates } = await import("../runtime-setup");
    const states = await getRuntimeSetupStates();

    expect(states["openai-codex-app-server"].configured).toBe(true);
    expect(states["openai-codex-app-server"].authMethod).toBe("oauth");
    expect(states["openai-codex-app-server"].billingMode).toBe("subscription");
    expect(states["openai-direct"].configured).toBe(true);
    expect(states["openai-direct"].billingMode).toBe("usage");
  });
});
