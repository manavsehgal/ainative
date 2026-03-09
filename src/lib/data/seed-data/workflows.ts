import type { WorkflowDefinition } from "@/lib/workflows/types";

export interface WorkflowSeed {
  id: string;
  projectId: string;
  name: string;
  definition: string;
  status: "draft" | "active" | "paused" | "completed";
  createdAt: Date;
  updatedAt: Date;
}

export function createWorkflows(projectIds: string[]): WorkflowSeed[] {
  const now = Date.now();
  const DAY = 86_400_000;
  const [p1, p2, p3, p4, p5] = projectIds;

  const portfolioRebalance: WorkflowDefinition = {
    pattern: "sequence",
    steps: [
      {
        id: "analyze",
        name: "Analyze current allocation",
        prompt:
          "Read the portfolio holdings CSV and calculate current sector weights, position sizes, and concentration risks. Output a summary table.",
      },
      {
        id: "compare",
        name: "Compare to target allocation",
        prompt:
          "Compare current allocation against the target: Tech ≤35%, Healthcare 15-20%, Finance 15-20%, Consumer 10-15%, Energy 5-10%, Cash 5%. Identify overweight and underweight sectors.",
      },
      {
        id: "recommend",
        name: "Generate trade recommendations",
        prompt:
          "Based on the allocation gaps, recommend specific trades (buy/sell/trim) to rebalance. Minimize transaction count and tax impact. Output as a trade list.",
      },
    ],
  };

  const landingPageBuild: WorkflowDefinition = {
    pattern: "checkpoint",
    steps: [
      {
        id: "research",
        name: "Research & competitive analysis",
        prompt:
          "Audit 4 competitor landing pages (Notion, Linear, Vercel, Stripe). Document design patterns, CTAs, messaging, and identify gaps we can exploit.",
      },
      {
        id: "copy",
        name: "Write copy variants",
        prompt:
          "Using competitive insights, write 3 hero headline variants with supporting copy. Follow the design brief brand voice. Include CTA text.",
        requiresApproval: true,
      },
      {
        id: "build",
        name: "Build responsive hero",
        prompt:
          "Implement the approved hero section as a responsive React component using Tailwind CSS. Include animations, responsive breakpoints, and dark mode.",
        requiresApproval: true,
      },
      {
        id: "test",
        name: "Set up A/B test",
        prompt:
          "Configure A/B test infrastructure for the top 2 hero variants. Set up event tracking for CTA clicks, scroll depth, and time on page.",
      },
    ],
  };

  const leadGenPipeline: WorkflowDefinition = {
    pattern: "planner-executor",
    steps: [
      {
        id: "plan",
        name: "Plan outreach campaign",
        prompt:
          "Given 15 qualified prospects across 8 companies, create a campaign plan: segment prospects by company size and role, assign email templates, set send schedule (stagger across 2 weeks), and define success metrics.",
      },
      {
        id: "personalize",
        name: "Personalize email sequences",
        prompt:
          "For each prospect, fill in personalization tokens in the assigned template: company name, recent events (from LinkedIn/Crunchbase), team size, similar customer references. Output ready-to-send emails.",
      },
      {
        id: "enrich",
        name: "Enrich with company data",
        prompt:
          "For each prospect company, pull: funding stage, employee count, tech stack (from job postings), recent news. Append to prospect records.",
      },
      {
        id: "schedule",
        name: "Schedule and send",
        prompt:
          "Schedule all personalized emails according to the campaign plan. Send Day 1 emails immediately, queue follow-ups at 3-day and 7-day intervals.",
      },
    ],
  };

  const tripPlanning: WorkflowDefinition = {
    pattern: "sequence",
    steps: [
      {
        id: "flights",
        name: "Book flights",
        prompt:
          "Search for round-trip flights SFO→JFK departing March 15 AM, returning March 18 PM. Prefer United (status match). Budget: $700 max. Book Economy Plus with aisle seats.",
      },
      {
        id: "hotel",
        name: "Reserve hotel",
        prompt:
          "Book hotel in Midtown Manhattan for 3 nights (Mar 15-18). Requirements: walking distance to Javits Center, standard king room, free cancellation. Budget: $300/night max.",
      },
      {
        id: "itinerary",
        name: "Create itinerary",
        prompt:
          "Build a day-by-day schedule combining: conference sessions, 3 client meetings (Acme Corp 350 5th Ave, DataFlow AI 85 Broad St, ScaleUp HQ 28 W 23rd St), team dinner, and ground transport estimates.",
      },
      {
        id: "expenses",
        name: "Submit expense pre-approval",
        prompt:
          "Compile all costs (flights, hotel, per diem meals at $75/day, estimated ground transport $200, misc $100) into an expense pre-approval form. Submit for manager approval.",
      },
    ],
  };

  const taxPrepWorkflow: WorkflowDefinition = {
    pattern: "checkpoint",
    steps: [
      {
        id: "gather",
        name: "Gather tax documents",
        prompt:
          "Create a checklist of all required 2025 tax documents: W-2s, 1099s (INT, DIV, B, NEC), 1098 mortgage, charitable receipts, estimated tax payment records. Track status of each.",
      },
      {
        id: "categorize",
        name: "Categorize deductions",
        prompt:
          "Sort all expenses into IRS-recognized categories: home office (simplified vs actual method), professional development, software/tools, charitable donations, health (HSA). Calculate subtotals.",
        requiresApproval: true,
      },
      {
        id: "calculate",
        name: "Calculate home office deduction",
        prompt:
          "Compare simplified method ($5/sq ft × 150 sq ft = $750) vs actual expense method (pro-rata utilities, internet, depreciation). Recommend the higher-value method with documentation requirements.",
        requiresApproval: true,
      },
      {
        id: "package",
        name: "Prepare CPA package",
        prompt:
          "Compile all documents, categorized deductions, and calculations into a CPA-ready package. Include summary cover sheet with key numbers: gross income, total deductions, estimated tax liability.",
      },
    ],
  };

  return [
    {
      id: crypto.randomUUID(),
      projectId: p1,
      name: "Portfolio Rebalance Analysis",
      definition: JSON.stringify(portfolioRebalance),
      status: "completed",
      createdAt: new Date(now - 13 * DAY),
      updatedAt: new Date(now - 11 * DAY),
    },
    {
      id: crypto.randomUUID(),
      projectId: p2,
      name: "Landing Page Build Pipeline",
      definition: JSON.stringify(landingPageBuild),
      status: "active",
      createdAt: new Date(now - 11 * DAY),
      updatedAt: new Date(now - 1 * DAY),
    },
    {
      id: crypto.randomUUID(),
      projectId: p3,
      name: "Lead Generation Campaign",
      definition: JSON.stringify(leadGenPipeline),
      status: "paused",
      createdAt: new Date(now - 9 * DAY),
      updatedAt: new Date(now - 6 * DAY),
    },
    {
      id: crypto.randomUUID(),
      projectId: p4,
      name: "NYC Trip Logistics",
      definition: JSON.stringify(tripPlanning),
      status: "completed",
      createdAt: new Date(now - 7 * DAY),
      updatedAt: new Date(now - 3 * DAY),
    },
    {
      id: crypto.randomUUID(),
      projectId: p5,
      name: "Tax Filing Workflow",
      definition: JSON.stringify(taxPrepWorkflow),
      status: "active",
      createdAt: new Date(now - 5 * DAY),
      updatedAt: new Date(now - 1 * DAY),
    },
  ];
}
