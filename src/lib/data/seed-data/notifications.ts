export interface NotificationSeed {
  id: string;
  taskId: string;
  type: "task_completed" | "task_failed" | "permission_required" | "agent_message" | "budget_alert" | "context_proposal" | "context_proposal_batch";
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
    // Budget alert — unread, needs attention
    {
      id: crypto.randomUUID(),
      taskId: taskIds[2], // Compare dividend yield — running
      type: "budget_alert",
      title: "Daily budget 80% consumed",
      body: "Agent tasks have used $4.02 of your $5.00 daily budget. 2 running tasks may exceed the limit. Consider pausing non-critical tasks or increasing the daily cap in Settings → Budget Guardrails.",
      read: false,
      toolName: null,
      toolInput: null,
      response: null,
      respondedAt: null,
      createdAt: new Date(now - 2 * HOUR),
    },
    // Context proposal — unread, needs attention (agent learned something)
    {
      id: crypto.randomUUID(),
      taskId: taskIds[0], // Analyze portfolio — completed
      type: "context_proposal",
      title: "Learned: Portfolio rebalancing threshold",
      body: "From the portfolio analysis task, I learned that your preferred sector concentration limit is 35%. I'd like to remember this for future investment analysis tasks so I can flag overweight positions automatically.",
      read: false,
      toolName: null,
      toolInput: JSON.stringify({
        pattern: "sector_concentration_limit",
        value: "35%",
        confidence: 0.92,
      }),
      response: null,
      respondedAt: null,
      createdAt: new Date(now - 5 * HOUR),
    },
    // Context proposal batch — read, already responded
    {
      id: crypto.randomUUID(),
      taskId: taskIds[5], // Audit competitors — completed
      type: "context_proposal_batch",
      title: "3 patterns learned from competitor audit",
      body: "After completing the competitor landing page audit, I identified 3 reusable patterns:\n\n1. **Social proof placement** — above the fold, not below\n2. **CTA limit** — max 3 CTAs per page for focus\n3. **Hero personalization** — dynamic content based on referral source\n\nShall I remember these for future marketing tasks?",
      read: true,
      toolName: null,
      toolInput: JSON.stringify({
        patterns: [
          { key: "social_proof_placement", value: "above_fold" },
          { key: "cta_limit", value: 3 },
          { key: "hero_personalization", value: "referral_based" },
        ],
        confidence: 0.88,
      }),
      response: "approved",
      respondedAt: new Date(now - 8 * HOUR),
      createdAt: new Date(now - 10 * HOUR),
    },
  ];
}
