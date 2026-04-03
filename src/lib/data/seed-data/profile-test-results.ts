import { SAMPLE_PROFILE_IDS } from "./profiles";

export interface ProfileTestResultSeed {
  id: string;
  profileId: string;
  runtimeId: string;
  reportJson: string;
  totalPassed: number;
  totalFailed: number;
  createdAt: Date;
}

export function createProfileTestResults(): ProfileTestResultSeed[] {
  const now = Date.now();
  const DAY = 86_400_000;

  return [
    {
      id: crypto.randomUUID(),
      profileId: "general",
      runtimeId: "claude-agent-sdk",
      reportJson: JSON.stringify({
        profileId: "general",
        runtimeId: "claude-agent-sdk",
        results: [
          {
            task: "Summarize a short article into three key takeaways",
            passed: true,
            matchedKeywords: ["takeaway", "summary", "key"],
          },
          {
            task: "Draft a project status update from raw task data",
            passed: true,
            matchedKeywords: ["status", "progress", "next steps"],
          },
          {
            task: "Compare two approaches and recommend one",
            passed: true,
            matchedKeywords: ["trade-off", "recommend", "approach"],
          },
          {
            task: "Create a checklist from unstructured meeting notes",
            passed: true,
            matchedKeywords: ["checklist", "action", "owner"],
          },
          {
            task: "Explain a technical concept for a non-technical audience",
            passed: true,
            matchedKeywords: ["analogy", "plain language"],
          },
          {
            task: "Generate a risk assessment for a proposed change",
            passed: false,
            matchedKeywords: ["risk"],
            missingKeywords: ["mitigation", "likelihood"],
          },
        ],
      }),
      totalPassed: 5,
      totalFailed: 1,
      createdAt: new Date(now - 8 * DAY),
    },
    {
      id: crypto.randomUUID(),
      profileId: SAMPLE_PROFILE_IDS[0], // GTM Launch Strategist
      runtimeId: "claude-agent-sdk",
      reportJson: JSON.stringify({
        profileId: SAMPLE_PROFILE_IDS[0],
        runtimeId: "claude-agent-sdk",
        results: [
          {
            task: "Draft a launch plan for a B2B SaaS feature release targeting mid-market ops teams",
            passed: true,
            matchedKeywords: ["positioning", "channels", "timeline", "metrics"],
          },
          {
            task: "Compare two headline variants and recommend which to A/B test first",
            passed: true,
            matchedKeywords: ["headline", "conversion", "test"],
          },
          {
            task: "Write a 3-touch email sequence for a product launch",
            passed: true,
            matchedKeywords: ["email", "sequence", "CTA"],
          },
          {
            task: "Analyze competitor positioning and identify messaging gaps",
            passed: true,
            matchedKeywords: ["competitor", "gap", "positioning"],
          },
          {
            task: "Create a social media launch calendar with channel-specific hooks",
            passed: false,
            matchedKeywords: ["social", "calendar"],
            missingKeywords: ["hook", "channel-specific"],
          },
        ],
      }),
      totalPassed: 4,
      totalFailed: 1,
      createdAt: new Date(now - 6 * DAY),
    },
    {
      id: crypto.randomUUID(),
      profileId: SAMPLE_PROFILE_IDS[1], // Content Production Editor
      runtimeId: "claude-agent-sdk",
      reportJson: JSON.stringify({
        profileId: SAMPLE_PROFILE_IDS[1],
        runtimeId: "claude-agent-sdk",
        results: [
          {
            task: "Write an SEO-optimized article outline for 'AI agent orchestration for small teams'",
            passed: true,
            matchedKeywords: ["keyword", "outline", "heading", "SEO"],
          },
          {
            task: "Create a distribution plan for a published blog post",
            passed: true,
            matchedKeywords: ["LinkedIn", "newsletter", "distribution"],
          },
          {
            task: "Research keyword clusters for a new topic area",
            passed: true,
            matchedKeywords: ["keyword", "volume", "difficulty"],
          },
          {
            task: "Edit an article draft for brand voice consistency",
            passed: true,
            matchedKeywords: ["voice", "consistency", "edit"],
          },
        ],
      }),
      totalPassed: 4,
      totalFailed: 0,
      createdAt: new Date(now - 4 * DAY),
    },
    {
      id: crypto.randomUUID(),
      profileId: SAMPLE_PROFILE_IDS[4], // Revenue Operations Analyst
      runtimeId: "claude-agent-sdk",
      reportJson: JSON.stringify({
        profileId: SAMPLE_PROFILE_IDS[4],
        runtimeId: "claude-agent-sdk",
        results: [
          {
            task: "Summarize weekly pipeline movement and highlight stalled deals",
            passed: true,
            matchedKeywords: ["pipeline", "stalled", "forecast"],
          },
          {
            task: "Generate coaching notes for sales reps based on deal patterns",
            passed: true,
            matchedKeywords: ["coaching", "rep", "deal"],
          },
          {
            task: "Calculate forecast confidence by pipeline stage",
            passed: true,
            matchedKeywords: ["forecast", "confidence", "committed"],
          },
          {
            task: "Identify deals at risk of slipping from the current quarter",
            passed: true,
            matchedKeywords: ["risk", "slipping", "quarter"],
          },
          {
            task: "Write an executive operating note with top 3 actions",
            passed: true,
            matchedKeywords: ["executive", "actions", "operating"],
          },
        ],
      }),
      totalPassed: 5,
      totalFailed: 0,
      createdAt: new Date(now - 2 * DAY),
    },
  ];
}
