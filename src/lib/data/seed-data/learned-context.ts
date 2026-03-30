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

  const sourceTask1 = completedTaskIds[0] ?? null;
  const sourceTask2 = completedTaskIds[1] ?? null;

  return [
    // General profile: proposal → approved lifecycle
    {
      id: crypto.randomUUID(),
      profileId: "general",
      version: 1,
      content: null,
      diff: null,
      changeType: "proposal",
      sourceTaskId: sourceTask1,
      proposalNotificationId: null,
      proposedAdditions:
        "User prefers concise bullet-point summaries over paragraph-style output. When multiple options exist, present a ranked list with trade-offs rather than a single recommendation.",
      approvedBy: null,
      createdAt: new Date(now - 5 * DAY),
    },
    {
      id: crypto.randomUUID(),
      profileId: "general",
      version: 2,
      content:
        "User prefers concise bullet-point summaries over paragraph-style output. When multiple options exist, present a ranked list with trade-offs rather than a single recommendation.",
      diff: "+ User prefers concise bullet-point summaries over paragraph-style output.\n+ When multiple options exist, present a ranked list with trade-offs rather than a single recommendation.",
      changeType: "approved",
      sourceTaskId: sourceTask1,
      proposalNotificationId: null,
      proposedAdditions: null,
      approvedBy: "user",
      createdAt: new Date(now - 5 * DAY + 2 * HOUR),
    },
    // Researcher profile: proposal → rejected
    {
      id: crypto.randomUUID(),
      profileId: "researcher",
      version: 1,
      content: null,
      diff: null,
      changeType: "proposal",
      sourceTaskId: sourceTask2,
      proposalNotificationId: null,
      proposedAdditions:
        "Always include academic citation format (APA) for sources. Limit research scope to peer-reviewed journals only.",
      approvedBy: null,
      createdAt: new Date(now - 3 * DAY),
    },
    {
      id: crypto.randomUUID(),
      profileId: "researcher",
      version: 2,
      content: null,
      diff: null,
      changeType: "rejected",
      sourceTaskId: sourceTask2,
      proposalNotificationId: null,
      proposedAdditions: null,
      approvedBy: null,
      createdAt: new Date(now - 3 * DAY + 1 * HOUR),
    },
    // General profile: second proposal (summarization)
    {
      id: crypto.randomUUID(),
      profileId: "general",
      version: 3,
      content:
        "User prefers concise bullet-point summaries over paragraph-style output. When multiple options exist, present a ranked list with trade-offs rather than a single recommendation.",
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
