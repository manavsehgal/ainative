import { SAMPLE_PROFILE_IDS } from "./profiles";

export interface AgentMemorySeed {
  id: string;
  profileId: string;
  category: "fact" | "preference" | "pattern" | "outcome";
  content: string;
  confidence: number; // 0-1000 scale
  sourceTaskId: string | null;
  tags: string; // JSON array
  lastAccessedAt: Date | null;
  accessCount: number;
  decayRate: number; // per-day thousandths
  status: "active" | "decayed" | "archived" | "rejected";
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Seed realistic agent memory entries across all four categories
 * (fact / preference / pattern / outcome) for several sample profiles.
 * Gives /api/memory, profile detail, and memory browser non-empty UI.
 */
export function createAgentMemory(
  completedTaskIds: string[]
): AgentMemorySeed[] {
  const now = Date.now();
  const DAY = 86_400_000;
  const HOUR = 3_600_000;
  const pickTask = (idx: number) =>
    completedTaskIds.length > 0
      ? completedTaskIds[idx % completedTaskIds.length]
      : null;

  return [
    // ── GTM Launch Strategist (facts + preferences + outcomes) ─────────
    {
      id: crypto.randomUUID(),
      profileId: SAMPLE_PROFILE_IDS[0],
      category: "fact",
      content:
        "Target ICP for launches is mid-market ops teams (50-500 employees, $10M-$500M revenue, Series B-D).",
      confidence: 920,
      sourceTaskId: pickTask(0),
      tags: JSON.stringify(["ICP", "positioning", "audience"]),
      lastAccessedAt: new Date(now - 6 * HOUR),
      accessCount: 14,
      decayRate: 5,
      status: "active",
      createdAt: new Date(now - 18 * DAY),
      updatedAt: new Date(now - 2 * DAY),
    },
    {
      id: crypto.randomUUID(),
      profileId: SAMPLE_PROFILE_IDS[0],
      category: "preference",
      content:
        "Prefer pain-led headlines over feature-led on cold traffic; use orchestration-led copy for return visitors.",
      confidence: 860,
      sourceTaskId: pickTask(1),
      tags: JSON.stringify(["headlines", "messaging", "conversion"]),
      lastAccessedAt: new Date(now - 12 * HOUR),
      accessCount: 9,
      decayRate: 10,
      status: "active",
      createdAt: new Date(now - 14 * DAY),
      updatedAt: new Date(now - 1 * DAY),
    },
    {
      id: crypto.randomUUID(),
      profileId: SAMPLE_PROFILE_IDS[0],
      category: "outcome",
      content:
        "Product Hunt launch produced 342 signups with #3 rank; Twitter thread outperformed LinkedIn 3:1 on impressions but 0.6:1 on signups.",
      confidence: 780,
      sourceTaskId: pickTask(2),
      tags: JSON.stringify(["launch", "channel-performance", "PH", "Twitter"]),
      lastAccessedAt: new Date(now - 1 * DAY),
      accessCount: 6,
      decayRate: 15,
      status: "active",
      createdAt: new Date(now - 9 * DAY),
      updatedAt: new Date(now - 1 * DAY),
    },
    {
      id: crypto.randomUUID(),
      profileId: SAMPLE_PROFILE_IDS[0],
      category: "pattern",
      content:
        "When CTR on hero CTAs drops below 2.5%, test loss-framed copy before pausing the channel — recovery rate is ~65%.",
      confidence: 710,
      sourceTaskId: pickTask(3),
      tags: JSON.stringify(["CTA", "optimization", "testing"]),
      lastAccessedAt: new Date(now - 2 * DAY),
      accessCount: 4,
      decayRate: 12,
      status: "active",
      createdAt: new Date(now - 7 * DAY),
      updatedAt: new Date(now - 2 * DAY),
    },

    // ── Content Production Editor ─────────────────────────────────────
    {
      id: crypto.randomUUID(),
      profileId: SAMPLE_PROFILE_IDS[1],
      category: "fact",
      content:
        "House style enforces Flesch-Kincaid <45, active voice, 1,800-2,000 word pillar articles, H2-every-400-words.",
      confidence: 940,
      sourceTaskId: pickTask(4),
      tags: JSON.stringify(["style-guide", "SEO", "editorial"]),
      lastAccessedAt: new Date(now - 3 * HOUR),
      accessCount: 22,
      decayRate: 3,
      status: "active",
      createdAt: new Date(now - 20 * DAY),
      updatedAt: new Date(now - 1 * DAY),
    },
    {
      id: crypto.randomUUID(),
      profileId: SAMPLE_PROFILE_IDS[1],
      category: "preference",
      content:
        "Prefer 3-citation minimum on any technical claim; link to primary sources before blog posts; no quote-marked statistics.",
      confidence: 880,
      sourceTaskId: pickTask(5),
      tags: JSON.stringify(["citations", "accuracy", "brand-voice"]),
      lastAccessedAt: new Date(now - 8 * HOUR),
      accessCount: 11,
      decayRate: 8,
      status: "active",
      createdAt: new Date(now - 12 * DAY),
      updatedAt: new Date(now - 2 * DAY),
    },
    {
      id: crypto.randomUUID(),
      profileId: SAMPLE_PROFILE_IDS[1],
      category: "pattern",
      content:
        "Posts with a concrete checklist in the first 300 words get ~40% more newsletter subscribes than narrative intros.",
      confidence: 740,
      sourceTaskId: pickTask(6),
      tags: JSON.stringify(["newsletter", "conversion", "structure"]),
      lastAccessedAt: new Date(now - 18 * HOUR),
      accessCount: 8,
      decayRate: 10,
      status: "active",
      createdAt: new Date(now - 10 * DAY),
      updatedAt: new Date(now - 1 * DAY),
    },

    // ── Customer Success Analyst ──────────────────────────────────────
    {
      id: crypto.randomUUID(),
      profileId: SAMPLE_PROFILE_IDS[2],
      category: "fact",
      content:
        "Red accounts are defined as: 3+ consecutive weeks of declining DAU OR NPS <5 OR >2 executive escalations per quarter.",
      confidence: 900,
      sourceTaskId: pickTask(7),
      tags: JSON.stringify(["churn", "scoring", "definitions"]),
      lastAccessedAt: new Date(now - 4 * HOUR),
      accessCount: 16,
      decayRate: 4,
      status: "active",
      createdAt: new Date(now - 16 * DAY),
      updatedAt: new Date(now - 2 * DAY),
    },
    {
      id: crypto.randomUUID(),
      profileId: SAMPLE_PROFILE_IDS[2],
      category: "outcome",
      content:
        "Quarterly business review cadence reduced churn from 4.8% to 2.1% on accounts >$50K ARR over two quarters.",
      confidence: 820,
      sourceTaskId: pickTask(8),
      tags: JSON.stringify(["QBR", "retention", "ARR"]),
      lastAccessedAt: new Date(now - 2 * DAY),
      accessCount: 5,
      decayRate: 12,
      status: "active",
      createdAt: new Date(now - 11 * DAY),
      updatedAt: new Date(now - 2 * DAY),
    },
    {
      id: crypto.randomUUID(),
      profileId: SAMPLE_PROFILE_IDS[2],
      category: "pattern",
      content:
        "Support ticket spikes 14 days before churn in 60% of cases; earliest lead indicator is a drop in admin-seat logins.",
      confidence: 760,
      sourceTaskId: pickTask(9),
      tags: JSON.stringify(["churn-signal", "early-warning", "telemetry"]),
      lastAccessedAt: new Date(now - 1 * DAY),
      accessCount: 7,
      decayRate: 10,
      status: "active",
      createdAt: new Date(now - 8 * DAY),
      updatedAt: new Date(now - 1 * DAY),
    },

    // ── Portfolio Due Diligence Analyst ───────────────────────────────
    {
      id: crypto.randomUUID(),
      profileId: SAMPLE_PROFILE_IDS[3],
      category: "fact",
      content:
        "TechVenture's investment thesis focuses on vertical SaaS with $10M-$50M ARR, >110% NDR, and <18-month payback.",
      confidence: 950,
      sourceTaskId: pickTask(10),
      tags: JSON.stringify(["investment-thesis", "PE", "vertical-SaaS"]),
      lastAccessedAt: new Date(now - 5 * HOUR),
      accessCount: 19,
      decayRate: 3,
      status: "active",
      createdAt: new Date(now - 13 * DAY),
      updatedAt: new Date(now - 1 * DAY),
    },
    {
      id: crypto.randomUUID(),
      profileId: SAMPLE_PROFILE_IDS[3],
      category: "preference",
      content:
        "Always cross-check ARR with deferred revenue on balance sheet; flag >10% divergence for analyst review before including in memo.",
      confidence: 890,
      sourceTaskId: pickTask(11),
      tags: JSON.stringify(["due-diligence", "financials", "validation"]),
      lastAccessedAt: new Date(now - 1 * DAY),
      accessCount: 12,
      decayRate: 6,
      status: "active",
      createdAt: new Date(now - 9 * DAY),
      updatedAt: new Date(now - 1 * DAY),
    },

    // ── Revenue Operations Analyst ────────────────────────────────────
    {
      id: crypto.randomUUID(),
      profileId: SAMPLE_PROFILE_IDS[4],
      category: "fact",
      content:
        "Stalled deal = 5+ days since last activity + no scheduled next step. Auto-escalate to AE's manager after 7 days.",
      confidence: 910,
      sourceTaskId: pickTask(12),
      tags: JSON.stringify(["pipeline", "definitions", "escalation"]),
      lastAccessedAt: new Date(now - 2 * HOUR),
      accessCount: 24,
      decayRate: 2,
      status: "active",
      createdAt: new Date(now - 15 * DAY),
      updatedAt: new Date(now - 1 * DAY),
    },
    {
      id: crypto.randomUUID(),
      profileId: SAMPLE_PROFILE_IDS[4],
      category: "pattern",
      content:
        "Deals that skip the demo-to-pilot transition convert at 22% vs 58% for deals that do — prioritize reps with low transition rates for coaching.",
      confidence: 800,
      sourceTaskId: pickTask(13),
      tags: JSON.stringify(["conversion", "coaching", "pipeline"]),
      lastAccessedAt: new Date(now - 4 * HOUR),
      accessCount: 13,
      decayRate: 8,
      status: "active",
      createdAt: new Date(now - 11 * DAY),
      updatedAt: new Date(now - 1 * DAY),
    },
    {
      id: crypto.randomUUID(),
      profileId: SAMPLE_PROFILE_IDS[4],
      category: "outcome",
      content:
        "Weekly rep coaching notes reduced forecast variance from ±18% to ±7% over 6 weeks without changing forecast methodology.",
      confidence: 850,
      sourceTaskId: pickTask(14),
      tags: JSON.stringify(["forecast-accuracy", "coaching", "metrics"]),
      lastAccessedAt: new Date(now - 1 * DAY),
      accessCount: 8,
      decayRate: 10,
      status: "active",
      createdAt: new Date(now - 7 * DAY),
      updatedAt: new Date(now - 1 * DAY),
    },

    // ── Decayed + archived samples (show decay lifecycle) ─────────────
    {
      id: crypto.randomUUID(),
      profileId: SAMPLE_PROFILE_IDS[0],
      category: "fact",
      content:
        "Legacy launch channel list included Reddit r/SaaS — removed after engagement fell below 0.5% in Q4 2025.",
      confidence: 320,
      sourceTaskId: null,
      tags: JSON.stringify(["deprecated", "reddit", "legacy"]),
      lastAccessedAt: new Date(now - 45 * DAY),
      accessCount: 2,
      decayRate: 20,
      status: "archived",
      createdAt: new Date(now - 60 * DAY),
      updatedAt: new Date(now - 30 * DAY),
    },
    {
      id: crypto.randomUUID(),
      profileId: SAMPLE_PROFILE_IDS[1],
      category: "preference",
      content:
        "Preference to use Medium as syndication platform — superseded by Substack after reach metrics dropped.",
      confidence: 280,
      sourceTaskId: null,
      tags: JSON.stringify(["syndication", "deprecated"]),
      lastAccessedAt: new Date(now - 30 * DAY),
      accessCount: 1,
      decayRate: 25,
      status: "decayed",
      createdAt: new Date(now - 40 * DAY),
      updatedAt: new Date(now - 20 * DAY),
    },
  ];
}
