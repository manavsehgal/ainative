import { createHash } from "node:crypto";
import { SETTINGS_KEYS } from "@/lib/constants/settings";
import { getSetting, setSetting } from "@/lib/settings/helpers";
import type { ClaudeOAuthPlan } from "@/lib/validators/settings";

export type PricingProviderId = "anthropic" | "openai";
export type PricingRowKind = "api_model" | "subscription_plan";
export type PricingSourceType = "bundled_default" | "official_pricing_page";

export interface PricingRow {
  key: string;
  providerId: PricingProviderId;
  kind: PricingRowKind;
  label: string;
  visible: boolean;
  matchPrefixes: string[];
  inputCostPerMillionMicros: number | null;
  outputCostPerMillionMicros: number | null;
  monthlyPriceUsd: number | null;
}

export interface ProviderPricingSnapshot {
  providerId: PricingProviderId;
  sourceType: PricingSourceType;
  sourceLabel: string;
  fetchedAtIso: string | null;
  version: string;
  refreshError: string | null;
  rows: PricingRow[];
}

export interface PricingRegistry {
  providers: Record<PricingProviderId, ProviderPricingSnapshot>;
}

export interface PricingRegistrySnapshot extends PricingRegistry {
  lastUpdatedIso: string | null;
  stale: boolean;
}

const STALE_AFTER_MS = 1000 * 60 * 60 * 24 * 7;

const DEFAULT_ROWS: PricingRow[] = [
  {
    key: "anthropic-claude-opus",
    providerId: "anthropic",
    kind: "api_model",
    label: "Claude Opus",
    visible: true,
    matchPrefixes: ["claude-opus"],
    inputCostPerMillionMicros: 5_000_000,
    outputCostPerMillionMicros: 25_000_000,
    monthlyPriceUsd: null,
  },
  {
    key: "anthropic-claude-sonnet",
    providerId: "anthropic",
    kind: "api_model",
    label: "Claude Sonnet",
    visible: true,
    matchPrefixes: ["claude-sonnet"],
    inputCostPerMillionMicros: 3_000_000,
    outputCostPerMillionMicros: 15_000_000,
    monthlyPriceUsd: null,
  },
  {
    key: "anthropic-claude-haiku",
    providerId: "anthropic",
    kind: "api_model",
    label: "Claude Haiku",
    visible: true,
    matchPrefixes: ["claude-haiku"],
    inputCostPerMillionMicros: 1_000_000,
    outputCostPerMillionMicros: 5_000_000,
    monthlyPriceUsd: null,
  },
  {
    key: "anthropic-claude-fallback",
    providerId: "anthropic",
    kind: "api_model",
    label: "Anthropic Fallback",
    visible: false,
    matchPrefixes: [],
    inputCostPerMillionMicros: 5_000_000,
    outputCostPerMillionMicros: 25_000_000,
    monthlyPriceUsd: null,
  },
  {
    key: "anthropic-plan-pro",
    providerId: "anthropic",
    kind: "subscription_plan",
    label: "Claude Pro",
    visible: true,
    matchPrefixes: [],
    inputCostPerMillionMicros: null,
    outputCostPerMillionMicros: null,
    monthlyPriceUsd: 20,
  },
  {
    key: "anthropic-plan-max-5x",
    providerId: "anthropic",
    kind: "subscription_plan",
    label: "Claude Max 5x",
    visible: true,
    matchPrefixes: [],
    inputCostPerMillionMicros: null,
    outputCostPerMillionMicros: null,
    monthlyPriceUsd: 100,
  },
  {
    key: "anthropic-plan-max-20x",
    providerId: "anthropic",
    kind: "subscription_plan",
    label: "Claude Max 20x",
    visible: true,
    matchPrefixes: [],
    inputCostPerMillionMicros: null,
    outputCostPerMillionMicros: null,
    monthlyPriceUsd: 200,
  },
  {
    key: "openai-codex-mini",
    providerId: "openai",
    kind: "api_model",
    label: "Codex Mini",
    visible: true,
    matchPrefixes: ["codex-mini"],
    inputCostPerMillionMicros: 1_500_000,
    outputCostPerMillionMicros: 6_000_000,
    monthlyPriceUsd: null,
  },
  {
    key: "openai-gpt-5",
    providerId: "openai",
    kind: "api_model",
    label: "GPT-5",
    visible: true,
    matchPrefixes: ["gpt-5", "o3", "o4"],
    inputCostPerMillionMicros: 10_000_000,
    outputCostPerMillionMicros: 30_000_000,
    monthlyPriceUsd: null,
  },
  {
    key: "openai-gpt-4o",
    providerId: "openai",
    kind: "api_model",
    label: "GPT-4o",
    visible: true,
    matchPrefixes: ["gpt-4o"],
    inputCostPerMillionMicros: 2_500_000,
    outputCostPerMillionMicros: 10_000_000,
    monthlyPriceUsd: null,
  },
  {
    key: "openai-fallback",
    providerId: "openai",
    kind: "api_model",
    label: "OpenAI Fallback",
    visible: false,
    matchPrefixes: [],
    inputCostPerMillionMicros: 10_000_000,
    outputCostPerMillionMicros: 30_000_000,
    monthlyPriceUsd: null,
  },
];

