export interface ProjectSeed {
  id: string;
  name: string;
  description: string;
  status: "active" | "paused" | "completed";
  createdAt: Date;
  updatedAt: Date;
}

export function createProjects(): ProjectSeed[] {
  const now = Date.now();
  const DAY = 86_400_000;

  return [
    // --- Solo Founder (3 projects) ---
    {
      id: crypto.randomUUID(),
      name: "Product Launch — AI Copilot v2",
      description:
        "Multi-channel launch: landing page, email sequences, social campaigns, PR outreach for the v2 release",
      status: "active",
      createdAt: new Date(now - 21 * DAY),
      updatedAt: new Date(now - 1 * DAY),
    },
    {
      id: crypto.randomUUID(),
      name: "Content Engine",
      description:
        "Weekly SEO articles, LinkedIn posts, and newsletter pipeline with agent-driven research and editorial",
      status: "active",
      createdAt: new Date(now - 18 * DAY),
      updatedAt: new Date(now - 1 * DAY),
    },
    {
      id: crypto.randomUUID(),
      name: "Customer Success Automation",
      description:
        "Onboarding sequences, churn risk detection, NPS monitoring, and support ticket triage",
      status: "active",
      createdAt: new Date(now - 16 * DAY),
      updatedAt: new Date(now - 2 * DAY),
    },

    // --- Agency Owner (3 projects) ---
    {
      id: crypto.randomUUID(),
      name: "Client: TechVenture Partners",
      description:
        "PE portfolio company — due diligence automation, board deck generation, KPI tracking across 4 portcos",
      status: "active",
      createdAt: new Date(now - 14 * DAY),
      updatedAt: new Date(now - 1 * DAY),
    },
    {
      id: crypto.randomUUID(),
      name: "Client: GreenLeaf Commerce",
      description:
        "E-commerce client — product listing optimization, review sentiment monitoring, ad copy rotation",
      status: "active",
      createdAt: new Date(now - 12 * DAY),
      updatedAt: new Date(now - 2 * DAY),
    },
    {
      id: crypto.randomUUID(),
      name: "Client: MedReach Health",
      description:
        "Healthcare marketing — HIPAA-compliant content review, referral campaign automation, provider outreach",
      status: "paused",
      createdAt: new Date(now - 10 * DAY),
      updatedAt: new Date(now - 4 * DAY),
    },

    // --- PE Operating Partner (2 projects) ---
    {
      id: crypto.randomUUID(),
      name: "Revenue Operations Command",
      description:
        "Pipeline forecasting, weekly deal review, rep coaching notes, and operating rhythm automation",
      status: "active",
      createdAt: new Date(now - 8 * DAY),
      updatedAt: new Date(now - 1 * DAY),
    },
    {
      id: crypto.randomUUID(),
      name: "Compliance & Audit Trail",
      description:
        "Governed execution audit, policy drift detection, monthly compliance reports for SOC 2 readiness",
      status: "completed",
      createdAt: new Date(now - 6 * DAY),
      updatedAt: new Date(now - 3 * DAY),
    },
  ];
}
