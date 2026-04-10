import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProvidersAndRuntimesSection } from "@/components/settings/providers-runtimes-section";

describe("providers and runtimes section", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("open", vi.fn());
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (url === "/api/settings/providers" && method === "GET") {
          return {
            ok: true,
            json: async () => ({
              providers: {
                anthropic: {
                  configured: false,
                  authMethod: "api_key",
                  hasKey: false,
                  apiKeySource: "unknown",
                  dualBilling: false,
                  runtimes: [
                    {
                      runtimeId: "claude-code",
                      label: "Claude Code",
                      providerId: "anthropic",
                      configured: false,
                      authMethod: "none",
                      apiKeySource: "unknown",
                      billingMode: "usage",
                    },
                    {
                      runtimeId: "anthropic-direct",
                      label: "Anthropic Direct API",
                      providerId: "anthropic",
                      configured: false,
                      authMethod: "none",
                      apiKeySource: "unknown",
                      billingMode: "usage",
                    },
                  ],
                },
                openai: {
                  configured: true,
                  authMethod: "oauth",
                  hasKey: true,
                  apiKeySource: "env",
                  oauthConnected: false,
                  account: null,
                  rateLimits: null,
                  login: {
                    phase: "idle",
                    loginId: null,
                    authUrl: null,
                    account: null,
                    rateLimits: null,
                    error: null,
                    startedAt: null,
                    updatedAt: new Date("2026-04-10T15:00:00.000Z").toISOString(),
                  },
                  dualBilling: false,
                  runtimes: [
                    {
                      runtimeId: "openai-codex-app-server",
                      label: "OpenAI Codex App Server",
                      providerId: "openai",
                      configured: false,
                      authMethod: "oauth",
                      apiKeySource: "oauth",
                      billingMode: "usage",
                    },
                    {
                      runtimeId: "openai-direct",
                      label: "OpenAI Direct API",
                      providerId: "openai",
                      configured: true,
                      authMethod: "api_key",
                      apiKeySource: "env",
                      billingMode: "usage",
                    },
                  ],
                },
              },
              routingPreference: "quality",
              configuredProviderCount: 1,
            }),
          };
        }

        if (url === "/api/settings/openai/login" && method === "POST") {
          return {
            ok: true,
            json: async () => ({
              phase: "pending",
              loginId: "login-1",
              authUrl: "https://auth.openai.com/log-in",
              account: null,
              rateLimits: null,
              error: null,
              startedAt: new Date("2026-04-10T15:01:00.000Z").toISOString(),
              updatedAt: new Date("2026-04-10T15:01:00.000Z").toISOString(),
            }),
          };
        }

        throw new Error(`Unexpected fetch: ${url}`);
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows partial OpenAI setup state when ChatGPT auth is selected but not connected", async () => {
    render(<ProvidersAndRuntimesSection />);

    await waitFor(() => {
      expect(screen.getByText("Direct API only")).toBeInTheDocument();
    });

    expect(
      screen.getByText("Codex App Server needs ChatGPT sign-in. OpenAI Direct API remains active.")
    ).toBeInTheDocument();
    expect(screen.getAllByText("Sign in with ChatGPT")).toHaveLength(2);
  });

  it("updates the provider row immediately when ChatGPT sign-in starts", async () => {
    render(<ProvidersAndRuntimesSection />);

    const signInButton = await screen.findByRole("button", {
      name: "Sign in with ChatGPT",
    });
    signInButton.click();

    await waitFor(() => {
      expect(
        screen.getByText("Waiting for ChatGPT sign-in. OpenAI Direct API remains active.")
      ).toBeInTheDocument();
    });

    expect(screen.getAllByText("Waiting for ChatGPT sign-in")).toHaveLength(2);
  });
});