type ProviderDefaults = Record<PricingProviderId, ProviderPricingSnapshot>;

function buildDefaultProviders(): ProviderDefaults {
  const nowIso = "2026-03-17T00:00:00.000Z";

  return {
    anthropic: {
      providerId: "anthropic",
      sourceType: "bundled_default",
      sourceLabel: "Bundled Anthropic pricing defaults",
      fetchedAtIso: nowIso,
      version: "bundled-2026-03-17",
      refreshError: null,
      rows: DEFAULT_ROWS.filter((row) => row.providerId === "anthropic"),
    },
    openai: {
      providerId: "openai",
      sourceType: "bundled_default",
      sourceLabel: "Bundled OpenAI pricing defaults",
      fetchedAtIso: nowIso,
      version: "bundled-2026-03-17",
      refreshError: null,
      rows: DEFAULT_ROWS.filter((row) => row.providerId === "openai"),
    },
  };
}

function cloneRegistry(registry: PricingRegistry): PricingRegistry {
  return {
    providers: {
      anthropic: {
        ...registry.providers.anthropic,
        rows: registry.providers.anthropic.rows.map((row) => ({ ...row })),
      },
      openai: {
        ...registry.providers.openai,
        rows: registry.providers.openai.rows.map((row) => ({ ...row })),
      },
    },
  };
}

function buildDefaultRegistry(): PricingRegistry {
  return { providers: buildDefaultProviders() };
}

function isPricingProviderId(value: string): value is PricingProviderId {
  return value === "anthropic" || value === "openai";
}

function isPricingRowKind(value: string): value is PricingRowKind {
  return value === "api_model" || value === "subscription_plan";
}

function parsePricingRegistry(value: string | null): PricingRegistry | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as PricingRegistry;
    if (!parsed || typeof parsed !== "object" || !parsed.providers) {
      return null;
    }

    const next = buildDefaultRegistry();

    for (const providerId of ["anthropic", "openai"] as const) {
      const provider = parsed.providers[providerId];
      if (!provider) {
        continue;
      }

      const sourceType = provider.sourceType;
      next.providers[providerId] = {
        providerId,
        sourceType:
          sourceType === "official_pricing_page" ? sourceType : "bundled_default",
        sourceLabel:
          typeof provider.sourceLabel === "string"
            ? provider.sourceLabel
            : next.providers[providerId].sourceLabel,
        fetchedAtIso:
          typeof provider.fetchedAtIso === "string" ? provider.fetchedAtIso : null,
        version:
          typeof provider.version === "string"
            ? provider.version
            : next.providers[providerId].version,
        refreshError:
          typeof provider.refreshError === "string" ? provider.refreshError : null,
        rows: Array.isArray(provider.rows)
          ? provider.rows
              .filter(
                (row): row is PricingRow =>
                  Boolean(row) &&
                  typeof row === "object" &&
                  typeof row.key === "string" &&
                  isPricingProviderId(row.providerId) &&
                  isPricingRowKind(row.kind) &&
                  typeof row.label === "string" &&
                  typeof row.visible === "boolean" &&
                  Array.isArray(row.matchPrefixes)
              )
              .map((row) => ({
                ...row,
                matchPrefixes: row.matchPrefixes.filter(
                  (prefix): prefix is string => typeof prefix === "string"
                ),
              }))
          : next.providers[providerId].rows,
      };
    }

    return next;
  } catch {
    return null;
  }
}

function normalizeText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#x27;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function escapePattern(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function priceToMicros(value: number) {
  return Math.round(value * 1_000_000);
}

