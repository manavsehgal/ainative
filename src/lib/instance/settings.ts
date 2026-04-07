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

export function setInstanceConfig(config: InstanceConfig): void {
  // setSetting returns a Promise but the underlying better-sqlite3 operation
  // completes synchronously. Discarding the Promise with `void` is safe and
  // lets this module expose a synchronous surface that the bootstrap
  // orchestrator can call without forcing all callers to be async.
  void setSetting(INSTANCE_KEY, JSON.stringify(config));
}

export function getGuardrails(): Guardrails {
  return readJson<Guardrails>(GUARDRAILS_KEY) ?? { ...DEFAULT_GUARDRAILS };
}

export function setGuardrails(guardrails: Guardrails): void {
  void setSetting(GUARDRAILS_KEY, JSON.stringify(guardrails));
}
