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
      createdAt: new Date(now - 4 * DAY),
    },
    {
      id: crypto.randomUUID(),
      profileId: "researcher",
      runtimeId: "claude-agent-sdk",
      reportJson: JSON.stringify({
        profileId: "researcher",
        runtimeId: "claude-agent-sdk",
        results: [
          {
            task: "Research recent developments in battery technology",
            passed: true,
            matchedKeywords: ["source", "findings", "citation"],
          },
          {
            task: "Compare three competing frameworks with citations",
            passed: true,
            matchedKeywords: ["comparison", "source", "framework"],
          },
          {
            task: "Fact-check a set of claims and provide references",
            passed: true,
            matchedKeywords: ["verified", "reference", "claim"],
          },
          {
            task: "Synthesize findings from multiple sources into a brief",
            passed: true,
            matchedKeywords: ["synthesis", "sources", "brief"],
          },
        ],
      }),
      totalPassed: 4,
      totalFailed: 0,
      createdAt: new Date(now - 2 * DAY),
    },
  ];
}
