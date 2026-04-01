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
  LEARNING_CONTEXT_CHAR_LIMIT: "learning.contextCharLimit",
  BROWSER_MCP_CHROME_DEVTOOLS_ENABLED: "browser.chromeDevtoolsEnabled",
  BROWSER_MCP_PLAYWRIGHT_ENABLED: "browser.playwrightEnabled",
  BROWSER_MCP_CHROME_DEVTOOLS_CONFIG: "browser.chromeDevtoolsConfig",
  BROWSER_MCP_PLAYWRIGHT_CONFIG: "browser.playwrightConfig",
  EXA_SEARCH_MCP_ENABLED: "web.exaSearchEnabled",
  ROUTING_PREFERENCE: "routing.preference",
  OLLAMA_BASE_URL: "ollama.baseUrl",
  OLLAMA_DEFAULT_MODEL: "ollama.defaultModel",
} as const;

export type RoutingPreference = "cost" | "latency" | "quality" | "manual";

export type AuthMethod = "api_key" | "oauth";
export type ApiKeySource = "db" | "env" | "oauth" | "unknown";
