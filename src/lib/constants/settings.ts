export const SETTINGS_KEYS = {
  AUTH_METHOD: "auth.method",
  AUTH_API_KEY: "auth.apiKey",
  AUTH_API_KEY_SOURCE: "auth.apiKeySource",
  OPENAI_AUTH_API_KEY: "openai.authApiKey",
  OPENAI_AUTH_API_KEY_SOURCE: "openai.authApiKeySource",
  PERMISSIONS_ALLOW: "permissions.allow",
  BUDGET_POLICY: "usage.budgetPolicy",
  BUDGET_WARNING_STATE: "usage.budgetWarningState",
  PRICING_REGISTRY: "usage.pricingRegistry",
  SDK_TIMEOUT_SECONDS: "runtime.sdkTimeoutSeconds",
  MAX_TURNS: "runtime.maxTurns",
} as const;

export type AuthMethod = "api_key" | "oauth";
export type ApiKeySource = "db" | "env" | "oauth" | "unknown";
