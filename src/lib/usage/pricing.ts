export interface PricingRule {
  providerId: "anthropic" | "openai";
  pricingVersion: string;
  inputCostPerMillionMicros: number;
  outputCostPerMillionMicros: number;
  matchesModel(modelId: string): boolean;
}

const PRICING_RULES: PricingRule[] = [
  // ── Anthropic ──────────────────────────────────────────────────────
  {
    providerId: "anthropic",
    pricingVersion: "registry-2026-03-15",
    inputCostPerMillionMicros: 15_000_000,
    outputCostPerMillionMicros: 75_000_000,
    matchesModel(modelId) {
      return modelId.startsWith("claude-opus");
    },
  },
  {
    providerId: "anthropic",
    pricingVersion: "registry-2026-03-15",
    inputCostPerMillionMicros: 3_000_000,
    outputCostPerMillionMicros: 15_000_000,
    matchesModel(modelId) {
      return modelId.startsWith("claude-sonnet");
    },
  },
  {
    providerId: "anthropic",
    pricingVersion: "registry-2026-03-15",
    inputCostPerMillionMicros: 800_000,
    outputCostPerMillionMicros: 4_000_000,
    matchesModel(modelId) {
      return modelId.startsWith("claude-haiku");
    },
  },
  // ── OpenAI ─────────────────────────────────────────────────────────
  {
    providerId: "openai",
    pricingVersion: "registry-2026-03-15",
    inputCostPerMillionMicros: 1_500_000,
    outputCostPerMillionMicros: 6_000_000,
    matchesModel(modelId) {
      return modelId.startsWith("codex-mini") || modelId === "codex-mini-latest";
    },
  },
  {
    providerId: "openai",
    pricingVersion: "registry-2026-03-15",
    inputCostPerMillionMicros: 2_500_000,
    outputCostPerMillionMicros: 10_000_000,
    matchesModel(modelId) {
      return modelId.startsWith("gpt-4o");
    },
  },
  {
    providerId: "openai",
    pricingVersion: "registry-2026-03-15",
    inputCostPerMillionMicros: 10_000_000,
    outputCostPerMillionMicros: 30_000_000,
    matchesModel(modelId) {
      return modelId.startsWith("gpt-5") || modelId.startsWith("o3") || modelId.startsWith("o4");
    },
  },
  // ── Catch-all (conservative estimate to prevent null costs) ────────
  {
    providerId: "anthropic",
    pricingVersion: "registry-2026-03-15-fallback",
    inputCostPerMillionMicros: 15_000_000,
    outputCostPerMillionMicros: 75_000_000,
    matchesModel() {
      return true;
    },
  },
  {
    providerId: "openai",
    pricingVersion: "registry-2026-03-15-fallback",
    inputCostPerMillionMicros: 10_000_000,
    outputCostPerMillionMicros: 30_000_000,
    matchesModel() {
      return true;
    },
  },
];

export interface DerivedCost {
  costMicros: number | null;
  pricingVersion: string | null;
}

export function deriveUsageCostMicros(input: {
  providerId: string;
  modelId?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
}): DerivedCost {
  if (!input.modelId) {
    return { costMicros: null, pricingVersion: null };
  }

  const rule = PRICING_RULES.find(
    (entry) =>
      entry.providerId === input.providerId && entry.matchesModel(input.modelId!)
  );

  if (!rule) {
    return { costMicros: null, pricingVersion: null };
  }

  const inputTokens = input.inputTokens ?? 0;
  const outputTokens = input.outputTokens ?? 0;
  const inputCost =
    (inputTokens * rule.inputCostPerMillionMicros) / 1_000_000;
  const outputCost =
    (outputTokens * rule.outputCostPerMillionMicros) / 1_000_000;

  return {
    costMicros: Math.round(inputCost + outputCost),
    pricingVersion: rule.pricingVersion,
  };
}
