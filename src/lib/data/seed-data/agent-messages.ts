import { SAMPLE_PROFILE_IDS } from "./profiles";

export interface AgentMessageSeed {
  id: string;
  fromProfileId: string;
  toProfileId: string;
  taskId: string | null;
  targetTaskId: string | null;
  subject: string;
  body: string;
  attachments: string | null;
  priority: number;
  status:
    | "pending"
    | "accepted"
    | "in_progress"
    | "completed"
    | "rejected"
    | "expired";
  requiresApproval: boolean;
  approvedBy: string | null;
  parentMessageId: string | null;
  chainDepth: number;
  createdAt: Date;
  respondedAt: Date | null;
  expiresAt: Date | null;
}

/**
 * Seed realistic inter-profile handoffs for the /handoffs approval surface.
 * Covers pending approvals, accepted/in-progress work, completed handoffs,
 * rejections, and expired items to exercise every status in the UI.
 */
export function createAgentMessages(
  completedTaskIds: string[],
  runningTaskIds: string[]
): AgentMessageSeed[] {
  const now = Date.now();
  const DAY = 86_400_000;
  const HOUR = 3_600_000;
  const MIN = 60_000;

  const pickCompleted = (idx: number) =>
    completedTaskIds.length > 0
      ? completedTaskIds[idx % completedTaskIds.length]
      : null;
  const pickRunning = (idx: number) =>
    runningTaskIds.length > 0
      ? runningTaskIds[idx % runningTaskIds.length]
      : null;

  // Parent handoff that will anchor a 2-deep chain
  const parentId = crypto.randomUUID();

  return [
    // ── Pending approvals (require user approval on inbox) ────────────
    {
      id: crypto.randomUUID(),
      fromProfileId: SAMPLE_PROFILE_IDS[0], // GTM
      toProfileId: SAMPLE_PROFILE_IDS[1], // Content
      taskId: pickRunning(0),
      targetTaskId: null,
      subject: "Write launch-day LinkedIn post + engineering blog",
      body:
        "GTM research complete. Need a long-form launch post (1,200 words) emphasizing orchestration + governance angle, plus a 3-tweet thread. Target audience: mid-market ops leaders. Tone: confident, not hype-y. Deadline: before Thursday's Product Hunt launch.",
      attachments: JSON.stringify([
        { type: "document", name: "Competitive Matrix.md" },
        { type: "document", name: "Launch Plan Brief.md" },
      ]),
      priority: 1,
      status: "pending",
      requiresApproval: true,
      approvedBy: null,
      parentMessageId: null,
      chainDepth: 0,
      createdAt: new Date(now - 2 * HOUR),
      respondedAt: null,
      expiresAt: new Date(now + 2 * DAY),
    },
    {
      id: crypto.randomUUID(),
      fromProfileId: "code-reviewer",
      toProfileId: SAMPLE_PROFILE_IDS[0],
      taskId: pickCompleted(0),
      targetTaskId: null,
      subject: "Security review of launch page — redact before publish",
      body:
        "Found 2 hardcoded API keys in the landing page component and one that exposes the internal admin endpoint via a comment. Need GTM to flag which copy can be replaced with public-safe placeholders before Thursday's freeze.",
      attachments: JSON.stringify([
        { type: "file", name: "LandingHero.tsx", line: 34 },
      ]),
      priority: 1,
      status: "pending",
      requiresApproval: true,
      approvedBy: null,
      parentMessageId: null,
      chainDepth: 0,
      createdAt: new Date(now - 45 * MIN),
      respondedAt: null,
      expiresAt: new Date(now + 1 * DAY),
    },

    // ── Accepted (auto-approve — already claimed) ─────────────────────
    {
      id: crypto.randomUUID(),
      fromProfileId: SAMPLE_PROFILE_IDS[4], // RevOps
      toProfileId: SAMPLE_PROFILE_IDS[2], // CS Analyst
      taskId: pickCompleted(1),
      targetTaskId: null,
      subject: "Escalate 3 red-zone accounts from stalled pipeline review",
      body:
        "Three accounts show no activity for 14 days AND a drop in admin-seat logins. Handing to CS for proactive outreach: Meridian Health ($180K ARR), StackMotive ($95K ARR), and Trellis Labs ($62K ARR). Full usage snapshots attached.",
      attachments: JSON.stringify([
        { type: "document", name: "Stalled Accounts Report.md" },
      ]),
      priority: 2,
      status: "accepted",
      requiresApproval: false,
      approvedBy: null,
      parentMessageId: null,
      chainDepth: 0,
      createdAt: new Date(now - 4 * HOUR),
      respondedAt: new Date(now - 4 * HOUR + 30 * MIN),
      expiresAt: null,
    },

    // ── In progress ───────────────────────────────────────────────────
    {
      id: crypto.randomUUID(),
      fromProfileId: "general",
      toProfileId: SAMPLE_PROFILE_IDS[3], // DD Analyst
      taskId: pickCompleted(2),
      targetTaskId: null,
      subject: "Prepare one-page DD memo for HealthScribe acquisition",
      body:
        "Founder requested a go/no-go memo by Monday. Need ARR validation vs deferred revenue, top-3 market risks, and a competitive map. Source docs (data room P&L + customer list) attached.",
      attachments: JSON.stringify([
        { type: "document", name: "HealthScribe P&L FY25.pdf" },
        { type: "document", name: "Customer List Q1.csv" },
      ]),
      priority: 2,
      status: "in_progress",
      requiresApproval: false,
      approvedBy: null,
      parentMessageId: null,
      chainDepth: 0,
      createdAt: new Date(now - 18 * HOUR),
      respondedAt: new Date(now - 17 * HOUR),
      expiresAt: null,
    },

    // ── Parent of a 2-deep chain ──────────────────────────────────────
    {
      id: parentId,
      fromProfileId: SAMPLE_PROFILE_IDS[0],
      toProfileId: SAMPLE_PROFILE_IDS[1],
      taskId: pickCompleted(3),
      targetTaskId: null,
      subject: "Launch-week content calendar — 5 pieces",
      body:
        "Produce 5 pieces: LinkedIn launch post, Twitter thread, founder blog, deep-dive case study, and a newsletter special. Use the approved messaging in the attached brief. Dates: Mon-Fri of launch week.",
      attachments: JSON.stringify([
        { type: "document", name: "Launch Plan Brief.md" },
      ]),
      priority: 2,
      status: "completed",
      requiresApproval: false,
      approvedBy: null,
      parentMessageId: null,
      chainDepth: 0,
      createdAt: new Date(now - 6 * DAY),
      respondedAt: new Date(now - 6 * DAY + 2 * HOUR),
      expiresAt: null,
    },

    // ── Child handoff in chain (chainDepth = 1) ───────────────────────
    {
      id: crypto.randomUUID(),
      fromProfileId: SAMPLE_PROFILE_IDS[1],
      toProfileId: "general",
      taskId: pickCompleted(4),
      targetTaskId: null,
      subject: "Fact-check 3 data points in the pillar post",
      body:
        "Three stats need source validation: (a) '40% higher newsletter signups' benchmark, (b) 'Flesch-Kincaid < 45 increases retention 22%' claim, (c) average SaaS blog ranking in 90 days. Reply with source URL or a 'cannot verify' flag on each.",
      attachments: null,
      priority: 2,
      status: "completed",
      requiresApproval: false,
      approvedBy: null,
      parentMessageId: parentId,
      chainDepth: 1,
      createdAt: new Date(now - 5 * DAY),
      respondedAt: new Date(now - 5 * DAY + 45 * MIN),
      expiresAt: null,
    },

    // ── Completed (standalone) ────────────────────────────────────────
    {
      id: crypto.randomUUID(),
      fromProfileId: SAMPLE_PROFILE_IDS[2],
      toProfileId: SAMPLE_PROFILE_IDS[4],
      taskId: pickCompleted(5),
      targetTaskId: null,
      subject: "Share expansion playbook for 5 green-zone accounts",
      body:
        "Five green-zone accounts hit NDR >125% last quarter. Sharing the playbook we used so RevOps can templatize for top-of-funnel. Summary + 3 case notes in attached doc.",
      attachments: JSON.stringify([
        { type: "document", name: "Expansion Playbook.md" },
      ]),
      priority: 3,
      status: "completed",
      requiresApproval: false,
      approvedBy: "user",
      parentMessageId: null,
      chainDepth: 0,
      createdAt: new Date(now - 9 * DAY),
      respondedAt: new Date(now - 9 * DAY + 3 * HOUR),
      expiresAt: null,
    },

    // ── Rejected ──────────────────────────────────────────────────────
    {
      id: crypto.randomUUID(),
      fromProfileId: SAMPLE_PROFILE_IDS[0],
      toProfileId: SAMPLE_PROFILE_IDS[3],
      taskId: pickCompleted(6),
      targetTaskId: null,
      subject: "Run DD on competitive product (Windsurf)",
      body:
        "Need a competitive DD memo on Windsurf — financials, funding, team growth, churn rumors. Compare to our positioning.",
      attachments: null,
      priority: 3,
      status: "rejected",
      requiresApproval: true,
      approvedBy: null,
      parentMessageId: null,
      chainDepth: 0,
      createdAt: new Date(now - 12 * DAY),
      respondedAt: new Date(now - 12 * DAY + 1 * HOUR),
      expiresAt: null,
    },

    // ── Expired ───────────────────────────────────────────────────────
    {
      id: crypto.randomUUID(),
      fromProfileId: SAMPLE_PROFILE_IDS[4],
      toProfileId: SAMPLE_PROFILE_IDS[2],
      taskId: pickCompleted(7),
      targetTaskId: null,
      subject: "Draft re-engagement sequence for dormant free-tier users",
      body:
        "~2,400 free-tier users have not logged in for 30+ days. Would like a 3-touch re-engagement email sequence. Not urgent — backlog when capacity permits.",
      attachments: null,
      priority: 4,
      status: "expired",
      requiresApproval: true,
      approvedBy: null,
      parentMessageId: null,
      chainDepth: 0,
      createdAt: new Date(now - 20 * DAY),
      respondedAt: null,
      expiresAt: new Date(now - 6 * DAY),
    },
  ];
}
