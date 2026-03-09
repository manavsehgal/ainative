export interface NotificationSeed {
  id: string;
  taskId: string;
  type: "task_completed" | "task_failed" | "permission_required" | "agent_message";
  title: string;
  body: string;
  read: boolean;
  toolName: string | null;
  toolInput: string | null;
  response: string | null;
  respondedAt: Date | null;
  createdAt: Date;
}

/**
 * Task title → index mapping (from the tasks array order):
 * 0: Analyze portfolio, 1: Research ETFs, 2: Dividend yield (running)
 * 5: Audit competitors, 6: Write hero copy, 7: Design hero (running)
 * 10: Search LinkedIn, 11: Enrich prospect (failed), 12: Draft outreach (queued)
 * 15: Book flights, 17: Create itinerary
 * 20: Gather W-2s, 21: Categorize deductions (running), 22: Calculate home office (queued)
 */
export function createNotifications(taskIds: string[]): NotificationSeed[] {
  const now = Date.now();
  const DAY = 86_400_000;
  const HOUR = 3_600_000;

  return [
    {
      id: crypto.randomUUID(),
      taskId: taskIds[0], // Analyze portfolio — completed
      type: "task_completed",
      title: "Portfolio analysis complete",
      body: "Analyzed allocation across 15 holdings. Tech exposure at 42% — recommend rebalancing below 35%.",
      read: true,
      toolName: null,
      toolInput: null,
      response: null,
      respondedAt: null,
      createdAt: new Date(now - 12 * DAY),
    },
    {
      id: crypto.randomUUID(),
      taskId: taskIds[15], // Book flights — completed
      type: "task_completed",
      title: "Flight booking confirmed",
      body: "Booked United round-trip SFO↔JFK for Mar 15-18. Total: $660, Economy Plus.",
      read: true,
      toolName: null,
      toolInput: null,
      response: null,
      respondedAt: null,
      createdAt: new Date(now - 6 * DAY),
    },
    {
      id: crypto.randomUUID(),
      taskId: taskIds[5], // Audit competitors — completed
      type: "task_completed",
      title: "Competitor audit ready for review",
      body: "Analyzed Notion, Linear, Vercel, and Stripe landing pages. Key opportunity: dynamic hero personalization.",
      read: false,
      toolName: null,
      toolInput: null,
      response: null,
      respondedAt: null,
      createdAt: new Date(now - 9 * DAY),
    },
    {
      id: crypto.randomUUID(),
      taskId: taskIds[11], // Enrich prospect data — failed
      type: "task_failed",
      title: "Prospect enrichment failed",
      body: "Rate limit exceeded when querying enrichment API. 0 of 15 prospects enriched. Retry recommended after cooldown period.",
      read: false,
      toolName: null,
      toolInput: null,
      response: null,
      respondedAt: null,
      createdAt: new Date(now - 6 * DAY),
    },
    {
      id: crypto.randomUUID(),
      taskId: taskIds[12], // Draft outreach — queued
      type: "permission_required",
      title: "Permission to send outreach emails",
      body: "Agent wants to send personalized emails to 12 prospects using drafted templates.",
      read: false,
      toolName: "SendEmail",
      toolInput: JSON.stringify({
        recipients: 12,
        template: "pain-point-hook",
        subject: "{Company}'s engineering velocity — quick question",
      }),
      response: null,
      respondedAt: null,
      createdAt: new Date(now - 4 * DAY),
    },
    {
      id: crypto.randomUUID(),
      taskId: taskIds[21], // Categorize deductions — running
      type: "permission_required",
      title: "Permission to write expense categorization",
      body: "Agent categorized 25 expenses into IRS-recognized deduction categories. Ready to save results.",
      read: true,
      toolName: "Write",
      toolInput: JSON.stringify({
        file_path: "categorized-expenses.csv",
        description: "Categorized deductible expenses with IRS categories",
      }),
      response: "approved",
      respondedAt: new Date(now - 2 * HOUR),
      createdAt: new Date(now - 3 * HOUR),
    },
    {
      id: crypto.randomUUID(),
      taskId: taskIds[7], // Design hero component — running
      type: "agent_message",
      title: "Need clarification on brand color palette",
      body: "The design brief specifies OKLCH hue 250, but the existing codebase uses hue 220 in some components. Should I use 250 consistently, or match the existing 220?",
      read: false,
      toolName: null,
      toolInput: null,
      response: null,
      respondedAt: null,
      createdAt: new Date(now - 1 * HOUR),
    },
    {
      id: crypto.randomUUID(),
      taskId: taskIds[22], // Calculate home office — queued
      type: "agent_message",
      title: "Found 3 potential deduction methods",
      body: "Simplified method ($5/sq ft, max $1,500), actual expense method (pro-rata utilities + depreciation), or Section 280A election. Simplified gives $750, actual estimate is $2,100. Which method should I apply?",
      read: false,
      toolName: null,
      toolInput: null,
      response: null,
      respondedAt: null,
      createdAt: new Date(now - 30 * 60_000),
    },
  ];
}
