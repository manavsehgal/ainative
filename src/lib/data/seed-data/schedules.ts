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
  createdAt: Date;
  updatedAt: Date;
}

export function createSchedules(projectIds: string[]): ScheduleSeed[] {
  const now = Date.now();
  const DAY = 86_400_000;
  const HOUR = 3_600_000;
  const [investmentProject, launchProject, leadGenProject, , taxProject] =
    projectIds;

  const weekdayPortfolioCron = "0 9 * * 1-5";
  const dailyLaunchCron = "0 9 * * *";
  const everySixHoursCron = "0 */6 * * *";
  const taxReminderCron = "0 9 * * *";

  return [
    {
      id: crypto.randomUUID(),
      projectId: investmentProject,
      name: "Weekday Portfolio Digest",
      prompt:
        "Before market open, summarize allocation drift, overnight movers, and any watchlist actions for the investment portfolio.",
      cronExpression: weekdayPortfolioCron,
      agentProfile: SAMPLE_PROFILE_IDS[2],
      recurs: true,
      status: "active",
      maxFirings: null,
      firingCount: 0,
      expiresAt: null,
      lastFiredAt: null,
      nextFireAt: computeNextFireTime(weekdayPortfolioCron, new Date(now)),
      createdAt: new Date(now - 10 * DAY),
      updatedAt: new Date(now - 2 * HOUR),
    },
    {
      id: crypto.randomUUID(),
      projectId: launchProject,
      name: "CTA Experiment Check-In",
      prompt:
        "Each morning, compare yesterday's CTA variant performance and suggest the next headline or proof point to test on the landing page.",
      cronExpression: dailyLaunchCron,
      agentProfile: SAMPLE_PROFILE_IDS[1],
      recurs: true,
      status: "paused",
      maxFirings: null,
      firingCount: 0,
      expiresAt: null,
      lastFiredAt: null,
      nextFireAt: null,
      createdAt: new Date(now - 6 * DAY),
      updatedAt: new Date(now - 1 * DAY),
    },
    {
      id: crypto.randomUUID(),
      projectId: leadGenProject,
      name: "Prospect Pipeline Pulse",
      prompt:
        "Every six hours, roll up new prospects, stalled outreach, and reply-rate changes into a short GTM update with owner follow-ups.",
      cronExpression: everySixHoursCron,
      agentProfile: SAMPLE_PROFILE_IDS[0],
      recurs: true,
      status: "active",
      maxFirings: null,
      firingCount: 0,
      expiresAt: null,
      lastFiredAt: null,
      nextFireAt: computeNextFireTime(everySixHoursCron, new Date(now)),
      createdAt: new Date(now - 5 * DAY),
      updatedAt: new Date(now - 90 * 60_000),
    },
    {
      id: crypto.randomUUID(),
      projectId: taxProject,
      name: "Missing Tax Form Reminder",
      prompt:
        "Send a one-time reminder to chase any missing tax documents, update the checklist, and flag anything that could block the CPA handoff.",
      cronExpression: taxReminderCron,
      agentProfile: "project-manager",
      recurs: false,
      status: "expired",
      maxFirings: 1,
      firingCount: 0,
      expiresAt: new Date(now - 1 * DAY),
      lastFiredAt: null,
      nextFireAt: null,
      createdAt: new Date(now - 4 * DAY),
      updatedAt: new Date(now - 1 * DAY),
    },
  ];
}
