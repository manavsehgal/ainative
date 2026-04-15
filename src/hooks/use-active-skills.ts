"use client";

/**
 * `useActiveSkills` — surfaces the current conversation's composition
 * state for UI affordances on the chat popover Skills tab.
 *
 * Returns the merged active skill IDs (legacy + composed), the runtime
 * id, and the runtime's `supportsSkillComposition` + `maxActiveSkills`
 * capability flags. Used by the `+ Add` action and active-count badge
 * in `chat-command-popover.tsx`.
 *
 * See `features/chat-composition-ui-v1.md`.
 */

import { useCallback, useEffect, useState } from "react";
import { mergeActiveSkillIds } from "@/lib/chat/active-skills";
import { getRuntimeFeatures, type AgentRuntimeId } from "@/lib/agents/runtime/catalog";

interface ActiveSkillsState {
  loading: boolean;
  /** Resolved active skill IDs (legacy + composed, deduped, in order). */
  activeIds: string[];
  /** The conversation's runtime id, or null if not yet loaded / no conversation. */
  runtimeId: AgentRuntimeId | null;
  /** True iff the runtime supports composing 2+ skills concurrently. */
  supportsComposition: boolean;
  /** Max simultaneously-active skills for this runtime (1 for Ollama, 3 elsewhere). */
  maxActive: number;
  /** Re-fetch the conversation row. Call after a successful add/remove. */
  refetch: () => Promise<void>;
}

const KNOWN_RUNTIMES = new Set<AgentRuntimeId>([
  "claude-code",
  "openai-codex-app-server",
  "anthropic-direct",
  "openai-direct",
  "ollama",
]);

export function useActiveSkills(
  conversationId: string | null
): ActiveSkillsState {
  const [activeIds, setActiveIds] = useState<string[]>([]);
  const [runtimeId, setRuntimeId] = useState<AgentRuntimeId | null>(null);
  const [loading, setLoading] = useState<boolean>(!!conversationId);

  const fetchOnce = useCallback(async (): Promise<void> => {
    if (!conversationId) {
      setActiveIds([]);
      setRuntimeId(null);
      setLoading(false);
      return;
    }
    try {
      const r = await fetch(`/api/chat/conversations/${conversationId}`);
      if (!r.ok) {
        setActiveIds([]);
        setRuntimeId(null);
        return;
      }
      const data: {
        activeSkillId?: string | null;
        activeSkillIds?: string[] | null;
        runtimeId?: string | null;
      } = await r.json();
      setActiveIds(
        mergeActiveSkillIds(data.activeSkillId, data.activeSkillIds)
      );
      const rid = data.runtimeId as AgentRuntimeId | null | undefined;
      setRuntimeId(rid && KNOWN_RUNTIMES.has(rid) ? rid : null);
    } catch {
      setActiveIds([]);
      setRuntimeId(null);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    setLoading(true);
    void fetchOnce();
  }, [fetchOnce]);

  // Derive capability flags from the catalog. Defaults match Ollama
  // (most conservative) when the runtime is unknown — better to refuse
  // composition than to crash on an unrecognized id.
  const features = runtimeId
    ? safeGetRuntimeFeatures(runtimeId)
    : null;
  const supportsComposition = features?.supportsSkillComposition ?? false;
  const maxActive = features?.maxActiveSkills ?? 1;

  return {
    loading,
    activeIds,
    runtimeId,
    supportsComposition,
    maxActive,
    refetch: fetchOnce,
  };
}

function safeGetRuntimeFeatures(rid: AgentRuntimeId) {
  try {
    return getRuntimeFeatures(rid);
  } catch {
    return null;
  }
}
