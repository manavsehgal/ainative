import { getSettingSync, setSetting } from "@/lib/settings/helpers";
import type { InstanceConfig, Guardrails, UpgradeState } from "./types";

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

const UPGRADE_KEY = "instance.upgrade";

const DEFAULT_UPGRADE_STATE: UpgradeState = {
  lastPolledAt: null,
  lastUpstreamSha: null,
  localMainSha: null,
  upgradeAvailable: false,
  commitsBehind: 0,
  lastSuccessfulUpgradeAt: null,
  lastUpgradeTaskId: null,
  pollFailureCount: 0,
  lastPollError: null,
};

export function getUpgradeState(): UpgradeState {
  return readJson<UpgradeState>(UPGRADE_KEY) ?? { ...DEFAULT_UPGRADE_STATE };
}

export async function setUpgradeState(state: UpgradeState): Promise<void> {
  await setSetting(UPGRADE_KEY, JSON.stringify(state));
}
