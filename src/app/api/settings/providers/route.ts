import { NextResponse } from "next/server";
import { readCodexAuthState } from "@/lib/agents/runtime/openai-codex-auth";
import { getRuntimeSetupStates } from "@/lib/settings/runtime-setup";
import { getRoutingPreference } from "@/lib/settings/routing";
import { getAuthSettings } from "@/lib/settings/auth";
import { getOpenAIAuthSettings } from "@/lib/settings/openai-auth";
import { getOpenAILoginState } from "@/lib/settings/openai-login-manager";

export async function GET() {
  const [routingPreference, anthropicAuth, initialOpenaiAuth] = await Promise.all([
    getRoutingPreference(),
    getAuthSettings(),
    getOpenAIAuthSettings(),
  ]);

  let openaiAuth = initialOpenaiAuth;
  if (openaiAuth.method === "oauth") {
    try {
      const current = await readCodexAuthState({ refreshToken: true });
      openaiAuth = {
        ...openaiAuth,
        oauthConnected: current.connected,
        account: current.account,
        rateLimits: current.rateLimits,
      };
    } catch {
      openaiAuth = {
        ...openaiAuth,
        oauthConnected: false,
        account: null,
        rateLimits: null,
      };
    }
  }

  const runtimeStates = await getRuntimeSetupStates();

  const anthropicConfigured =
    runtimeStates["claude-code"].configured ||
    runtimeStates["anthropic-direct"].configured;
  const openaiConfigured =
    runtimeStates["openai-codex-app-server"].configured ||
    runtimeStates["openai-direct"].configured;

  // Detect dual-billing: user has OAuth (subscription) for Claude Code
  // AND an API key (pay-as-you-go) for Anthropic Direct
  const anthropicHasOAuth =
    anthropicAuth.method === "oauth" || anthropicAuth.apiKeySource === "oauth";
  const anthropicHasApiKey = anthropicAuth.hasKey;
  const anthropicDualBilling = anthropicHasOAuth && anthropicHasApiKey;

  return NextResponse.json({
    providers: {
      anthropic: {
        configured: anthropicConfigured,
        authMethod: anthropicAuth.method,
        hasKey: anthropicAuth.hasKey,
        apiKeySource: anthropicAuth.apiKeySource,
        dualBilling: anthropicDualBilling,
        runtimes: [
          runtimeStates["claude-code"],
          runtimeStates["anthropic-direct"],
        ],
      },
      openai: {
        configured: openaiConfigured,
        authMethod: openaiAuth.method,
        hasKey: openaiAuth.hasKey,
        apiKeySource: openaiAuth.apiKeySource,
        oauthConnected: openaiAuth.oauthConnected,
        account: openaiAuth.account,
        rateLimits: openaiAuth.rateLimits,
        login: getOpenAILoginState(),
        dualBilling: openaiAuth.oauthConnected && openaiAuth.hasKey,
        runtimes: [
          runtimeStates["openai-codex-app-server"],
          runtimeStates["openai-direct"],
        ],
      },
    },
    routingPreference,
    configuredProviderCount: Number(anthropicConfigured) + Number(openaiConfigured),
  });
}
