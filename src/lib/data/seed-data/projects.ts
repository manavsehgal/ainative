export interface ProjectSeed {
  id: string;
  name: string;
  description: string;
  status: "active" | "completed";
  createdAt: Date;
  updatedAt: Date;
}

export function createProjects(): ProjectSeed[] {
  const now = Date.now();
  const DAY = 86_400_000;

  return [
    {
      id: crypto.randomUUID(),
      name: "Investment Portfolio Analysis",
      description:
        "Retail investor research — analyze holdings, research ETFs, track performance",
      status: "active",
      createdAt: new Date(now - 14 * DAY),
      updatedAt: new Date(now - 1 * DAY),
    },
    {
      id: crypto.randomUUID(),
      name: "SaaS Landing Page Redesign",
      description:
        "Design and build a high-converting landing page for a B2B SaaS product",
      status: "active",
      createdAt: new Date(now - 12 * DAY),
      updatedAt: new Date(now - 1 * DAY),
    },
    {
      id: crypto.randomUUID(),
      name: "LinkedIn Lead Generation",
      description:
        "Find and qualify decision-makers at target companies via social media",
      status: "active",
      createdAt: new Date(now - 10 * DAY),
      updatedAt: new Date(now - 2 * DAY),
    },
    {
      id: crypto.randomUUID(),
      name: "Q2 Business Trip — NYC",
      description:
        "Plan end-to-end business travel: flights, hotels, meetings, expenses",
      status: "completed",
      createdAt: new Date(now - 8 * DAY),
      updatedAt: new Date(now - 3 * DAY),
    },
    {
      id: crypto.randomUUID(),
      name: "2025 Tax Filing Preparation",
      description:
        "Organize documents, calculate deductions, prepare for CPA review",
      status: "active",
      createdAt: new Date(now - 6 * DAY),
      updatedAt: new Date(now - 1 * DAY),
    },
  ];
}
