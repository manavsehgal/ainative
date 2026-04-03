import { computeNextFireTime } from "@/lib/schedules/interval-parser";
import { SAMPLE_PROFILE_IDS } from "./profiles";

export interface ScheduleSeed {
  id: string;
  projectId: string;
  name: string;
  prompt: string;
  cronExpression: string;
  agentProfile: string | null;
  recurs: boolean;
  status: "active" | "paused" | "expired";
  maxFirings: number | null;
  firingCount: number;
  expiresAt: Date | null;
  lastFiredAt: Date | null;
  nextFireAt: Date | null;
  type: "scheduled" | "heartbeat";
  heartbeatChecklist: string | null;
  activeHoursStart: number | null;
  activeHoursEnd: number | null;
  activeTimezone: string | null;
  deliveryChannels: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function createSchedules(projectIds: string[]): ScheduleSeed[] {
  const now = Date.now();
  const DAY = 86_400_000;
  const HOUR = 3_600_000;
  const [
    launchProject,
    contentProject,
    csProject,
    tvpProject,
    greenleafProject,
    medreachProject,
    revopsProject,
    complianceProject,
  ] = projectIds;

  const daily8am = "0 8 * * *";
  const mwf9am = "0 9 * * 1,3,5";
  const every6h = "0 */6 * * *";
  const weeklyMon7am = "0 7 * * 1";
  const every4h = "0 */4 * * *";
  const daily6am = "0 6 * * *";
  const every8h = "0 */8 * * *";
  const monthly1st = "0 9 1 * *";

  return [
    // 1. Launch Metrics Digest — daily, Slack delivery
    {
      id: crypto.randomUUID(),
      projectId: launchProject,
      name: "Launch Metrics Digest",
      prompt:
        "Pull yesterday's launch metrics: landing page visits, signup conversions, email open rates, and social engagement. Highlight any metric that moved >10% and flag channels underperforming targets.",
      cronExpression: daily8am,
      agentProfile: SAMPLE_PROFILE_IDS[0], // GTM Launch Strategist
      recurs: true,
      status: "active",
      maxFirings: null,
      firingCount: 12,
      expiresAt: null,
      lastFiredAt: new Date(now - 16 * HOUR),
      nextFireAt: computeNextFireTime(daily8am, new Date(now)),
      type: "scheduled",
      heartbeatChecklist: null,
      activeHoursStart: null,
      activeHoursEnd: null,
      activeTimezone: null,
      deliveryChannels: JSON.stringify(["slack"]),
      createdAt: new Date(now - 18 * DAY),
      updatedAt: new Date(now - 1 * HOUR),
    },

    // 2. Content Calendar Check-In — MWF, Content Editor
    {
      id: crypto.randomUUID(),
      projectId: contentProject,
      name: "Content Calendar Check-In",
      prompt:
        "Review the editorial calendar for this week. Confirm articles in progress have outlines approved, flag any pieces behind schedule, and suggest topic swaps if a trending topic emerged overnight.",
      cronExpression: mwf9am,
      agentProfile: SAMPLE_PROFILE_IDS[1], // Content Production Editor
      recurs: true,
      status: "active",
      maxFirings: null,
      firingCount: 8,
      expiresAt: null,
      lastFiredAt: new Date(now - 2 * DAY),
      nextFireAt: computeNextFireTime(mwf9am, new Date(now)),
      type: "scheduled",
      heartbeatChecklist: null,
      activeHoursStart: null,
      activeHoursEnd: null,
      activeTimezone: null,
      deliveryChannels: null,
      createdAt: new Date(now - 15 * DAY),
      updatedAt: new Date(now - 2 * DAY),
    },

    // 3. Churn Risk Heartbeat — intelligence-driven, every 6h
    {
      id: crypto.randomUUID(),
      projectId: csProject,
      name: "Churn Risk Heartbeat",
      prompt:
        "Evaluate the customer health checklist. Only take action if a signal fires — otherwise suppress and log. When action is needed, draft the intervention and notify via Slack and email.",
      cronExpression: every6h,
      agentProfile: SAMPLE_PROFILE_IDS[2], // Customer Success Analyst
      recurs: true,
      status: "active",
      maxFirings: null,
      firingCount: 22,
      expiresAt: null,
      lastFiredAt: new Date(now - 4 * HOUR),
      nextFireAt: computeNextFireTime(every6h, new Date(now)),
      type: "heartbeat",
      heartbeatChecklist: JSON.stringify([
        "Any account NPS dropped below 30?",
        "Any account usage declined >40% week-over-week?",
        "Any account filed >3 support tickets this week?",
        "Any enterprise renewal within 60 days with no CSM touchpoint?",
      ]),
      activeHoursStart: 8,
      activeHoursEnd: 20,
      activeTimezone: "America/Los_Angeles",
      deliveryChannels: JSON.stringify(["slack", "email"]),
      createdAt: new Date(now - 14 * DAY),
      updatedAt: new Date(now - 4 * HOUR),
    },

    // 4. Portfolio KPI Tracker — weekly Monday 7am
    {
      id: crypto.randomUUID(),
      projectId: tvpProject,
      name: "Portfolio KPI Tracker",
      prompt:
        "Pull the weekly KPI snapshot for all 4 portfolio companies: MRR, burn rate, net retention, and headcount. Flag any company with MRR growth <5% or burn rate acceleration >15%. Format as a board-ready summary.",
      cronExpression: weeklyMon7am,
      agentProfile: SAMPLE_PROFILE_IDS[3], // Due Diligence Analyst
      recurs: true,
      status: "active",
      maxFirings: null,
      firingCount: 3,
      expiresAt: null,
      lastFiredAt: new Date(now - 5 * DAY),
      nextFireAt: computeNextFireTime(weeklyMon7am, new Date(now)),
      type: "scheduled",
      heartbeatChecklist: null,
      activeHoursStart: null,
      activeHoursEnd: null,
      activeTimezone: null,
      deliveryChannels: JSON.stringify(["slack"]),
      createdAt: new Date(now - 12 * DAY),
      updatedAt: new Date(now - 5 * DAY),
    },

    // 5. Review Sentiment Heartbeat — every 4h, e-commerce monitoring
    {
      id: crypto.randomUUID(),
      projectId: greenleafProject,
      name: "Review Sentiment Heartbeat",
      prompt:
        "Check the product review feeds for new negative reviews, competitor price changes, and inventory alerts. Only act when a signal fires — draft a response template for 1-2 star reviews and alert the client.",
      cronExpression: every4h,
      agentProfile: "general",
      recurs: true,
      status: "active",
      maxFirings: null,
      firingCount: 35,
      expiresAt: null,
      lastFiredAt: new Date(now - 2 * HOUR),
      nextFireAt: computeNextFireTime(every4h, new Date(now)),
      type: "heartbeat",
      heartbeatChecklist: JSON.stringify([
        "New 1-star or 2-star product review?",
        "Competitor price drop >10% on a tracked SKU?",
        "Inventory below reorder threshold for top 10 SKUs?",
      ]),
      activeHoursStart: 6,
      activeHoursEnd: 22,
      activeTimezone: "America/New_York",
      deliveryChannels: null,
      createdAt: new Date(now - 10 * DAY),
      updatedAt: new Date(now - 2 * HOUR),
    },

    // 6. Compliance Scan — daily 6am, paused (client paused)
    {
      id: crypto.randomUUID(),
      projectId: medreachProject,
      name: "HIPAA Compliance Scan",
      prompt:
        "Scan all pending marketing content for HIPAA violations, unsubstantiated health claims, and missing disclaimers. Generate a compliance scorecard and route flagged items to legal.",
      cronExpression: daily6am,
      agentProfile: "general",
      recurs: true,
      status: "paused",
      maxFirings: null,
      firingCount: 6,
      expiresAt: null,
      lastFiredAt: new Date(now - 5 * DAY),
      nextFireAt: null,
      type: "scheduled",
      heartbeatChecklist: null,
      activeHoursStart: null,
      activeHoursEnd: null,
      activeTimezone: null,
      deliveryChannels: JSON.stringify(["email"]),
      createdAt: new Date(now - 9 * DAY),
      updatedAt: new Date(now - 4 * DAY),
    },

    // 7. Deal Stall Heartbeat — every 8h, RevOps
    {
      id: crypto.randomUUID(),
      projectId: revopsProject,
      name: "Deal Stall Heartbeat",
      prompt:
        "Evaluate stalled deal checklist. When a signal fires, draft a coaching note for the rep and suggest a specific unblocking action. Deliver via Slack to the #revenue-ops channel.",
      cronExpression: every8h,
      agentProfile: SAMPLE_PROFILE_IDS[4], // Revenue Ops Analyst
      recurs: true,
      status: "active",
      maxFirings: null,
      firingCount: 14,
      expiresAt: null,
      lastFiredAt: new Date(now - 6 * HOUR),
      nextFireAt: computeNextFireTime(every8h, new Date(now)),
      type: "heartbeat",
      heartbeatChecklist: JSON.stringify([
        "Any deal stalled >5 business days with no activity?",
        "Any deal missing a defined next step?",
        "Any champion gone dark (no email open in 7 days)?",
        "Any deal pushed close date more than twice?",
      ]),
      activeHoursStart: 7,
      activeHoursEnd: 19,
      activeTimezone: "America/Chicago",
      deliveryChannels: JSON.stringify(["slack"]),
      createdAt: new Date(now - 7 * DAY),
      updatedAt: new Date(now - 6 * HOUR),
    },

    // 8. Monthly Audit Run — 1st of month, expired
    {
      id: crypto.randomUUID(),
      projectId: complianceProject,
      name: "Monthly Compliance Audit",
      prompt:
        "Run the full monthly compliance audit: gather execution logs, analyze against SOC 2 controls, generate the report, and prepare the executive brief. Deliver to the compliance-reviews channel.",
      cronExpression: monthly1st,
      agentProfile: "general",
      recurs: false,
      status: "expired",
      maxFirings: 1,
      firingCount: 1,
      expiresAt: new Date(now - 1 * DAY),
      lastFiredAt: new Date(now - 3 * DAY),
      nextFireAt: null,
      type: "scheduled",
      heartbeatChecklist: null,
      activeHoursStart: null,
      activeHoursEnd: null,
      activeTimezone: null,
      deliveryChannels: JSON.stringify(["slack", "email"]),
      createdAt: new Date(now - 5 * DAY),
      updatedAt: new Date(now - 1 * DAY),
    },
  ];
}
