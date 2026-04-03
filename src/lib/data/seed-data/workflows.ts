import type { WorkflowDefinition } from "@/lib/workflows/types";

export interface WorkflowSeed {
  id: string;
  projectId: string;
  name: string;
  definition: string;
  status: "draft" | "active" | "paused" | "completed" | "failed";
  createdAt: Date;
  updatedAt: Date;
}

export function createWorkflows(projectIds: string[]): WorkflowSeed[] {
  const now = Date.now();
  const DAY = 86_400_000;
  const [p1, p2, p3, p4, p5, p6, p7, p8] = projectIds;

  // P1: Product Launch Pipeline
  const launchPipeline: WorkflowDefinition = {
    pattern: "checkpoint",
    steps: [
      {
        id: "research",
        name: "Competitive & audience research",
        prompt:
          "Analyze 5 competing AI copilot products (Cursor, Windsurf, Cody, Tabnine, Copilot). Document positioning, pricing, feature gaps, and messaging angles we can own. Output a competitive matrix.",
      },
      {
        id: "copy",
        name: "Write launch copy variants",
        prompt:
          "Using competitive insights, write 3 hero headline variants, email subject lines for the 3-touch launch sequence, and a 280-char social post per channel (LinkedIn, Twitter). Follow the brand voice guide.",
        requiresApproval: true,
      },
      {
        id: "build",
        name: "Build launch landing page",
        prompt:
          "Implement the approved hero section and feature grid as responsive React components using Tailwind CSS. Include OG meta tags, structured data, and conversion tracking pixels.",
        requiresApproval: true,
      },
      {
        id: "test",
        name: "Configure A/B tests",
        prompt:
          "Set up A/B test for the top 2 hero variants. Configure event tracking for CTA clicks, scroll depth, time on page, and email signup conversion. Define a 7-day test window with 95% confidence threshold.",
      },
    ],
  };

  // P2: Weekly Content Cycle
  const contentCycle: WorkflowDefinition = {
    pattern: "sequence",
    steps: [
      {
        id: "research",
        name: "Keyword & topic research",
        prompt:
          "Pull this week's target keyword cluster from the editorial calendar. Research search volume, competition score, and top-ranking content. Identify 3 content gaps we can fill.",
      },
      {
        id: "outline",
        name: "Create article outline",
        prompt:
          "Build a structured outline: H1, 5-7 H2 sections, target 1,800 words, 3 internal link opportunities, and a CTA placement plan. Include the primary and 2 secondary keywords.",
      },
      {
        id: "draft",
        name: "Write first draft",
        prompt:
          "Write the full article following the approved outline. Use clear topic sentences, include 2-3 data points per section, and end with a compelling CTA. Maintain a Flesch-Kincaid score under 45.",
      },
      {
        id: "edit",
        name: "Editorial review & polish",
        prompt:
          "Review the draft for factual accuracy, brand voice consistency, SEO optimization (keyword density 1-2%), and readability. Fix any issues and prepare the final version with meta description and alt text.",
      },
      {
        id: "distribute",
        name: "Prepare distribution assets",
        prompt:
          "Create a LinkedIn post (hook + 3 key takeaways), a newsletter intro paragraph, and a Twitter thread (5 tweets). Schedule all pieces in the content calendar.",
      },
    ],
  };

  // P3: Customer Onboarding Flow
  const onboardingFlow: WorkflowDefinition = {
    pattern: "checkpoint",
    steps: [
      {
        id: "welcome",
        name: "Send welcome sequence",
        prompt:
          "Trigger the 3-email welcome sequence: Day 0 welcome + quick start guide, Day 2 feature spotlight, Day 5 'how are things going?' check-in. Personalize with company name and plan tier.",
      },
      {
        id: "setup",
        name: "Verify account setup",
        prompt:
          "Check that the customer has completed key setup milestones: API key configured, first project created, first agent run completed. Flag any incomplete steps.",
        requiresApproval: true,
      },
      {
        id: "training",
        name: "Schedule training session",
        prompt:
          "Based on the customer's plan tier and team size, recommend a training path: self-serve docs for Starter, live walkthrough for Pro, dedicated onboarding call for Team. Book the session if applicable.",
      },
      {
        id: "review",
        name: "14-day health check",
        prompt:
          "At day 14, assess: login frequency, feature adoption depth, support tickets filed. Score as green/yellow/red and recommend next touchpoint. Escalate red accounts to CS manager.",
        requiresApproval: true,
      },
    ],
  };

  // P4: Due Diligence Workflow
  const dueDiligence: WorkflowDefinition = {
    pattern: "planner-executor",
    steps: [
      {
        id: "scope",
        name: "Define analysis scope",
        prompt:
          "Review the investment memo and define the DD scope: financial analysis depth, market sizing approach, competitive landscape breadth, and key risk factors to investigate. Output a scoping document.",
      },
      {
        id: "financials",
        name: "Financial deep dive",
        prompt:
          "Analyze 3 years of financials: ARR growth, gross margins, net retention, burn rate, and runway. Model 3 scenarios (base, upside, downside) with key assumptions. Flag any accounting irregularities.",
      },
      {
        id: "market",
        name: "Market & TAM analysis",
        prompt:
          "Size the total addressable market using top-down and bottom-up approaches. Map the competitive landscape with positioning matrix. Identify market tailwinds and headwinds.",
      },
      {
        id: "competitive",
        name: "Competitive positioning",
        prompt:
          "Deep-dive into 4-5 direct competitors: product comparison, pricing analysis, customer reviews, team strength, and funding history. Identify sustainable competitive advantages.",
      },
      {
        id: "synthesis",
        name: "Write DD memo",
        prompt:
          "Synthesize all findings into a structured DD memo: executive summary, investment thesis, financial highlights, market opportunity, competitive position, top risks with mitigants, and go/no-go recommendation.",
      },
    ],
  };

  // P5: Product Listing Optimizer
  const listingOptimizer: WorkflowDefinition = {
    pattern: "sequence",
    steps: [
      {
        id: "scrape",
        name: "Scrape current listings",
        prompt:
          "Pull the current product listings for the top 20 SKUs by revenue. Capture title, description, bullet points, images count, price, and review score. Store as structured data.",
      },
      {
        id: "analyze",
        name: "Analyze listing performance",
        prompt:
          "Compare listing quality against top 3 competitors per SKU. Score each listing on: keyword coverage (title + bullets), image count, review volume, and A+ content presence. Rank by optimization opportunity.",
      },
      {
        id: "rewrite",
        name: "Generate optimized copy",
        prompt:
          "For the top 10 opportunity SKUs, rewrite titles (under 200 chars), 5 bullet points (keyword-rich), and product descriptions. Maintain brand voice while improving keyword density. A/B test the top 3.",
      },
      {
        id: "deploy",
        name: "Stage updates for review",
        prompt:
          "Prepare a change log with before/after for each listing update. Stage the changes in the CMS draft queue and notify the client for approval before going live.",
      },
    ],
  };

  // P6: HIPAA Content Review
  const hipaaReview: WorkflowDefinition = {
    pattern: "checkpoint",
    steps: [
      {
        id: "draft",
        name: "Draft marketing content",
        prompt:
          "Write the campaign content: referral program landing page copy, 2 email templates for provider outreach, and 3 social media posts. Follow healthcare marketing guidelines — no unsubstantiated claims.",
        requiresApproval: true,
      },
      {
        id: "compliance",
        name: "HIPAA compliance check",
        prompt:
          "Scan all content for PHI references, testimonial compliance, disclaimer requirements, and FDA marketing restrictions. Flag any language that could violate HIPAA, FTC, or state healthcare marketing laws.",
        requiresApproval: true,
      },
      {
        id: "legal",
        name: "Legal counsel review",
        prompt:
          "Prepare the legal review package: all content pieces with compliance annotations, risk flags, and recommended disclaimer language. Route to legal@medreach.health for sign-off.",
        requiresApproval: true,
      },
      {
        id: "publish",
        name: "Publish approved content",
        prompt:
          "After legal approval, schedule publication: landing page goes live immediately, emails queued for Tuesday 10am send, social posts staggered across the week. Update the compliance audit log.",
        requiresApproval: true,
      },
    ],
  };

  // P7: Weekly Deal Review
  const dealReview: WorkflowDefinition = {
    pattern: "sequence",
    steps: [
      {
        id: "pull",
        name: "Pull pipeline data",
        prompt:
          "Export this week's pipeline snapshot: all deals in stages 2-5, new opportunities, stage changes, and closed-won/lost. Include deal owner, amount, close date, and days in stage.",
      },
      {
        id: "risk",
        name: "Score deal risk",
        prompt:
          "For each open deal, calculate a risk score based on: days in current stage (>5 = elevated), champion engagement (email opens, meeting frequency), competitive mentions, and budget confirmation status.",
      },
      {
        id: "coaching",
        name: "Generate coaching notes",
        prompt:
          "For each rep, identify 1-2 coaching opportunities based on their deals: stalled deals needing executive sponsorship, missing next steps, or pricing objections that need a value sell approach.",
      },
      {
        id: "summary",
        name: "Write executive summary",
        prompt:
          "Compile the weekly operating note: pipeline created vs target, forecast by confidence bucket (committed/best-case/upside), top risks, and the 3 highest-leverage actions for leadership.",
      },
    ],
  };

  // P8: Monthly Compliance Audit
  const complianceAudit: WorkflowDefinition = {
    pattern: "planner-executor",
    steps: [
      {
        id: "gather",
        name: "Gather audit evidence",
        prompt:
          "Collect all governed execution logs, permission decisions, agent tool usage, and data access patterns for the audit period. Cross-reference against the SOC 2 control framework.",
      },
      {
        id: "analyze",
        name: "Analyze compliance gaps",
        prompt:
          "Compare execution logs against defined policies: tool approval rates, auto-approve bypass patterns, sensitive data access, and budget adherence. Identify gaps and rate severity (critical/high/medium/low).",
      },
      {
        id: "report",
        name: "Generate compliance report",
        prompt:
          "Write the monthly compliance report: executive summary, control effectiveness by category, gap analysis with remediation timelines, and trend analysis vs prior month. Include evidence references.",
      },
      {
        id: "brief",
        name: "Executive briefing",
        prompt:
          "Prepare a 1-page executive brief: overall compliance posture (green/yellow/red), top 3 findings, remediation progress on prior findings, and recommended policy updates.",
      },
    ],
  };

  return [
    {
      id: crypto.randomUUID(),
      projectId: p1,
      name: "Product Launch Pipeline",
      definition: JSON.stringify(launchPipeline),
      status: "active",
      createdAt: new Date(now - 20 * DAY),
      updatedAt: new Date(now - 1 * DAY),
    },
    {
      id: crypto.randomUUID(),
      projectId: p2,
      name: "Weekly Content Cycle",
      definition: JSON.stringify(contentCycle),
      status: "active",
      createdAt: new Date(now - 17 * DAY),
      updatedAt: new Date(now - 1 * DAY),
    },
    {
      id: crypto.randomUUID(),
      projectId: p3,
      name: "Customer Onboarding Flow",
      definition: JSON.stringify(onboardingFlow),
      status: "active",
      createdAt: new Date(now - 15 * DAY),
      updatedAt: new Date(now - 2 * DAY),
    },
    {
      id: crypto.randomUUID(),
      projectId: p4,
      name: "Due Diligence Workflow",
      definition: JSON.stringify(dueDiligence),
      status: "completed",
      createdAt: new Date(now - 13 * DAY),
      updatedAt: new Date(now - 3 * DAY),
    },
    {
      id: crypto.randomUUID(),
      projectId: p5,
      name: "Product Listing Optimizer",
      definition: JSON.stringify(listingOptimizer),
      status: "active",
      createdAt: new Date(now - 11 * DAY),
      updatedAt: new Date(now - 2 * DAY),
    },
    {
      id: crypto.randomUUID(),
      projectId: p6,
      name: "HIPAA Content Review",
      definition: JSON.stringify(hipaaReview),
      status: "paused",
      createdAt: new Date(now - 9 * DAY),
      updatedAt: new Date(now - 4 * DAY),
    },
    {
      id: crypto.randomUUID(),
      projectId: p7,
      name: "Weekly Deal Review",
      definition: JSON.stringify(dealReview),
      status: "draft",
      createdAt: new Date(now - 7 * DAY),
      updatedAt: new Date(now - 1 * DAY),
    },
    {
      id: crypto.randomUUID(),
      projectId: p8,
      name: "Monthly Compliance Audit",
      definition: JSON.stringify(complianceAudit),
      status: "completed",
      createdAt: new Date(now - 5 * DAY),
      updatedAt: new Date(now - 3 * DAY),
    },
  ];
}