function extractModelPricing(
  text: string,
  labels: string[]
): { inputMicros: number; outputMicros: number } | null {
  for (const label of labels) {
    const pattern = new RegExp(
      `${escapePattern(label)}[\\s\\S]{0,260}?\\$(\\d+(?:\\.\\d+)?)\\s*\\/\\s*1M[\\s\\S]{0,160}?\\$(\\d+(?:\\.\\d+)?)\\s*\\/\\s*1M`,
      "i"
    );
    const match = text.match(pattern);
    if (match?.[1] && match?.[2]) {
      return {
        inputMicros: priceToMicros(Number(match[1])),
        outputMicros: priceToMicros(Number(match[2])),
      };
    }
  }

  return null;
}

function extractPlanPrice(text: string, labels: string[]): number | null {
  for (const label of labels) {
    const pattern = new RegExp(
      `${escapePattern(label)}[\\s\\S]{0,120}?\\$(\\d+(?:\\.\\d+)?)`,
      "i"
    );
    const match = text.match(pattern);
    if (match?.[1]) {
      return Number(match[1]);
    }
  }

  return null;
}

function buildVersion(providerId: PricingProviderId, rows: PricingRow[]) {
  const payload = rows
    .filter((row) => row.visible)
    .map((row) => ({
      key: row.key,
      inputCostPerMillionMicros: row.inputCostPerMillionMicros,
      outputCostPerMillionMicros: row.outputCostPerMillionMicros,
      monthlyPriceUsd: row.monthlyPriceUsd,
    }));
  const hash = createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 10);
  return `${providerId}-registry-${hash}`;
}

function updateRow(
  rows: PricingRow[],
  key: string,
  values: Partial<Pick<PricingRow, "inputCostPerMillionMicros" | "outputCostPerMillionMicros" | "monthlyPriceUsd">>
) {
  const row = rows.find((entry) => entry.key === key);
  if (!row) {
    return;
  }

  if (values.inputCostPerMillionMicros != null) {
    row.inputCostPerMillionMicros = values.inputCostPerMillionMicros;
  }
  if (values.outputCostPerMillionMicros != null) {
    row.outputCostPerMillionMicros = values.outputCostPerMillionMicros;
  }
  if (values.monthlyPriceUsd != null) {
    row.monthlyPriceUsd = values.monthlyPriceUsd;
  }
}

