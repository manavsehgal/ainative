/**
 * Seed realistic user-created tables with columns and rows.
 * These showcase the Tables feature with business data tied to seed projects.
 */

export interface UserTableSeed {
  id: string;
  projectId: string;
  name: string;
  description: string;
  source: "manual" | "agent" | "template";
  columns: UserTableColumnSeed[];
  rows: Record<string, unknown>[];
}

export interface UserTableColumnSeed {
  name: string;
  displayName: string;
  dataType: "text" | "number" | "date" | "boolean" | "select" | "url" | "email" | "computed";
  required?: boolean;
  config?: Record<string, unknown> | null;
}

export function createUserTables(projectIds: string[]): UserTableSeed[] {
  const [p1, p2, p3, p4, p5, _p6, p7] = projectIds;

  return [
    // ── P1: Launch Campaign Tracker ─────────────────────────────────
    {
      id: crypto.randomUUID(),
      projectId: p1,
      name: "Launch Campaign Tracker",
      description: "Track launch channels, status, and performance metrics for the AI Copilot v2 launch",
      source: "manual",
      columns: [
        { name: "channel", displayName: "Channel", dataType: "text", required: true },
        { name: "status", displayName: "Status", dataType: "select", config: { options: ["Planned", "In Progress", "Live", "Completed", "Paused"] } },
        { name: "owner", displayName: "Owner", dataType: "text" },
        { name: "launch_date", displayName: "Launch Date", dataType: "date" },
        { name: "impressions", displayName: "Impressions", dataType: "number" },
        { name: "signups", displayName: "Signups", dataType: "number" },
        { name: "conversion_rate", displayName: "Conv. Rate", dataType: "computed", config: { formula: "IF(impressions > 0, ROUND(signups / impressions * 100, 1), 0)", suffix: "%" } },
        { name: "notes", displayName: "Notes", dataType: "text" },
      ],
      rows: [
        { channel: "Product Hunt", status: "Completed", owner: "GTM Agent", launch_date: "2026-03-25", impressions: 12400, signups: 342, notes: "Featured #3 of the day" },
        { channel: "LinkedIn Series", status: "Live", owner: "Content Agent", launch_date: "2026-03-28", impressions: 8200, signups: 89, notes: "5-post series, MWF cadence" },
        { channel: "Email Sequence", status: "Live", owner: "GTM Agent", launch_date: "2026-03-25", impressions: 4500, signups: 198, notes: "3-touch: announce, deep-dive, case study" },
        { channel: "Twitter Launch Thread", status: "Completed", owner: "GTM Agent", launch_date: "2026-03-25", impressions: 18900, signups: 124, notes: "8-tweet thread, product screenshots" },
        { channel: "Blog Post", status: "Live", owner: "Content Agent", launch_date: "2026-03-28", impressions: 2100, signups: 45, notes: "AI Agent Orchestration Guide — pillar page" },
        { channel: "Hacker News", status: "Planned", owner: "Founder", launch_date: "2026-04-08", impressions: 0, signups: 0, notes: "Show HN submission, timing TBD" },
        { channel: "Dev.to Cross-post", status: "In Progress", owner: "Content Agent", launch_date: "2026-04-04", impressions: 0, signups: 0, notes: "Cross-post 3 days after blog publish" },
        { channel: "Retargeting Ads", status: "Planned", owner: "GTM Agent", launch_date: "2026-04-10", impressions: 0, signups: 0, notes: "Meta + Google, $500 budget" },
      ],
    },

    // ── P2: Editorial Calendar ──────────────────────────────────────
    {
      id: crypto.randomUUID(),
      projectId: p2,
      name: "Content Pipeline",
      description: "Track articles from ideation through publication with SEO metrics and distribution status",
      source: "agent",
      columns: [
        { name: "title", displayName: "Title", dataType: "text", required: true },
        { name: "keyword", displayName: "Primary Keyword", dataType: "text" },
        { name: "status", displayName: "Status", dataType: "select", config: { options: ["Idea", "Outlined", "Drafting", "Editing", "Published", "Distributed"] } },
        { name: "word_count", displayName: "Words", dataType: "number" },
        { name: "publish_date", displayName: "Publish Date", dataType: "date" },
        { name: "organic_sessions", displayName: "Organic Sessions", dataType: "number" },
        { name: "backlinks", displayName: "Backlinks", dataType: "number" },
        { name: "serp_position", displayName: "SERP Position", dataType: "number" },
      ],
      rows: [
        { title: "AI Agent Orchestration Guide", keyword: "AI agent orchestration", status: "Published", word_count: 1920, publish_date: "2026-03-28", organic_sessions: 342, backlinks: 2, serp_position: 14 },
        { title: "Multi-Agent Workflows Explained", keyword: "multi-agent framework", status: "Drafting", word_count: 800, publish_date: "2026-04-04", organic_sessions: 0, backlinks: 0, serp_position: 0 },
        { title: "Governance for Agentic AI", keyword: "agent governance AI", status: "Outlined", word_count: 0, publish_date: "2026-04-11", organic_sessions: 0, backlinks: 0, serp_position: 0 },
        { title: "AI Ops for Solo Founders", keyword: "AI operations platform", status: "Idea", word_count: 0, publish_date: "2026-04-18", organic_sessions: 0, backlinks: 0, serp_position: 0 },
        { title: "Heartbeat Scheduling Deep Dive", keyword: "heartbeat monitoring AI", status: "Idea", word_count: 0, publish_date: "2026-04-25", organic_sessions: 0, backlinks: 0, serp_position: 0 },
        { title: "Multi-Runtime Architecture", keyword: "multi-runtime AI", status: "Idea", word_count: 0, publish_date: "2026-05-02", organic_sessions: 0, backlinks: 0, serp_position: 0 },
        { title: "AI Agent Tools Roundup 2026", keyword: "agentic AI tools", status: "Idea", word_count: 0, publish_date: "2026-05-09", organic_sessions: 0, backlinks: 0, serp_position: 0 },
      ],
    },

    // ── P3: Customer Health Tracker ─────────────────────────────────
    {
      id: crypto.randomUUID(),
      projectId: p3,
      name: "Customer Health Scores",
      description: "Account-level health monitoring with NPS, usage, and churn risk signals",
      source: "agent",
      columns: [
        { name: "account", displayName: "Account", dataType: "text", required: true },
        { name: "plan", displayName: "Plan", dataType: "select", config: { options: ["Community", "Pro", "Team"] } },
        { name: "mrr", displayName: "MRR ($)", dataType: "number" },
        { name: "nps", displayName: "NPS", dataType: "number" },
        { name: "health", displayName: "Health", dataType: "select", config: { options: ["Green", "Yellow", "Red"] } },
        { name: "last_login", displayName: "Last Login", dataType: "date" },
        { name: "open_tickets", displayName: "Open Tickets", dataType: "number" },
        { name: "csm", displayName: "CSM Owner", dataType: "text" },
        { name: "intervention", displayName: "Intervention", dataType: "text" },
      ],
      rows: [
        { account: "Acme Corp", plan: "Team", mrr: 499, nps: 72, health: "Green", last_login: "2026-04-02", open_tickets: 1, csm: "Sarah", intervention: "" },
        { account: "DataFlow AI", plan: "Pro", mrr: 149, nps: 45, health: "Yellow", last_login: "2026-03-28", open_tickets: 3, csm: "Mike", intervention: "Send check-in email" },
        { account: "ScaleUp HQ", plan: "Team", mrr: 499, nps: 81, health: "Green", last_login: "2026-04-01", open_tickets: 0, csm: "Sarah", intervention: "" },
        { account: "BrightPath", plan: "Pro", mrr: 149, nps: 28, health: "Red", last_login: "2026-03-15", open_tickets: 5, csm: "Jordan", intervention: "Schedule CSM call — offer training" },
        { account: "CloudBase", plan: "Pro", mrr: 149, nps: 65, health: "Green", last_login: "2026-04-01", open_tickets: 2, csm: "Mike", intervention: "" },
        { account: "NexaPay", plan: "Team", mrr: 499, nps: 38, health: "Yellow", last_login: "2026-03-20", open_tickets: 4, csm: "Jordan", intervention: "Feature walkthrough — workflows" },
        { account: "QuickShip", plan: "Pro", mrr: 149, nps: 55, health: "Green", last_login: "2026-03-30", open_tickets: 1, csm: "Sarah", intervention: "" },
        { account: "TechStart", plan: "Community", mrr: 0, nps: 22, health: "Red", last_login: "2026-02-28", open_tickets: 6, csm: "Jordan", intervention: "Executive outreach — likely churned" },
        { account: "GreenGrid", plan: "Pro", mrr: 149, nps: 70, health: "Green", last_login: "2026-04-02", open_tickets: 0, csm: "Mike", intervention: "" },
        { account: "Meridian Corp", plan: "Team", mrr: 499, nps: 42, health: "Yellow", last_login: "2026-03-25", open_tickets: 3, csm: "Sarah", intervention: "Proactive NPS follow-up" },
      ],
    },

    // ── P4: Portfolio KPI Dashboard ─────────────────────────────────
    {
      id: crypto.randomUUID(),
      projectId: p4,
      name: "Portfolio Company KPIs",
      description: "Quarterly KPI tracking across all 4 portfolio companies for board reporting",
      source: "agent",
      columns: [
        { name: "company", displayName: "Company", dataType: "text", required: true },
        { name: "arr", displayName: "ARR ($M)", dataType: "number" },
        { name: "arr_growth", displayName: "ARR Growth (%)", dataType: "number" },
        { name: "gross_margin", displayName: "Gross Margin (%)", dataType: "number" },
        { name: "nrr", displayName: "Net Retention (%)", dataType: "number" },
        { name: "burn_rate", displayName: "Burn ($K/mo)", dataType: "number" },
        { name: "runway_months", displayName: "Runway (mo)", dataType: "number" },
        { name: "status", displayName: "Status", dataType: "select", config: { options: ["On Track", "Watch", "At Risk", "Outperforming"] } },
        { name: "next_action", displayName: "Next Action", dataType: "text" },
      ],
      rows: [
        { company: "HealthSync", arr: 8.2, arr_growth: 42, gross_margin: 78, nrr: 118, burn_rate: 380, runway_months: 14, status: "On Track", next_action: "Close investment at $45M" },
        { company: "NovaPay", arr: 12.1, arr_growth: 35, gross_margin: 72, nrr: 112, burn_rate: 520, runway_months: 11, status: "Watch", next_action: "CFO search — burn rate concern" },
        { company: "DataBridge", arr: 5.4, arr_growth: 48, gross_margin: 68, nrr: 125, burn_rate: 290, runway_months: 18, status: "Outperforming", next_action: "Series A prep — Q3 target" },
        { company: "CloudSecure", arr: 2.3, arr_growth: 28, gross_margin: 82, nrr: 108, burn_rate: 180, runway_months: 22, status: "On Track", next_action: "Continue monitoring — Q3 review" },
      ],
    },

    // ── P5: Product Listing Scorecard ───────────────────────────────
    {
      id: crypto.randomUUID(),
      projectId: p5,
      name: "Listing Optimization Scorecard",
      description: "Track product listing quality scores, A/B test status, and revenue impact for GreenLeaf Commerce",
      source: "manual",
      columns: [
        { name: "sku", displayName: "SKU", dataType: "text", required: true },
        { name: "product_name", displayName: "Product", dataType: "text" },
        { name: "listing_score", displayName: "Score", dataType: "number" },
        { name: "keyword_coverage", displayName: "Keyword Coverage (%)", dataType: "number" },
        { name: "test_status", displayName: "A/B Test", dataType: "select", config: { options: ["Not Started", "Running", "Winner Found", "Deployed"] } },
        { name: "revenue_before", displayName: "Rev. Before ($)", dataType: "number" },
        { name: "revenue_after", displayName: "Rev. After ($)", dataType: "number" },
        { name: "lift", displayName: "Revenue Lift (%)", dataType: "computed", config: { formula: "IF(revenue_before > 0, ROUND((revenue_after - revenue_before) / revenue_before * 100, 1), 0)", suffix: "%" } },
      ],
      rows: [
        { sku: "SKU-1042", product_name: "Bamboo Kitchen Set", listing_score: 82, keyword_coverage: 85, test_status: "Deployed", revenue_before: 1240, revenue_after: 1890 },
        { sku: "SKU-1108", product_name: "Organic Cotton Sheets", listing_score: 71, keyword_coverage: 62, test_status: "Running", revenue_before: 3200, revenue_after: 0 },
        { sku: "SKU-1215", product_name: "Recycled Glass Vases", listing_score: 48, keyword_coverage: 34, test_status: "Running", revenue_before: 890, revenue_after: 0 },
        { sku: "SKU-1301", product_name: "Eco Yoga Mat", listing_score: 68, keyword_coverage: 55, test_status: "Not Started", revenue_before: 2800, revenue_after: 0 },
        { sku: "SKU-1422", product_name: "Reusable Beeswax Wraps", listing_score: 82, keyword_coverage: 78, test_status: "Not Started", revenue_before: 4100, revenue_after: 0 },
        { sku: "SKU-1503", product_name: "Solar Garden Lights", listing_score: 61, keyword_coverage: 48, test_status: "Not Started", revenue_before: 1600, revenue_after: 0 },
        { sku: "SKU-1618", product_name: "Bamboo Toothbrush Set", listing_score: 75, keyword_coverage: 72, test_status: "Not Started", revenue_before: 5200, revenue_after: 0 },
        { sku: "SKU-1722", product_name: "Recycled Tote Bags", listing_score: 73, keyword_coverage: 68, test_status: "Not Started", revenue_before: 3400, revenue_after: 0 },
      ],
    },

    // ── P7: Deal Pipeline Tracker ───────────────────────────────────
    {
      id: crypto.randomUUID(),
      projectId: p7,
      name: "Deal Pipeline",
      description: "Active sales pipeline with risk scoring, stage tracking, and coaching actions",
      source: "agent",
      columns: [
        { name: "deal_name", displayName: "Deal", dataType: "text", required: true },
        { name: "owner", displayName: "Owner", dataType: "text" },
        { name: "stage", displayName: "Stage", dataType: "select", config: { options: ["Discovery", "Evaluation", "Proposal", "Negotiation", "Closed Won", "Closed Lost"] } },
        { name: "amount", displayName: "Amount ($K)", dataType: "number" },
        { name: "days_in_stage", displayName: "Days in Stage", dataType: "number" },
        { name: "close_date", displayName: "Close Date", dataType: "date" },
        { name: "risk", displayName: "Risk", dataType: "select", config: { options: ["Low", "Medium", "High"] } },
        { name: "next_step", displayName: "Next Step", dataType: "text" },
      ],
      rows: [
        { deal_name: "Acme Corp Expansion", owner: "Sarah K", stage: "Negotiation", amount: 180, days_in_stage: 3, close_date: "2026-04-15", risk: "Low", next_step: "Contract review" },
        { deal_name: "Atlas Financial", owner: "Mike R", stage: "Evaluation", amount: 95, days_in_stage: 8, close_date: "2026-04-30", risk: "Medium", next_step: "Demo follow-up — competitive" },
        { deal_name: "Meridian Corp", owner: "Sarah K", stage: "Proposal", amount: 220, days_in_stage: 12, close_date: "2026-05-10", risk: "High", next_step: "VP-to-VP outreach" },
        { deal_name: "Pinnacle Tech", owner: "Jordan L", stage: "Evaluation", amount: 65, days_in_stage: 15, close_date: "2026-05-30", risk: "High", next_step: "Re-qualify — go/no-go Friday" },
        { deal_name: "DataPulse", owner: "Mike R", stage: "Discovery", amount: 45, days_in_stage: 2, close_date: "2026-06-15", risk: "Low", next_step: "Discovery call #2" },
        { deal_name: "NexaHealth", owner: "Jordan L", stage: "Proposal", amount: 150, days_in_stage: 5, close_date: "2026-04-25", risk: "Medium", next_step: "Pricing discussion" },
        { deal_name: "CloudFirst", owner: "Sarah K", stage: "Negotiation", amount: 310, days_in_stage: 1, close_date: "2026-04-10", risk: "Low", next_step: "MSA redline" },
        { deal_name: "GreenTech Solutions", owner: "Mike R", stage: "Discovery", amount: 75, days_in_stage: 4, close_date: "2026-06-30", risk: "Low", next_step: "Needs analysis" },
        { deal_name: "Summit Partners", owner: "Jordan L", stage: "Evaluation", amount: 120, days_in_stage: 7, close_date: "2026-05-15", risk: "Medium", next_step: "Technical review" },
        { deal_name: "Vertex Labs", owner: "Sarah K", stage: "Discovery", amount: 55, days_in_stage: 1, close_date: "2026-07-15", risk: "Low", next_step: "Intro meeting" },
      ],
    },
  ];
}
