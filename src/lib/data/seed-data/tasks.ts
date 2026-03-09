export interface TaskSeed {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: "planned" | "queued" | "running" | "completed" | "failed";
  priority: number;
  result: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function createTasks(projectIds: string[]): TaskSeed[] {
  const now = Date.now();
  const DAY = 86_400_000;
  const HOUR = 3_600_000;
  const [p1, p2, p3, p4, p5] = projectIds;

  return [
    // Project 1 — Investment Portfolio (5 tasks)
    {
      id: crypto.randomUUID(),
      projectId: p1,
      title: "Analyze current portfolio allocation",
      description:
        "Review all holdings, calculate sector weights, and identify concentration risks",
      status: "completed",
      priority: 3,
      result:
        "Portfolio allocation: Tech 42%, Healthcare 18%, Finance 15%, Consumer 12%, Energy 8%, Cash 5%. Top concentration risk: NVDA at 15% of total portfolio. Recommendation: rebalance tech exposure below 35%.",
      createdAt: new Date(now - 13 * DAY),
      updatedAt: new Date(now - 12 * DAY),
    },
    {
      id: crypto.randomUUID(),
      projectId: p1,
      title: "Research top semiconductor ETFs",
      description:
        "Compare SOXX, SMH, and PSI on expense ratio, holdings, and 5-year returns",
      status: "completed",
      priority: 2,
      result:
        "ETF comparison: SOXX (0.35% ER, 30 holdings, +142% 5yr) vs SMH (0.35% ER, 25 holdings, +158% 5yr) vs PSI (0.56% ER, 30 holdings, +98% 5yr). Recommendation: SMH for concentrated exposure, SOXX for broader diversification.",
      createdAt: new Date(now - 12 * DAY),
      updatedAt: new Date(now - 10 * DAY),
    },
    {
      id: crypto.randomUUID(),
      projectId: p1,
      title: "Compare dividend yield strategies",
      description:
        "Evaluate high-yield vs dividend growth approaches for income generation",
      status: "running",
      priority: 2,
      result: null,
      createdAt: new Date(now - 8 * DAY),
      updatedAt: new Date(now - 2 * HOUR),
    },
    {
      id: crypto.randomUUID(),
      projectId: p1,
      title: "Generate quarterly performance report",
      description:
        "Create a comprehensive Q1 performance summary with benchmarks",
      status: "planned",
      priority: 1,
      result: null,
      createdAt: new Date(now - 5 * DAY),
      updatedAt: new Date(now - 5 * DAY),
    },
    {
      id: crypto.randomUUID(),
      projectId: p1,
      title: "Set up automated portfolio alerts",
      description:
        "Configure price alerts and rebalancing triggers for key positions",
      status: "planned",
      priority: 0,
      result: null,
      createdAt: new Date(now - 3 * DAY),
      updatedAt: new Date(now - 3 * DAY),
    },

    // Project 2 — Landing Page (5 tasks)
    {
      id: crypto.randomUUID(),
      projectId: p2,
      title: "Audit competitor landing pages",
      description:
        "Analyze 4 competitor landing pages for design patterns, CTAs, and messaging",
      status: "completed",
      priority: 3,
      result:
        "Analyzed Notion, Linear, Vercel, and Stripe. Key patterns: all use social proof above fold, 2 of 4 use interactive demos, average CTA count is 3. Weakness: most lack personalization. Opportunity: dynamic hero based on referral source.",
      createdAt: new Date(now - 11 * DAY),
      updatedAt: new Date(now - 9 * DAY),
    },
    {
      id: crypto.randomUUID(),
      projectId: p2,
      title: "Write hero section copy and CTA",
      description:
        "Draft 3 headline variants and supporting copy for the hero section",
      status: "completed",
      priority: 2,
      result:
        'Variant A: "Ship faster with AI-powered workflows" (benefit-led). Variant B: "Your team\'s missing engineer" (metaphor). Variant C: "From idea to production in minutes" (speed). Recommended: A/B test Variant A vs C. CTA: "Start building free" with "No credit card required" subtext.',
      createdAt: new Date(now - 9 * DAY),
      updatedAt: new Date(now - 7 * DAY),
    },
    {
      id: crypto.randomUUID(),
      projectId: p2,
      title: "Design responsive hero component",
      description:
        "Build the hero section with responsive layout and animation",
      status: "running",
      priority: 2,
      result: null,
      createdAt: new Date(now - 6 * DAY),
      updatedAt: new Date(now - 1 * HOUR),
    },
    {
      id: crypto.randomUUID(),
      projectId: p2,
      title: "Build testimonial carousel section",
      description:
        "Create a responsive carousel with customer quotes and logos",
      status: "queued",
      priority: 1,
      result: null,
      createdAt: new Date(now - 4 * DAY),
      updatedAt: new Date(now - 4 * DAY),
    },
    {
      id: crypto.randomUUID(),
      projectId: p2,
      title: "Set up A/B test for CTA variants",
      description:
        "Configure split testing for the two hero copy variants",
      status: "planned",
      priority: 0,
      result: null,
      createdAt: new Date(now - 2 * DAY),
      updatedAt: new Date(now - 2 * DAY),
    },

    // Project 3 — Lead Generation (5 tasks)
    {
      id: crypto.randomUUID(),
      projectId: p3,
      title: "Search LinkedIn for VP-level prospects",
      description:
        "Identify VP/Director-level decision-makers at target SaaS companies",
      status: "completed",
      priority: 3,
      result:
        "Found 15 qualified prospects across 8 companies. Breakdown: 6 VP Engineering, 4 VP Product, 3 Director of Engineering, 2 CTO. Top targets: Acme Corp (3 contacts), TechStart Inc (2 contacts).",
      createdAt: new Date(now - 9 * DAY),
      updatedAt: new Date(now - 7 * DAY),
    },
    {
      id: crypto.randomUUID(),
      projectId: p3,
      title: "Enrich prospect data with company info",
      description:
        "Pull company size, funding, and tech stack data for each prospect",
      status: "failed",
      priority: 2,
      result: null,
      createdAt: new Date(now - 7 * DAY),
      updatedAt: new Date(now - 6 * DAY),
    },
    {
      id: crypto.randomUUID(),
      projectId: p3,
      title: "Draft personalized outreach sequences",
      description:
        "Write 3-email sequences personalized for each prospect segment",
      status: "queued",
      priority: 2,
      result: null,
      createdAt: new Date(now - 5 * DAY),
      updatedAt: new Date(now - 5 * DAY),
    },
    {
      id: crypto.randomUUID(),
      projectId: p3,
      title: "Set up email tracking dashboard",
      description:
        "Create dashboard to monitor open rates, clicks, and replies",
      status: "planned",
      priority: 1,
      result: null,
      createdAt: new Date(now - 3 * DAY),
      updatedAt: new Date(now - 3 * DAY),
    },
    {
      id: crypto.randomUUID(),
      projectId: p3,
      title: "Analyze response rates and optimize",
      description:
        "Review campaign performance and adjust messaging for better conversion",
      status: "planned",
      priority: 0,
      result: null,
      createdAt: new Date(now - 1 * DAY),
      updatedAt: new Date(now - 1 * DAY),
    },

    // Project 4 — Business Trip (5 tasks, all completed)
    {
      id: crypto.randomUUID(),
      projectId: p4,
      title: "Book round-trip flights SFO → JFK",
      description:
        "Find and book optimal flights for March 15-18 trip",
      status: "completed",
      priority: 3,
      result:
        "Booked United UA 456 SFO→JFK Mar 15 dep 7:00am arr 3:30pm ($342). Return UA 891 JFK→SFO Mar 18 dep 6:00pm arr 9:15pm ($318). Total: $660. Economy Plus, aisle seats.",
      createdAt: new Date(now - 7 * DAY),
      updatedAt: new Date(now - 6 * DAY),
    },
    {
      id: crypto.randomUUID(),
      projectId: p4,
      title: "Reserve hotel near conference venue",
      description:
        "Book hotel in Midtown Manhattan for 3 nights",
      status: "completed",
      priority: 3,
      result:
        "Booked The Manhattan Club, 200 W 56th St. Standard King, 3 nights Mar 15-18. Rate: $289/night ($867 total). Walking distance to Javits Center. Free cancellation until Mar 13.",
      createdAt: new Date(now - 7 * DAY),
      updatedAt: new Date(now - 6 * DAY),
    },
    {
      id: crypto.randomUUID(),
      projectId: p4,
      title: "Create day-by-day meeting itinerary",
      description:
        "Organize all meetings, events, and travel logistics by day",
      status: "completed",
      priority: 2,
      result:
        "3-day itinerary: Day 1 — Conference keynote + 2 partner meetings. Day 2 — 3 client meetings (Midtown, FiDi, Chelsea) + team dinner at Carbone. Day 3 — Workshop session + departure prep. All Uber estimates included.",
      createdAt: new Date(now - 6 * DAY),
      updatedAt: new Date(now - 5 * DAY),
    },
    {
      id: crypto.randomUUID(),
      projectId: p4,
      title: "Submit pre-trip expense approval",
      description:
        "File expense pre-approval for estimated trip costs",
      status: "completed",
      priority: 1,
      result:
        "Pre-approval submitted and approved. Breakdown: Flights $660, Hotel $867, Meals (per diem) $225, Ground transport $200, Misc $100. Total approved: $2,052. Approval #EXP-2025-0342.",
      createdAt: new Date(now - 5 * DAY),
      updatedAt: new Date(now - 4 * DAY),
    },
    {
      id: crypto.randomUUID(),
      projectId: p4,
      title: "Compile post-trip expense report",
      description:
        "Gather receipts and submit final expense report",
      status: "completed",
      priority: 1,
      result:
        "Final expense report submitted. Actual spend: Flights $660, Hotel $867, Meals $198, Uber/Lyft $156, Conference fee $299. Total: $2,180 (6.2% over estimate). All receipts attached. Reimbursement ETA: 5 business days.",
      createdAt: new Date(now - 4 * DAY),
      updatedAt: new Date(now - 3 * DAY),
    },

    // Project 5 — Tax Filing (5 tasks)
    {
      id: crypto.randomUUID(),
      projectId: p5,
      title: "Gather W-2 and 1099 forms",
      description:
        "Collect all tax documents from employers and financial institutions",
      status: "completed",
      priority: 3,
      result:
        "Collected: W-2 from TechCorp Inc, 1099-INT from Chase Bank, 1099-DIV from Fidelity, 1099-B from Schwab, 1098 mortgage interest from Wells Fargo. All documents verified against prior year. Missing: 1099-NEC from freelance client (followed up).",
      createdAt: new Date(now - 5 * DAY),
      updatedAt: new Date(now - 3 * DAY),
    },
    {
      id: crypto.randomUUID(),
      projectId: p5,
      title: "Categorize deductible expenses",
      description:
        "Sort expenses into IRS-recognized deduction categories",
      status: "running",
      priority: 2,
      result: null,
      createdAt: new Date(now - 4 * DAY),
      updatedAt: new Date(now - 3 * HOUR),
    },
    {
      id: crypto.randomUUID(),
      projectId: p5,
      title: "Calculate home office deduction",
      description:
        "Measure dedicated space and calculate simplified vs actual method",
      status: "queued",
      priority: 1,
      result: null,
      createdAt: new Date(now - 3 * DAY),
      updatedAt: new Date(now - 3 * DAY),
    },
    {
      id: crypto.randomUUID(),
      projectId: p5,
      title: "Review estimated tax payments",
      description:
        "Reconcile quarterly estimated payments against actual liability",
      status: "planned",
      priority: 1,
      result: null,
      createdAt: new Date(now - 2 * DAY),
      updatedAt: new Date(now - 2 * DAY),
    },
    {
      id: crypto.randomUUID(),
      projectId: p5,
      title: "Prepare documents for CPA review",
      description:
        "Organize all forms, deductions, and summaries into a CPA-ready package",
      status: "planned",
      priority: 0,
      result: null,
      createdAt: new Date(now - 1 * DAY),
      updatedAt: new Date(now - 1 * DAY),
    },
  ];
}
