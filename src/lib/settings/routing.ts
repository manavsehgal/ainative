/**
 * Routing preference setting — controls how suggestRuntime() picks runtimes.
 */

import { SETTINGS_KEYS, type RoutingPreference } from "@/lib/constants/settings";
import { getSetting, setSetting } from "./helpers";

const VALID_PREFERENCES: RoutingPreference[] = ["cost", "latency", "quality", "manual"];
const DEFAULT_PREFERENCE: RoutingPreference = "latency";

export async function getRoutingPreference(): Promise<RoutingPreference> {
  const raw = await getSetting(SETTINGS_KEYS.ROUTING_PREFERENCE);
  if (raw && VALID_PREFERENCES.includes(raw as RoutingPreference)) {
    return raw as RoutingPreference;
  }
  return DEFAULT_PREFERENCE;
}

export async function setRoutingPreference(value: RoutingPreference): Promise<void> {
  if (!VALID_PREFERENCES.includes(value)) {
    throw new Error(`Invalid routing preference: ${value}`);
  }
  await setSetting(SETTINGS_KEYS.ROUTING_PREFERENCE, value);
}
