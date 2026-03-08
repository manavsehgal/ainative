import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { encrypt, decrypt } from "@/lib/utils/crypto";
import { SETTINGS_KEYS, type AuthMethod, type ApiKeySource } from "@/lib/constants/settings";
import type { UpdateAuthSettingsInput } from "@/lib/validators/settings";

export interface AuthSettings {
  method: AuthMethod;
  hasKey: boolean;
  apiKeySource: ApiKeySource;
}

/** Read a single setting from DB */
async function getSetting(key: string): Promise<string | null> {
  const rows = await db.select().from(settings).where(eq(settings.key, key));
  return rows[0]?.value ?? null;
}

/** Upsert a setting in DB */
async function setSetting(key: string, value: string): Promise<void> {
  const now = new Date();
  const existing = await getSetting(key);
  if (existing !== null) {
    await db.update(settings)
      .set({ value, updatedAt: now })
      .where(eq(settings.key, key));
  } else {
    await db.insert(settings)
      .values({ key, value, updatedAt: now });
  }
}

/**
 * Get current auth settings. Never returns the raw API key.
 */
export async function getAuthSettings(): Promise<AuthSettings> {
  const method = ((await getSetting(SETTINGS_KEYS.AUTH_METHOD)) as AuthMethod) ?? "api_key";
  const encryptedKey = await getSetting(SETTINGS_KEYS.AUTH_API_KEY);
  const storedSource = (await getSetting(SETTINGS_KEYS.AUTH_API_KEY_SOURCE)) as ApiKeySource | null;

  const hasDbKey = encryptedKey !== null;
  const hasEnvKey = !!process.env.ANTHROPIC_API_KEY;

  let apiKeySource: ApiKeySource;
  if (storedSource) {
    apiKeySource = storedSource;
  } else if (hasDbKey) {
    apiKeySource = "db";
  } else if (hasEnvKey) {
    apiKeySource = "env";
  } else if (method === "oauth") {
    apiKeySource = "oauth";
  } else {
    apiKeySource = "unknown";
  }

  return {
    method,
    hasKey: hasDbKey || hasEnvKey,
    apiKeySource,
  };
}

/**
 * Save auth settings. Encrypts API key before storing.
 */
export async function setAuthSettings(input: UpdateAuthSettingsInput): Promise<void> {
  await setSetting(SETTINGS_KEYS.AUTH_METHOD, input.method);

  if (input.apiKey) {
    await setSetting(SETTINGS_KEYS.AUTH_API_KEY, encrypt(input.apiKey));
    await setSetting(SETTINGS_KEYS.AUTH_API_KEY_SOURCE, "db");
  } else if (input.method === "oauth") {
    // Clear stored key when switching to OAuth
    const existingKey = await getSetting(SETTINGS_KEYS.AUTH_API_KEY);
    if (existingKey !== null) {
      await db.delete(settings)
        .where(eq(settings.key, SETTINGS_KEYS.AUTH_API_KEY));
    }
    await setSetting(SETTINGS_KEYS.AUTH_API_KEY_SOURCE, "oauth");
  }
}

/**
 * Get the environment variables to pass to the Agent SDK.
 * Priority: DB-stored key > process.env > undefined (SDK falls back to OAuth).
 */
export async function getAuthEnv(): Promise<Record<string, string> | undefined> {
  const method = ((await getSetting(SETTINGS_KEYS.AUTH_METHOD)) as AuthMethod) ?? "api_key";

  // If OAuth is selected, don't inject any key — let SDK handle it
  if (method === "oauth") {
    return undefined;
  }

  // Try DB-stored key first
  const encryptedKey = await getSetting(SETTINGS_KEYS.AUTH_API_KEY);
  if (encryptedKey) {
    try {
      const key = decrypt(encryptedKey);
      return { ANTHROPIC_API_KEY: key };
    } catch {
      // If decryption fails, fall through to env
    }
  }

  // Fall back to env var (already in process.env, no need to inject)
  return undefined;
}

/**
 * Update the last-known API key source after SDK initialization.
 */
export async function updateAuthStatus(source: ApiKeySource): Promise<void> {
  await setSetting(SETTINGS_KEYS.AUTH_API_KEY_SOURCE, source);
}
