export const DISMISSAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface DismissalStore {
  read(): string | null;
  write(value: string): void;
}

export type DismissalMap = Record<string, Record<string, number>>;

export function loadDismissals(store: DismissalStore): DismissalMap {
  const raw = store.read();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as DismissalMap;
  } catch {
    // corrupt — fall through
  }
  return {};
}

export function saveDismissal(
  store: DismissalStore,
  conversationId: string,
  skillId: string,
  nowMs: number = Date.now()
): void {
  const current = loadDismissals(store);
  current[conversationId] = current[conversationId] ?? {};
  current[conversationId][skillId] = nowMs;
  try {
    store.write(JSON.stringify(current));
  } catch {
    // silent — in-memory state won't persist
  }
}

export function activeDismissedIds(
  store: DismissalStore,
  conversationId: string,
  nowMs: number = Date.now()
): Set<string> {
  const all = loadDismissals(store);
  const conv = all[conversationId];
  if (!conv) return new Set();
  const out = new Set<string>();
  for (const [skillId, ts] of Object.entries(conv)) {
    if (nowMs - ts < DISMISSAL_TTL_MS) out.add(skillId);
  }
  return out;
}

/** Browser store adapter around localStorage for a given key. */
export function browserLocalStore(key: string): DismissalStore {
  return {
    read() {
      if (typeof window === "undefined") return null;
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    write(value) {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // quota / disabled — silent
      }
    },
  };
}
