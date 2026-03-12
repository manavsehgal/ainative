export interface PricingRule {
  providerId: "anthropic" | "openai";
  pricingVersion: string;
  inputCostPerMillionMicros: number;
  outputCostPerMillionMicros: number;
  matchesModel(modelId: string): boolean;
}

const PRICING_RULES: PricingRule[] = [
  {
    providerId: "anthropic",
    pricingVersion: "registry-2026-03-12",
    inputCostPerMillionMicros: 3_000_000,
    outputCostPerMillionMicros: 15_000_000,
    matchesModel(modelId) {
      return (
        modelId === "claude-sonnet-4-20250514" ||
        modelId.startsWith("claude-sonnet-4")
      );
    },
  },
  {
    providerId: "openai",
    pricingVersion: "registry-2026-03-12",
    inputCostPerMillionMicros: 1_500_000,
    outputCostPerMillionMicros: 6_000_000,
    matchesModel(modelId) {
      return modelId === "codex-mini-latest" || modelId.startsWith("codex-mini");
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
