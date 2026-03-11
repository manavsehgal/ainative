import type { ProfileConfig } from "@/lib/validators/profile";
import {
  createProfile,
  deleteProfile,
  getProfile,
  isBuiltin,
  updateProfile,
} from "@/lib/agents/profiles/registry";

export interface SampleProfileSeed {
  config: ProfileConfig;
  skillMd: string;
}

const SAMPLE_PROFILE_AUTHOR = "Stagent Sample Data";
const SAMPLE_PROFILE_SOURCE = "https://example.com/stagent/sample-data";

export const SAMPLE_PROFILE_IDS = [
  "stagent-sample-revenue-ops-analyst",
  "stagent-sample-launch-copy-chief",
  "stagent-sample-portfolio-coach",
] as const;

export function getSampleProfiles(): SampleProfileSeed[] {
  return [
    {
      config: {
        id: SAMPLE_PROFILE_IDS[0],
        name: "Revenue Operations Analyst",
        version: "1.0.0",
        domain: "work",
        tags: ["pipeline", "forecasting", "sales-ops", "reporting"],
        allowedTools: ["Read", "Write", "Grep", "Bash"],
        canUseToolPolicy: {
          autoApprove: ["Read", "Grep"],
        },
        temperature: 0.3,
        maxTurns: 18,
        outputFormat: "Weekly operating note with metrics, risks, and next actions.",
        author: SAMPLE_PROFILE_AUTHOR,
        source: SAMPLE_PROFILE_SOURCE,
        tests: [
          {
            task: "Summarize weekly pipeline movement and highlight follow-ups.",
            expectedKeywords: ["pipeline", "risks", "next actions"],
          },
        ],
      },
      skillMd: `---
name: Revenue Operations Analyst
description: Turns pipeline changes into a concise operating note for GTM teams.
---

# Revenue Operations Analyst

You review pipeline movement, funnel risk, and rep follow-ups with a bias toward clear operating decisions.

## Default workflow

1. Summarize changes in qualified pipeline, stage movement, and forecast confidence.
2. Call out deals that need executive unblockers or tighter next steps.
3. End with the three highest-leverage actions for this week.
`,
    },
    {
      config: {
        id: SAMPLE_PROFILE_IDS[1],
        name: "Launch Copy Chief",
        version: "1.0.0",
        domain: "work",
        tags: ["copywriting", "launches", "messaging", "experiments"],
        allowedTools: ["Read", "Write", "Grep"],
        canUseToolPolicy: {
          autoApprove: ["Read"],
        },
        temperature: 0.6,
        maxTurns: 16,
        outputFormat: "Experiment summary with winning message angles and next tests.",
        author: SAMPLE_PROFILE_AUTHOR,
        source: SAMPLE_PROFILE_SOURCE,
        tests: [
          {
            task: "Review yesterday's landing page experiment results and propose the next headline test.",
            expectedKeywords: ["headline", "conversion", "next test"],
          },
        ],
      },
      skillMd: `---
name: Launch Copy Chief
description: Refines launch messaging based on conversion signals and customer language.
---

# Launch Copy Chief

You turn campaign performance and research inputs into sharper launch messaging.

## Default workflow

1. Compare message variants against performance data and qualitative feedback.
2. Identify the angle that best fits buyer pain, urgency, and proof.
3. Recommend one next test with a concrete success metric.
`,
    },
    {
      config: {
        id: SAMPLE_PROFILE_IDS[2],
        name: "Portfolio Review Coach",
        version: "1.0.0",
        domain: "personal",
        tags: ["investing", "portfolio", "risk", "habits"],
        allowedTools: ["Read", "Write"],
        temperature: 0.25,
        maxTurns: 14,
        outputFormat: "Short investor brief with posture, risk notes, and watchlist changes.",
        author: SAMPLE_PROFILE_AUTHOR,
        source: SAMPLE_PROFILE_SOURCE,
        tests: [
          {
            task: "Create a weekday digest for a concentrated growth portfolio.",
            expectedKeywords: ["allocation", "risk", "watchlist"],
          },
        ],
      },
      skillMd: `---
name: Portfolio Review Coach
description: Produces disciplined portfolio check-ins focused on risk and watchlist decisions.
---

# Portfolio Review Coach

You write practical investing reviews that stay grounded in allocation, concentration risk, and upcoming watchlist decisions.

## Default workflow

1. Start with what changed in the portfolio and why it matters.
2. Separate signal from noise by focusing on exposure and downside risk.
3. Finish with watchlist actions instead of speculative predictions.
`,
    },
  ];
}

export function upsertSampleProfiles(): number {
  const seeds = getSampleProfiles();

  for (const seed of seeds) {
    const existing = getProfile(seed.config.id);
    if (!existing) {
      createProfile(seed.config, seed.skillMd);
      continue;
    }

    if (isBuiltin(seed.config.id)) {
      throw new Error(`Sample profile id "${seed.config.id}" collides with a built-in profile`);
    }

    updateProfile(seed.config.id, seed.config, seed.skillMd);
  }

  return seeds.length;
}

export function clearSampleProfiles(): number {
  let deleted = 0;

  for (const id of SAMPLE_PROFILE_IDS) {
    const existing = getProfile(id);
    if (!existing || isBuiltin(id)) continue;

    deleteProfile(id);
    deleted++;
  }

  return deleted;
}
