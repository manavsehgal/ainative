/**
 * Types for agent async handoff system.
 */

export interface HandoffRequest {
  fromProfileId: string;
  toProfileId: string;
  sourceTaskId: string;
  subject: string;
  body: string;
  priority?: number;
  requiresApproval?: boolean;
  parentMessageId?: string;
}

export const MAX_CHAIN_DEPTH = 5;
