export interface RepoImportSeed {
  id: string;
  repoUrl: string;
  repoOwner: string;
  repoName: string;
  branch: string;
  commitSha: string;
  profileIds: string;
  skillCount: number;
  lastCheckedAt: Date | null;
  createdAt: Date;
}

export function createRepoImports(): RepoImportSeed[] {
  const now = Date.now();
  const DAY = 86_400_000;

  return [
    {
      id: crypto.randomUUID(),
      repoUrl: "https://github.com/stagent-community/marketing-agents",
      repoOwner: "stagent-community",
      repoName: "marketing-agents",
      branch: "main",
      commitSha: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
      profileIds: JSON.stringify([
        "ext-seo-content-writer",
        "ext-social-media-scheduler",
        "ext-email-campaign-manager",
      ]),
      skillCount: 3,
      lastCheckedAt: new Date(now - 2 * DAY),
      createdAt: new Date(now - 21 * DAY),
    },
    {
      id: crypto.randomUUID(),
      repoUrl: "https://github.com/stagent-community/sales-ops-agents",
      repoOwner: "stagent-community",
      repoName: "sales-ops-agents",
      branch: "main",
      commitSha: "f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5",
      profileIds: JSON.stringify([
        "ext-pipeline-analyst",
        "ext-deal-coach",
      ]),
      skillCount: 2,
      lastCheckedAt: new Date(now - 3 * DAY),
      createdAt: new Date(now - 14 * DAY),
    },
    {
      id: crypto.randomUUID(),
      repoUrl: "https://github.com/stagent-community/compliance-agents",
      repoOwner: "stagent-community",
      repoName: "compliance-agents",
      branch: "main",
      commitSha: "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
      profileIds: JSON.stringify([
        "ext-hipaa-reviewer",
        "ext-soc2-auditor",
      ]),
      skillCount: 2,
      lastCheckedAt: new Date(now - 5 * DAY),
      createdAt: new Date(now - 10 * DAY),
    },
  ];
}
