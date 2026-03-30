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
      repoUrl: "https://github.com/example/agent-skills-library",
      repoOwner: "example",
      repoName: "agent-skills-library",
      branch: "main",
      commitSha: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
      profileIds: JSON.stringify([
        "ext-data-pipeline-analyst",
        "ext-customer-success-agent",
        "ext-incident-responder",
      ]),
      skillCount: 3,
      lastCheckedAt: new Date(now - 2 * DAY),
      createdAt: new Date(now - 14 * DAY),
    },
    {
      id: crypto.randomUUID(),
      repoUrl: "https://github.com/example/marketing-agents",
      repoOwner: "example",
      repoName: "marketing-agents",
      branch: "main",
      commitSha: "f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5",
      profileIds: JSON.stringify([
        "ext-seo-content-writer",
        "ext-social-media-scheduler",
      ]),
      skillCount: 2,
      lastCheckedAt: new Date(now - 5 * DAY),
      createdAt: new Date(now - 21 * DAY),
    },
  ];
}
