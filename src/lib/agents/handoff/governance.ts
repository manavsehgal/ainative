/**
 * Handoff governance: validation rules for agent-to-agent handoffs.
 */

import { listAllProfiles } from "@/lib/agents/profiles/registry";
import type { HandoffRequest } from "./types";
import { MAX_CHAIN_DEPTH } from "./types";

export function validateHandoff(
  request: HandoffRequest,
  currentChainDepth: number
): { valid: boolean; error?: string } {
  // No self-handoff
  if (request.fromProfileId === request.toProfileId) {
    return { valid: false, error: "Cannot hand off to the same profile (no self-handoff)" };
  }

  // Chain depth limit
  if (currentChainDepth >= MAX_CHAIN_DEPTH) {
    return {
      valid: false,
      error: `Chain depth limit reached (max ${MAX_CHAIN_DEPTH}). Cannot create further handoffs in this chain.`,
    };
  }

  // Validate both profile IDs exist
  const profiles = listAllProfiles();
  const profileIds = new Set(profiles.map((p) => p.id));

  if (!profileIds.has(request.fromProfileId)) {
    return { valid: false, error: `Source profile not found: ${request.fromProfileId}` };
  }

  if (!profileIds.has(request.toProfileId)) {
    return { valid: false, error: `Target profile not found: ${request.toProfileId}` };
  }

  // Validate subject and body
  if (!request.subject?.trim()) {
    return { valid: false, error: "Subject is required" };
  }
  if (!request.body?.trim()) {
    return { valid: false, error: "Body is required" };
  }

  return { valid: true };
}
