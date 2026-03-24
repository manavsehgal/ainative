import { query } from "@anthropic-ai/claude-agent-sdk";
import { getAuthEnv } from "@/lib/settings/auth";
import { buildClaudeSdkEnv } from "@/lib/agents/runtime/claude-sdk";
import { CHAT_MODELS, type ChatModelOption } from "./types";
import { getLaunchCwd } from "@/lib/environment/workspace-context";

// ── Cache ──────────────────────────────────────────────────────────────

let cachedModels: ChatModelOption[] | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ── Claude SDK model discovery ─────────────────────────────────────────

async function discoverClaudeModels(): Promise<ChatModelOption[]> {
  try {
    const authEnv = await getAuthEnv();
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 10_000);

    const session = query({
      prompt: "",
      options: {
        abortController,
        cwd: getLaunchCwd(),
        env: buildClaudeSdkEnv(authEnv),
        allowedTools: [],
        maxTurns: 1,
      },
    });

    const models = await session.supportedModels();
    abortController.abort(); // Clean up session
    clearTimeout(timeout);

    return models
      .filter((m) => m.value !== "default") // exclude meta-option
      .map((m) => ({
        id: m.value,
        label: m.displayName,
        provider: "anthropic" as const,
        tier: inferTier(m.value),
        costLabel: inferCost(m.value),
      }));
  } catch {
    return CHAT_MODELS;
  }
}

// ── Tier/cost inference from model ID ──────────────────────────────────

function inferTier(modelId: string): string {
  if (/haiku|spark|mini/i.test(modelId)) return "Fast";
  if (/opus|5\.4/i.test(modelId)) return "Best";
  return "Balanced";
}

function inferCost(modelId: string): string {
  if (/haiku|spark|mini/i.test(modelId)) return "$";
  if (/opus|5\.4/i.test(modelId)) return "$$$";
  return "$$";
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Discover available chat models from configured SDKs.
 * Queries Claude SDK for supported models and merges with
 * known OpenAI models. Caches results for 5 minutes.
 * Falls back to hardcoded CHAT_MODELS if discovery fails.
 */
export async function discoverModels(): Promise<ChatModelOption[]> {
  // Return cached if fresh
  if (cachedModels && Date.now() < cacheExpiry) {
    return cachedModels;
  }

  try {
    const claudeModels = await discoverClaudeModels();

    // Merge discovered models with hardcoded Anthropic models so that
    // models like Opus always appear even if the SDK doesn't enumerate them
    const hardcodedAnthropic = CHAT_MODELS.filter((m) => m.provider === "anthropic");
    const discoveredIds = new Set(claudeModels.map((m) => m.id));
    const mergedClaude = [
      ...claudeModels,
      ...hardcodedAnthropic.filter((m) => !discoveredIds.has(m.id)),
    ];

    // OpenAI models: use hardcoded list (Codex model/list requires
    // spawning app-server, too heavy for discovery)
    const openaiModels = CHAT_MODELS.filter((m) => m.provider === "openai");
    const models = [...mergedClaude, ...openaiModels];

    // Only cache if we got real results
    if (models.length > 0) {
      cachedModels = models;
      cacheExpiry = Date.now() + CACHE_TTL_MS;
    }

    return models;
  } catch {
    return CHAT_MODELS;
  }
}