async function refreshAnthropicPricing(
  current: ProviderPricingSnapshot
): Promise<ProviderPricingSnapshot> {
  const response = await fetch("https://www.anthropic.com/pricing", {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Anthropic pricing fetch failed (${response.status})`);
  }

  const text = normalizeText(await response.text());
  const rows = current.rows.map((row) => ({ ...row }));

  const opus = extractModelPricing(text, ["Claude Opus 4.6", "Claude Opus 4.5", "Claude Opus 4"]);
  if (opus) {
    updateRow(rows, "anthropic-claude-opus", {
      inputCostPerMillionMicros: opus.inputMicros,
      outputCostPerMillionMicros: opus.outputMicros,
    });
  }

  const sonnet = extractModelPricing(text, ["Claude Sonnet 4.6", "Claude Sonnet 4.5", "Claude Sonnet 4"]);
  if (sonnet) {
    updateRow(rows, "anthropic-claude-sonnet", {
      inputCostPerMillionMicros: sonnet.inputMicros,
      outputCostPerMillionMicros: sonnet.outputMicros,
    });
  }

  const haiku = extractModelPricing(text, ["Claude Haiku 4.5", "Claude Haiku 3.5", "Claude Haiku"]);
  if (haiku) {
    updateRow(rows, "anthropic-claude-haiku", {
      inputCostPerMillionMicros: haiku.inputMicros,
      outputCostPerMillionMicros: haiku.outputMicros,
    });
  }

  const pro = extractPlanPrice(text, ["Claude Pro", "Pro"]);
  if (pro != null) {
    updateRow(rows, "anthropic-plan-pro", { monthlyPriceUsd: pro });
  }

  const max5x = extractPlanPrice(text, ["Max 5x", "Claude Max 5x"]);
  if (max5x != null) {
    updateRow(rows, "anthropic-plan-max-5x", { monthlyPriceUsd: max5x });
  }

  const max20x = extractPlanPrice(text, ["Max 20x", "Claude Max 20x"]);
  if (max20x != null) {
    updateRow(rows, "anthropic-plan-max-20x", { monthlyPriceUsd: max20x });
  }

  const fetchedAtIso = new Date().toISOString();

  return {
    providerId: "anthropic",
    sourceType: "official_pricing_page",
    sourceLabel: "Anthropic pricing page",
    fetchedAtIso,
    version: buildVersion("anthropic", rows),
    refreshError: null,
    rows,
  };
}

async function refreshOpenAIPricing(
  current: ProviderPricingSnapshot
): Promise<ProviderPricingSnapshot> {
  const response = await fetch("https://openai.com/api/pricing/", {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`OpenAI pricing fetch failed (${response.status})`);
  }

  const text = normalizeText(await response.text());
  const rows = current.rows.map((row) => ({ ...row }));

  const gpt5 = extractModelPricing(text, ["GPT-5.4", "GPT-5.1", "GPT-5"]);
  if (gpt5) {
    updateRow(rows, "openai-gpt-5", {
      inputCostPerMillionMicros: gpt5.inputMicros,
      outputCostPerMillionMicros: gpt5.outputMicros,
    });
  }

  const gpt4o = extractModelPricing(text, ["GPT-4o"]);
  if (gpt4o) {
    updateRow(rows, "openai-gpt-4o", {
      inputCostPerMillionMicros: gpt4o.inputMicros,
      outputCostPerMillionMicros: gpt4o.outputMicros,
    });
  }

  const fetchedAtIso = new Date().toISOString();

  return {
    providerId: "openai",
    sourceType: "official_pricing_page",
    sourceLabel: "OpenAI API pricing page",
    fetchedAtIso,
    version: buildVersion("openai", rows),
    refreshError: null,
    rows,
  };
}

export async function getPricingRegistry(): Promise<PricingRegistry> {
  const stored = parsePricingRegistry(await getSetting(SETTINGS_KEYS.PRICING_REGISTRY));
  return stored ?? buildDefaultRegistry();
}

export async function setPricingRegistry(registry: PricingRegistry) {
  await setSetting(SETTINGS_KEYS.PRICING_REGISTRY, JSON.stringify(registry));
}

export async function getPricingRegistrySnapshot(): Promise<PricingRegistrySnapshot> {
  const registry = await getPricingRegistry();
  const fetchedAtValues = Object.values(registry.providers)
    .map((provider) => provider.fetchedAtIso)
    .filter((value): value is string => Boolean(value));
  const lastUpdatedIso =
    fetchedAtValues.length > 0
      ? fetchedAtValues.sort((left, right) => right.localeCompare(left))[0]
      : null;
  const stale =
    lastUpdatedIso == null
      ? true
      : Date.now() - new Date(lastUpdatedIso).getTime() > STALE_AFTER_MS;

  return {
    ...cloneRegistry(registry),
    lastUpdatedIso,
    stale,
  };
}

export async function refreshPricingRegistry(): Promise<PricingRegistrySnapshot> {
  const current = await getPricingRegistry();
  const next = cloneRegistry(current);

  try {
    next.providers.anthropic = await refreshAnthropicPricing(next.providers.anthropic);
  } catch (error) {
    next.providers.anthropic.refreshError =
      error instanceof Error ? error.message : "Failed to refresh Anthropic pricing";
  }

  try {
    next.providers.openai = await refreshOpenAIPricing(next.providers.openai);
  } catch (error) {
    next.providers.openai.refreshError =
      error instanceof Error ? error.message : "Failed to refresh OpenAI pricing";
  }

  await setPricingRegistry(next);
  return getPricingRegistrySnapshot();
}

export async function findPricingRowForModel(input: {
  providerId: PricingProviderId;
  modelId: string;
}) {
  const registry = await getPricingRegistry();
  const rows = registry.providers[input.providerId].rows.filter(
    (row) => row.kind === "api_model"
  );

  const matched = rows.find((row) =>
    row.matchPrefixes.some((prefix) => input.modelId.startsWith(prefix))
  );
  if (matched) {
    return matched;
  }

  return rows.find((row) => row.key === `${input.providerId}-fallback`) ?? null;
}

export async function getClaudeOAuthPlanPrice(plan: ClaudeOAuthPlan | undefined) {
  const registry = await getPricingRegistry();
  const key =
    plan === "max_5x"
      ? "anthropic-plan-max-5x"
      : plan === "max_20x"
        ? "anthropic-plan-max-20x"
        : "anthropic-plan-pro";

  return (
    registry.providers.anthropic.rows.find((row) => row.key === key)?.monthlyPriceUsd ??
    20
  );
}
