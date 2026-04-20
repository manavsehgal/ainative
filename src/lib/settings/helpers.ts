import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/** Read a single setting from DB */
export async function getSetting(key: string): Promise<string | null> {
  const rows = await db.select().from(settings).where(eq(settings.key, key));
  return rows[0]?.value ?? null;
}

/** Read a single setting from DB (synchronous — safe with better-sqlite3) */
export function getSettingSync(key: string): string | null {
  const rows = db.select().from(settings).where(eq(settings.key, key)).all();
  return rows[0]?.value ?? null;
}

/** Upsert a setting in DB */
export async function setSetting(key: string, value: string): Promise<void> {
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

// ---------------------------------------------------------------------------
// TDR-037 plugin trust model setting
// ---------------------------------------------------------------------------

/**
 * Plugin trust model (TDR-037 §5). Controls how `isCapabilityAccepted`
 * branches for a given plugin bundle:
 *
 *   - "auto" (default) — path split via classifier. Self-extension bundles
 *     bypass the lockfile; third-party bundles get the full M3 machinery.
 *   - "strict"          — force all bundles through the third-party path
 *     (lockfile consulted even for ainative-internal bundles). Training
 *     wheels for operators who want explicit accept on their own code.
 *   - "off"             — trust-on-first-use for all bundles. Matches
 *     Claude Code / Codex CLI freedom with no capability ceremony.
 *
 * Settings key: `plugin-trust-model`.
 */
export type PluginTrustModelSetting = "auto" | "strict" | "off";

const PLUGIN_TRUST_MODEL_KEY = "plugin-trust-model";
const PLUGIN_TRUST_MODEL_VALUES: readonly PluginTrustModelSetting[] = [
  "auto",
  "strict",
  "off",
];

function coerceTrustModel(raw: string | null): PluginTrustModelSetting {
  if (raw === null) return "auto";
  return PLUGIN_TRUST_MODEL_VALUES.includes(raw as PluginTrustModelSetting)
    ? (raw as PluginTrustModelSetting)
    : "auto";
}

export async function getPluginTrustModel(): Promise<PluginTrustModelSetting> {
  return coerceTrustModel(await getSetting(PLUGIN_TRUST_MODEL_KEY));
}

export function getPluginTrustModelSync(): PluginTrustModelSetting {
  return coerceTrustModel(getSettingSync(PLUGIN_TRUST_MODEL_KEY));
}

export async function setPluginTrustModel(
  value: PluginTrustModelSetting,
): Promise<void> {
  await setSetting(PLUGIN_TRUST_MODEL_KEY, value);
}
