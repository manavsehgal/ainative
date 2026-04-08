/**
 * License tier limit notifications.
 * Mirrors the budget_alert notification pattern.
 */

import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import type { LimitResource } from "./tier-limits";
import { licenseManager } from "./manager";

export class TierLimitExceededError extends Error {
  public readonly resource: LimitResource;
  public readonly current: number;
  public readonly limit: number;
  public readonly tier: string;

  constructor(resource: LimitResource, current: number, limit: number) {
    const tier = licenseManager.getTier();
    super(
      `Tier limit exceeded: ${resource} (${current}/${limit}) on ${tier} tier`
    );
    this.name = "TierLimitExceededError";
    this.resource = resource;
    this.current = current;
    this.limit = limit;
    this.tier = tier;
  }
}

const RESOURCE_LABELS: Record<LimitResource, string> = {
  agentMemories: "Agent Memories",
  contextVersions: "Context Versions",
  activeSchedules: "Active Schedules",
  historyRetentionDays: "History Retention",
  parallelWorkflows: "Parallel Workflows",
  maxCloudInstances: "Cloud Instances",
};

/**
 * Create a tier_limit notification to surface limit hits in the Inbox.
 */
export async function createTierLimitNotification(
  resource: LimitResource,
  current: number,
  limit: number,
  taskId?: string
): Promise<void> {
  const tier = licenseManager.getTier();
  const label = RESOURCE_LABELS[resource];

  await db.insert(notifications).values({
    id: crypto.randomUUID(),
    taskId: taskId ?? null,
    type: "tier_limit",
    title: `${label} limit reached`,
    body: `You've reached the ${tier} tier limit of ${limit} ${label.toLowerCase()}. Current usage: ${current}. Upgrade to unlock higher limits.`,
    read: false,
    createdAt: new Date(),
  });
}
