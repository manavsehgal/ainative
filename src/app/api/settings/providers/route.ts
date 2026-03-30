import { NextResponse } from "next/server";
import { getRuntimeSetupStates } from "@/lib/settings/runtime-setup";
import { getRoutingPreference } from "@/lib/settings/routing";
import { getAuthSettings } from "@/lib/settings/auth";
import { getOpenAIAuthSettings } from "@/lib/settings/openai-auth";

export async function GET() {
  const [runtimeStates, routingPreference, anthropicAuth, openaiAuth] =
    await Promise.all([
      getRuntimeSetupStates(),
      getRoutingPreference(),
      getAuthSettings(),
      getOpenAIAuthSettings(),
    ]);

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
        hasKey: openaiAuth.hasKey,
        apiKeySource: openaiAuth.apiKeySource,
        dualBilling: false,
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
