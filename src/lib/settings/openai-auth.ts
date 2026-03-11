import { SETTINGS_KEYS, type ApiKeySource } from "@/lib/constants/settings";
import { decrypt, encrypt } from "@/lib/utils/crypto";
import { getSetting, setSetting } from "./helpers";

export interface OpenAIAuthSettings {
  hasKey: boolean;
  apiKeySource: ApiKeySource;
}

export interface OpenAIAuthConfigInput {
  apiKey: string;
}

export async function getOpenAIAuthSettings(): Promise<OpenAIAuthSettings> {
  const encryptedKey = await getSetting(SETTINGS_KEYS.OPENAI_AUTH_API_KEY);
  const storedSource = (await getSetting(
    SETTINGS_KEYS.OPENAI_AUTH_API_KEY_SOURCE
  )) as ApiKeySource | null;

  const hasDbKey = encryptedKey !== null;
  const hasEnvKey = !!process.env.OPENAI_API_KEY;

  let apiKeySource: ApiKeySource;
  if (storedSource) {
    apiKeySource = storedSource;
  } else if (hasDbKey) {
    apiKeySource = "db";
  } else if (hasEnvKey) {
    apiKeySource = "env";
  } else {
    apiKeySource = "unknown";
  }

  return {
    hasKey: hasDbKey || hasEnvKey,
    apiKeySource,
  };
}

export async function setOpenAIAuthSettings(
  input: OpenAIAuthConfigInput
): Promise<void> {
  await setSetting(
    SETTINGS_KEYS.OPENAI_AUTH_API_KEY,
    encrypt(input.apiKey)
  );
  await setSetting(SETTINGS_KEYS.OPENAI_AUTH_API_KEY_SOURCE, "db");
}

export async function getOpenAIApiKey(): Promise<{
  apiKey: string | null;
  source: Extract<ApiKeySource, "db" | "env" | "unknown">;
}> {
  const encryptedKey = await getSetting(SETTINGS_KEYS.OPENAI_AUTH_API_KEY);
  if (encryptedKey) {
    try {
      return { apiKey: decrypt(encryptedKey), source: "db" };
    } catch {
      // Fall through to env lookup.
    }
  }

  if (process.env.OPENAI_API_KEY) {
    return { apiKey: process.env.OPENAI_API_KEY, source: "env" };
  }

  return { apiKey: null, source: "unknown" };
}

export async function getOpenAIAuthEnv(): Promise<Record<string, string> | undefined> {
  const { apiKey } = await getOpenAIApiKey();
  if (!apiKey) return undefined;
  return { OPENAI_API_KEY: apiKey };
}

export async function updateOpenAIAuthStatus(
  source: Extract<ApiKeySource, "db" | "env" | "unknown">
): Promise<void> {
  await setSetting(SETTINGS_KEYS.OPENAI_AUTH_API_KEY_SOURCE, source);
}
