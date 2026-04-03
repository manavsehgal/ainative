export interface LearnedContextSeed {
  id: string;
  profileId: string;
  version: number;
  content: string | null;
  diff: string | null;
  changeType: "proposal" | "approved" | "rejected" | "rollback" | "summarization";
  sourceTaskId: string | null;
  proposalNotificationId: string | null;
  proposedAdditions: string | null;
  approvedBy: string | null;
  createdAt: Date;
}

export function createLearnedContext(
  completedTaskIds: string[]
): LearnedContextSeed[] {
  const now = Date.now();
  const DAY = 86_400_000;
  const HOUR = 3_600_000;

  const sourceTask2 = completedTaskIds[1] ?? null; // Copy variants (P1)
  const sourceTask4 = completedTaskIds[3] ?? null; // Article (P2)
  const sourceTask6 = completedTaskIds[5] ?? null; // Churn analysis (P3)

  return [
    // GTM profile: proposal → approved (benefit-led headlines)
    {
      id: crypto.randomUUID(),
      profileId: "stagent-sample-gtm-launch-strategist",
      version: 1,
      content: null,
      diff: null,
      changeType: "proposal",
      sourceTaskId: sourceTask2,
      proposalNotificationId: null,
      proposedAdditions:
        "User prefers benefit-led headlines over feature-led ones. When writing marketing copy, prioritize pain/outcome framing over feature announcements. Use social proof as supporting evidence, not the lead.",
      approvedBy: null,
      createdAt: new Date(now - 14 * DAY),
    },
    {
      id: crypto.randomUUID(),
      profileId: "stagent-sample-gtm-launch-strategist",
      version: 2,
      content:
        "User prefers benefit-led headlines over feature-led ones. When writing marketing copy, prioritize pain/outcome framing over feature announcements. Use social proof as supporting evidence, not the lead.",
      diff: "+ Benefit-led headlines preferred over feature-led.\n+ Pain/outcome framing > feature announcements.\n+ Social proof as support, not lead.",
      changeType: "approved",
      sourceTaskId: sourceTask2,
      proposalNotificationId: null,
      proposedAdditions: null,
      approvedBy: "user",
      createdAt: new Date(now - 14 * DAY + 2 * HOUR),
    },

    // Content profile: proposal → approved (article length)
    {
      id: crypto.randomUUID(),
      profileId: "stagent-sample-content-production-editor",
      version: 1,
      content: null,
      diff: null,
      changeType: "proposal",
      sourceTaskId: sourceTask4,
      proposalNotificationId: null,
      proposedAdditions:
        "Target 1,500-2,000 words for SEO articles. Shorter pieces don't rank for competitive keywords; longer ones have lower completion rates. Aim for Flesch-Kincaid score under 45.",
      approvedBy: null,
      createdAt: new Date(now - 10 * DAY),
    },
    {
      id: crypto.randomUUID(),
      profileId: "stagent-sample-content-production-editor",
      version: 2,
      content:
        "Target 1,500-2,000 words for SEO articles. Shorter pieces don't rank for competitive keywords; longer ones have lower completion rates. Aim for Flesch-Kincaid score under 45.",
      diff: "+ Target 1,500-2,000 words for SEO articles.\n+ FK score target: under 45.",
      changeType: "approved",
      sourceTaskId: sourceTask4,
      proposalNotificationId: null,
      proposedAdditions: null,
      approvedBy: "user",
      createdAt: new Date(now - 10 * DAY + 1 * HOUR),
    },

    // RevOps profile: proposal (deal stall threshold — pending)
    {
      id: crypto.randomUUID(),
      profileId: "stagent-sample-revenue-ops-analyst",
      version: 1,
      content: null,
      diff: null,
      changeType: "proposal",
      sourceTaskId: completedTaskIds[8] ?? null, // Pipeline snapshot (P7)
      proposalNotificationId: null,
      proposedAdditions:
        "Deal stall threshold is 5 business days without activity. Flag deals exceeding this in every pipeline review. Coaching notes should include specific unblocking actions, not just the stall observation.",
      approvedBy: null,
      createdAt: new Date(now - 3 * DAY),
    },

    // CS profile: proposal → approved (NPS threshold)
    {
      id: crypto.randomUUID(),
      profileId: "stagent-sample-customer-success-analyst",
      version: 1,
      content: null,
      diff: null,
      changeType: "proposal",
      sourceTaskId: sourceTask6,
      proposalNotificationId: null,
      proposedAdditions:
        "NPS below 30 triggers immediate CSM outreach. Accounts without a workflow by Day 7 are at 82% churn risk — trigger proactive intervention at Day 5.",
      approvedBy: null,
      createdAt: new Date(now - 9 * DAY),
    },
    {
      id: crypto.randomUUID(),
      profileId: "stagent-sample-customer-success-analyst",
      version: 2,
      content:
        "NPS below 30 triggers immediate CSM outreach. Accounts without a workflow by Day 7 are at 82% churn risk — trigger proactive intervention at Day 5.",
      diff: "+ NPS < 30 → immediate CSM outreach.\n+ No workflow by Day 7 → 82% churn risk.\n+ Proactive intervention at Day 5.",
      changeType: "approved",
      sourceTaskId: sourceTask6,
      proposalNotificationId: null,
      proposedAdditions: null,
      approvedBy: "user",
      createdAt: new Date(now - 9 * DAY + 1 * HOUR),
    },

    // Due Diligence profile: proposal → rejected (too broad)
    {
      id: crypto.randomUUID(),
      profileId: "stagent-sample-due-diligence-analyst",
      version: 1,
      content: null,
      diff: null,
      changeType: "proposal",
      sourceTaskId: completedTaskIds[6] ?? null,
      proposalNotificationId: null,
      proposedAdditions:
        "Always include competitor comparison in every analysis, regardless of scope. Default to 5 competitors minimum.",
      approvedBy: null,
      createdAt: new Date(now - 5 * DAY),
    },
    {
      id: crypto.randomUUID(),
      profileId: "stagent-sample-due-diligence-analyst",
      version: 2,
      content: null,
      diff: null,
      changeType: "rejected",
      sourceTaskId: completedTaskIds[6] ?? null,
      proposalNotificationId: null,
      proposedAdditions: null,
      approvedBy: null,
      createdAt: new Date(now - 5 * DAY + 30 * 60_000),
    },

    // General profile: summarization
    {
      id: crypto.randomUUID(),
      profileId: "general",
      version: 1,
      content:
        "User prefers concise bullet-point summaries. When presenting options, use a ranked list with trade-offs. For reports, lead with the executive summary and recommendation before details.",
      diff: null,
      changeType: "summarization",
      sourceTaskId: null,
      proposalNotificationId: null,
      proposedAdditions: null,
      approvedBy: null,
      createdAt: new Date(now - 1 * DAY),
    },
  ];
}
