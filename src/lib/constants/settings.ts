export const SETTINGS_KEYS = {
  AUTH_METHOD: "auth.method",
  AUTH_API_KEY: "auth.apiKey",
  AUTH_API_KEY_SOURCE: "auth.apiKeySource",
  OPENAI_AUTH_METHOD: "openai.authMethod",
  OPENAI_AUTH_API_KEY: "openai.authApiKey",
  OPENAI_AUTH_API_KEY_SOURCE: "openai.authApiKeySource",
  OPENAI_AUTH_OAUTH_CONNECTED: "openai.oauthConnected",
  OPENAI_AUTH_ACCOUNT: "openai.account",
  OPENAI_AUTH_RATE_LIMITS: "openai.rateLimits",
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
  // Cloud account
  CLOUD_EMAIL: "cloud.email",
  // Supabase cloud
  SUPABASE_URL: "cloud.supabaseUrl",
  SUPABASE_ANON_KEY: "cloud.supabaseAnonKey",
  // Telemetry (opt-in)
  TELEMETRY_ENABLED: "telemetry.enabled",
  TELEMETRY_RUNTIME_ID: "telemetry.runtimeId",
  TELEMETRY_BATCH: "telemetry.batch",
  // Cloud sync
  DEVICE_ID: "sync.deviceId",
  LAST_SYNC_AT: "sync.lastSyncAt",
  // Stripe
  STRIPE_CUSTOMER_ID: "billing.stripeCustomerId",
  // Schedule orchestration
  SCHEDULE_MAX_CONCURRENT: "schedule.maxConcurrent",
  SCHEDULE_MAX_RUN_DURATION_SEC: "schedule.maxRunDurationSec",
  SCHEDULE_CHAT_PRESSURE_DELAY_SEC: "schedule.chatPressureDelaySec",
} as const;

export type RoutingPreference = "cost" | "latency" | "quality" | "manual";

export type AuthMethod = "api_key" | "oauth";
export type ApiKeySource = "db" | "env" | "oauth" | "unknown";
