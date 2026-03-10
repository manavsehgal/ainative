export const SETTINGS_KEYS = {
  AUTH_METHOD: "auth.method",
  AUTH_API_KEY: "auth.apiKey",
  AUTH_API_KEY_SOURCE: "auth.apiKeySource",
  PERMISSIONS_ALLOW: "permissions.allow",
} as const;

export type AuthMethod = "api_key" | "oauth";
export type ApiKeySource = "db" | "env" | "oauth" | "unknown";
