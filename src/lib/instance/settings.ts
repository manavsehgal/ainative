import { getSettingSync, setSetting } from "@/lib/settings/helpers";
import type { InstanceConfig, Guardrails } from "./types";

const INSTANCE_KEY = "instance";
const GUARDRAILS_KEY = "instance.guardrails";

const DEFAULT_GUARDRAILS: Guardrails = {
  prePushHookInstalled: false,
  prePushHookVersion: "",
  pushRemoteBlocked: [],
  consentStatus: "not_yet",
  firstBootCompletedAt: null,
};

function readJson<T>(key: string): T | null {
  const raw = getSettingSync(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function getInstanceConfig(): InstanceConfig | null {
  return readJson<InstanceConfig>(INSTANCE_KEY);
}

export async function setInstanceConfig(config: InstanceConfig): Promise<void> {
  await setSetting(INSTANCE_KEY, JSON.stringify(config));
}

export function getGuardrails(): Guardrails {
  return readJson<Guardrails>(GUARDRAILS_KEY) ?? { ...DEFAULT_GUARDRAILS };
}

export async function setGuardrails(guardrails: Guardrails): Promise<void> {
  await setSetting(GUARDRAILS_KEY, JSON.stringify(guardrails));
}
