export interface UserTableViewSeed {
  tableName: string;
  name: string;
  type: "grid" | "chart" | "joined";
  config: Record<string, unknown>;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserTableTriggerSeed {
  tableName: string;
  name: string;
  triggerEvent: "row_added" | "row_updated" | "row_deleted";
  condition: Record<string, unknown> | null;
  actionType: "run_workflow" | "create_task";
  actionConfig: Record<string, unknown>;
  status: "active" | "paused";
  fireCount: number;
  lastFiredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserTableRelationshipSeed {
  fromTableName: string;
  fromColumn: string;
  toTableName: string;
  toColumn: string;
  relationshipType: "one_to_one" | "one_to_many" | "many_to_many";
  config: Record<string, unknown> | null;
  createdAt: Date;
}

/**
 * Returns views/triggers/relationships keyed by seeded table *name*.
 * The caller (seed.ts) resolves names to IDs after createTable() runs,
 * then inserts these rows against the real table IDs.
 */
export function createTableExtras(): {
  views: UserTableViewSeed[];
  triggers: UserTableTriggerSeed[];
  relationships: UserTableRelationshipSeed[];
} {
  const now = Date.now();
  const DAY = 86_400_000;
  const HOUR = 3_600_000;

  const views: UserTableViewSeed[] = [
    {
      tableName: "Launch Campaign Tracker",
      name: "Live Channels",
      type: "grid",
      config: {
        filters: [
          { column: "status", operator: "in", value: ["Live", "Completed"] },
        ],
        sorting: [{ id: "impressions", desc: true }],
      },
      isDefault: false,
      createdAt: new Date(now - 9 * DAY),
      updatedAt: new Date(now - 2 * DAY),
    },
    {
      tableName: "Launch Campaign Tracker",
      name: "Signups by Channel",
      type: "chart",
      config: {
        chartType: "bar",
        xColumn: "channel",
        yColumn: "signups",
        aggregate: "sum",
      },
      isDefault: false,
      createdAt: new Date(now - 7 * DAY),
      updatedAt: new Date(now - 1 * DAY),
    },
    {
      tableName: "Content Pipeline",
      name: "Drafting & Editing",
      type: "grid",
      config: {
        filters: [
          {
            column: "status",
            operator: "in",
            value: ["Drafting", "Editing", "Outlined"],
          },
        ],
        sorting: [{ id: "publish_date", desc: false }],
      },
      isDefault: false,
      createdAt: new Date(now - 6 * DAY),
      updatedAt: new Date(now - 1 * DAY),
    },
    {
      tableName: "Content Pipeline",
      name: "Organic Traffic Trend",
      type: "chart",
      config: {
        chartType: "line",
        xColumn: "publish_date",
        yColumn: "organic_sessions",
        aggregate: "sum",
      },
      isDefault: false,
      createdAt: new Date(now - 4 * DAY),
      updatedAt: new Date(now - 1 * HOUR),
    },
    {
      tableName: "Portfolio Company KPIs",
      name: "NRR vs ARR",
      type: "chart",
      config: {
        chartType: "scatter",
        xColumn: "arr",
        yColumn: "nrr",
      },
      isDefault: false,
      createdAt: new Date(now - 5 * DAY),
      updatedAt: new Date(now - 2 * DAY),
    },
    {
      tableName: "Customer Health Scores",
      name: "Red Zone",
      type: "grid",
      config: {
        filters: [{ column: "health", operator: "eq", value: "Red" }],
        sorting: [{ id: "mrr", desc: true }],
      },
      isDefault: true,
      createdAt: new Date(now - 8 * DAY),
      updatedAt: new Date(now - 1 * DAY),
    },
  ];

  const triggers: UserTableTriggerSeed[] = [
    {
      tableName: "Customer Health Scores",
      name: "Auto-create CS task on red flag",
      triggerEvent: "row_updated",
      condition: { column: "health", operator: "eq", value: "Red" },
      actionType: "create_task",
      actionConfig: {
        title: "CS check-in: account went red",
        description:
          "Reach out within 48 hours. Pull usage snapshot, review last 3 tickets, draft executive-level outreach.",
      },
      status: "active",
      fireCount: 7,
      lastFiredAt: new Date(now - 1 * DAY),
      createdAt: new Date(now - 14 * DAY),
      updatedAt: new Date(now - 1 * DAY),
    },
    {
      tableName: "Launch Campaign Tracker",
      name: "Run content cycle when channel goes live",
      triggerEvent: "row_updated",
      condition: { column: "status", operator: "eq", value: "Live" },
      actionType: "run_workflow",
      actionConfig: { workflowName: "Weekly Content Cycle" },
      status: "active",
      fireCount: 3,
      lastFiredAt: new Date(now - 2 * DAY),
      createdAt: new Date(now - 11 * DAY),
      updatedAt: new Date(now - 2 * DAY),
    },
    {
      tableName: "Content Pipeline",
      name: "Trigger editorial review on 'Editing'",
      triggerEvent: "row_updated",
      condition: { column: "status", operator: "eq", value: "Editing" },
      actionType: "create_task",
      actionConfig: {
        title: "Editorial review: new draft in queue",
        description:
          "Review brand voice, fact-check citations, run SEO checklist, and approve for publish.",
      },
      status: "active",
      fireCount: 4,
      lastFiredAt: new Date(now - 3 * DAY),
      createdAt: new Date(now - 9 * DAY),
      updatedAt: new Date(now - 3 * DAY),
    },
    {
      tableName: "Deal Pipeline",
      name: "Flag stalled deal (paused)",
      triggerEvent: "row_added",
      condition: { column: "days_in_stage", operator: "gte", value: 14 },
      actionType: "create_task",
      actionConfig: {
        title: "Stalled deal review",
        description:
          "Deal has been in stage 14+ days. Contact owner, identify blocker, propose next-step plan.",
      },
      status: "paused",
      fireCount: 12,
      lastFiredAt: new Date(now - 15 * DAY),
      createdAt: new Date(now - 28 * DAY),
      updatedAt: new Date(now - 4 * DAY),
    },
  ];

  const relationships: UserTableRelationshipSeed[] = [
    {
      fromTableName: "Deal Pipeline",
      fromColumn: "deal_name",
      toTableName: "Customer Health Scores",
      toColumn: "account",
      relationshipType: "many_to_many",
      config: { displayColumn: "account" },
      createdAt: new Date(now - 15 * DAY),
    },
    {
      fromTableName: "Launch Campaign Tracker",
      fromColumn: "owner",
      toTableName: "Content Pipeline",
      toColumn: "owner",
      relationshipType: "one_to_many",
      config: { displayColumn: "title" },
      createdAt: new Date(now - 10 * DAY),
    },
  ];

  return { views, triggers, relationships };
}
