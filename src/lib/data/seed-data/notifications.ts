export interface NotificationSeed {
  id: string;
  taskId: string;
  type: "task_completed" | "task_failed" | "permission_required" | "agent_message" | "budget_alert" | "context_proposal" | "context_proposal_batch";
  title: string;
  body: string;
  read: boolean;
  toolName: string | null;
  toolInput: string | null;
  response: string | null;
  respondedAt: Date | null;
  createdAt: Date;
}

/**
 * Task index reference (6 per project, 48 total):
 * P1 (Launch):    0-5   — [0] comp analysis (done), [1] copy (done), [2] landing (running), [3] A/B (queued), [4] PH (planned), [5] social (failed)
 * P2 (Content):   6-11  — [6] keyword (done), [7] article (done), [8] LinkedIn (done), [9] newsletter (running), [10] dashboard (queued), [11] research (planned)
 * P3 (CS):        12-17 — [12] onboarding (done), [13] churn (done), [14] playbook (running), [15] NPS (running), [16] triage (queued), [17] health dash (planned)
 * P4 (TVP):       18-23 — [18] financials (done), [19] market (done), [20] DD memo (done), [21] board deck (running), [22] DataPulse (planned), [23] NovaPay (failed)
 * P5 (GreenLeaf): 24-29 — [24] scrape (done), [25] rewrite (done), [26] sentiment (running), [27] ad copy (queued), [28] pricing (queued), [29] tracker (planned)
 * P6 (MedReach):  30-35 — [30] landing (done), [31] HIPAA review (done), [32] email templates (done), [33] social calendar (done), [34] analytics (planned), [35] legal (cancelled)
 * P7 (RevOps):    36-41 — [36] pipeline (done), [37] risk score (done), [38] coaching (running), [39] exec note (running), [40] forecast (queued), [41] win/loss (planned)
 * P8 (Compliance): 42-47 — [42] gather logs (done), [43] SOC2 (done), [44] report (done), [45] brief (done), [46] escalation (done), [47] April scope (planned)
 */
export function createNotifications(taskIds: string[]): NotificationSeed[] {
  const now = Date.now();
  const DAY = 86_400_000;
  const HOUR = 3_600_000;
  const MIN = 60_000;

  return [
    // ── task_completed (5) ──────────────────────────────────────────
    {
      id: crypto.randomUUID(),
      taskId: taskIds[0], // Competitive analysis — P1
      type: "task_completed",
      title: "Competitive analysis complete",
      body: "Analyzed 5 AI copilot products. Key gap: none address multi-agent orchestration or governance. Our 'business operations' positioning is uncontested.",
      read: true,
      toolName: null,
      toolInput: null,
      response: null,
      respondedAt: null,
      createdAt: new Date(now - 18 * DAY),
    },
    {
      id: crypto.randomUUID(),
      taskId: taskIds[7], // Article written — P2
      type: "task_completed",
      title: "SEO article published",
      body: "Published 'AI Agent Orchestration Guide' — 1,920 words, FK score 42, keyword density 1.4%. LinkedIn hook and newsletter intro drafted.",
      read: true,
      toolName: null,
      toolInput: null,
      response: null,
      respondedAt: null,
      createdAt: new Date(now - 10 * DAY),
    },
    {
      id: crypto.randomUUID(),
      taskId: taskIds[20], // DD memo — P4
      type: "task_completed",
      title: "Due diligence memo delivered",
      body: "HealthSync DD memo complete (12 pages). Recommendation: GO at $45M valuation ($5.5x ARR). Condition: 3 new enterprise logos in 6 months.",
      read: false,
      toolName: null,
      toolInput: null,
      response: null,
      respondedAt: null,
      createdAt: new Date(now - 5 * DAY),
    },
    {
      id: crypto.randomUUID(),
      taskId: taskIds[36], // Pipeline snapshot — P7
      type: "task_completed",
      title: "Weekly pipeline snapshot ready",
      body: "34 active deals, $2.8M weighted pipeline. +6 new deals this week ($420K). 2 lost to CrewAI on pricing.",
      read: false,
      toolName: null,
      toolInput: null,
      response: null,
      respondedAt: null,
      createdAt: new Date(now - 5 * DAY),
    },
    {
      id: crypto.randomUUID(),
      taskId: taskIds[44], // Compliance report — P8
      type: "task_completed",
      title: "March compliance report delivered",
      body: "Overall posture: GREEN. 14/16 controls satisfied (87.5%). Improving trend from February. 2 gaps with remediation plans.",
      read: true,
      toolName: null,
      toolInput: null,
      response: null,
      respondedAt: null,
      createdAt: new Date(now - 3 * DAY),
    },

    // ── task_failed (3) ─────────────────────────────────────────────
    {
      id: crypto.randomUUID(),
      taskId: taskIds[5], // Social calendar — P1
      type: "task_failed",
      title: "Social media calendar generation failed",
      body: "Rate limit exceeded when querying social media APIs for engagement benchmarks. 0 of 5 channels analyzed. Retry recommended after 30-minute cooldown.",
      read: false,
      toolName: null,
      toolInput: null,
      response: null,
      respondedAt: null,
      createdAt: new Date(now - 7 * DAY),
    },
    {
      id: crypto.randomUUID(),
      taskId: taskIds[23], // NovaPay financials — P4
      type: "task_failed",
      title: "NovaPay financial extraction failed",
      body: "Could not parse NovaPay's Q4 reporting package — PDF format changed from prior quarters. Manual extraction required.",
      read: false,
      toolName: null,
      toolInput: null,
      response: null,
      respondedAt: null,
      createdAt: new Date(now - 5 * DAY),
    },
    {
      id: crypto.randomUUID(),
      taskId: taskIds[28], // Pricing analysis — P5
      type: "task_failed",
      title: "Competitor pricing scrape blocked",
      body: "Anti-bot protection on 3 of 5 competitor sites prevented price data extraction. Consider using browser automation tools or a manual fallback.",
      read: true,
      toolName: null,
      toolInput: null,
      response: null,
      respondedAt: null,
      createdAt: new Date(now - 2 * DAY),
    },

    // ── permission_required (6) ─────────────────────────────────────
    {
      id: crypto.randomUUID(),
      taskId: taskIds[1], // Write copy — P1
      type: "permission_required",
      title: "Permission to write launch campaign plan",
      body: "Agent wants to save the launch campaign plan as a DOCX file with headline variants, email sequence, and social calendar.",
      read: true,
      toolName: "Write",
      toolInput: JSON.stringify({
        file_path: "launch-campaign-plan.docx",
        description: "Launch campaign plan with 3 headline variants and email sequence",
      }),
      response: "approved",
      respondedAt: new Date(now - 15 * DAY),
      createdAt: new Date(now - 15 * DAY - 30 * MIN),
    },
    {
      id: crypto.randomUUID(),
      taskId: taskIds[8], // LinkedIn series — P2
      type: "permission_required",
      title: "Permission to schedule LinkedIn posts",
      body: "Agent wants to schedule 5 LinkedIn posts via the content distribution API. Posts are queued for Mon/Wed/Fri at 8:30am ET.",
      read: false,
      toolName: "SendEmail",
      toolInput: JSON.stringify({
        channel: "linkedin",
        posts: 5,
        schedule: "MWF 8:30am ET",
      }),
      response: null,
      respondedAt: null,
      createdAt: new Date(now - 8 * DAY),
    },
    {
      id: crypto.randomUUID(),
      taskId: taskIds[13], // Churn analysis — P3
      type: "permission_required",
      title: "Permission to export churn risk report",
      body: "Agent generated a churn risk report for 5 at-risk accounts and wants to save it as an XLSX file.",
      read: true,
      toolName: "Write",
      toolInput: JSON.stringify({
        file_path: "churn-risk-report.xlsx",
        description: "Account health scores with intervention recommendations",
      }),
      response: "approved",
      respondedAt: new Date(now - 9 * DAY),
      createdAt: new Date(now - 9 * DAY - 15 * MIN),
    },
    {
      id: crypto.randomUUID(),
      taskId: taskIds[26], // Review sentiment — P5
      type: "permission_required",
      title: "Permission to run browser automation",
      body: "Agent wants to use Chrome automation to scrape product review pages on 3 e-commerce platforms for sentiment monitoring.",
      read: false,
      toolName: "Bash",
      toolInput: JSON.stringify({
        command: "playwright scrape --sites amazon,walmart,target --sku SKU-1042",
        description: "Scrape product reviews for Bamboo Kitchen Set",
      }),
      response: null,
      respondedAt: null,
      createdAt: new Date(now - 2 * HOUR),
    },
    {
      id: crypto.randomUUID(),
      taskId: taskIds[37], // Risk scoring — P7
      type: "permission_required",
      title: "Permission to query CRM data",
      body: "Agent needs to read deal activity logs from the CRM export to calculate stall risk scores for 7 flagged deals.",
      read: true,
      toolName: "Read",
      toolInput: JSON.stringify({
        file_path: "crm-export/deal-activity-log.csv",
        description: "CRM deal activity data for risk scoring",
      }),
      response: "approved",
      respondedAt: new Date(now - 3 * DAY),
      createdAt: new Date(now - 3 * DAY - 10 * MIN),
    },
    {
      id: crypto.randomUUID(),
      taskId: taskIds[42], // Gather logs — P8
      type: "permission_required",
      title: "Permission to search execution logs",
      body: "Agent wants to search all March execution logs and permission records for the SOC 2 compliance audit.",
      read: true,
      toolName: "WebSearch",
      toolInput: JSON.stringify({
        query: "execution logs March 2026 permission decisions",
        scope: "internal audit trail",
      }),
      response: "approved",
      respondedAt: new Date(now - 4 * DAY),
      createdAt: new Date(now - 4 * DAY - 5 * MIN),
    },

    // ── agent_message (4) ───────────────────────────────────────────
    {
      id: crypto.randomUUID(),
      taskId: taskIds[2], // Build landing page — P1 (running)
      type: "agent_message",
      title: "Landing page: dark mode support?",
      body: "The design brief mentions OKLCH hue 250 for light mode, but doesn't specify dark mode colors. Should I implement a dark mode toggle with auto-detected preference, or ship light-only for launch?",
      read: false,
      toolName: null,
      toolInput: null,
      response: null,
      respondedAt: null,
      createdAt: new Date(now - 1 * HOUR),
    },
    {
      id: crypto.randomUUID(),
      taskId: taskIds[14], // Draft playbook — P3 (running)
      type: "agent_message",
      title: "Intervention escalation path unclear",
      body: "For red accounts (NPS <30), should the intervention go directly to the CSM manager, or should the assigned CSM get first crack at a rescue plan? The current playbook is ambiguous on escalation timing.",
      read: false,
      toolName: null,
      toolInput: null,
      response: null,
      respondedAt: null,
      createdAt: new Date(now - 3 * HOUR),
    },
    {
      id: crypto.randomUUID(),
      taskId: taskIds[21], // Board deck — P4 (running)
      type: "agent_message",
      title: "NovaPay data missing for board deck",
      body: "NovaPay's Q4 financial extraction failed earlier. I can include Q3 data with a 'Q4 pending' note, or hold the deck until NovaPay data is manually extracted. Which do you prefer?",
      read: false,
      toolName: null,
      toolInput: null,
      response: null,
      respondedAt: null,
      createdAt: new Date(now - 45 * MIN),
    },
    {
      id: crypto.randomUUID(),
      taskId: taskIds[39], // Executive note — P7 (running)
      type: "agent_message",
      title: "Include lost deal analysis in exec note?",
      body: "Two deals lost to CrewAI on pricing this week. Should I include a competitive pricing analysis section in the executive operating note, or keep it focused on active pipeline only?",
      read: false,
      toolName: null,
      toolInput: null,
      response: null,
      respondedAt: null,
      createdAt: new Date(now - 30 * MIN),
    },

    // ── budget_alert (3) ────────────────────────────────────────────
    {
      id: crypto.randomUUID(),
      taskId: taskIds[9], // Newsletter — P2 (running)
      type: "budget_alert",
      title: "Daily budget 80% consumed",
      body: "Agent tasks have used $4.02 of your $5.00 daily budget. 3 running tasks may exceed the limit. Consider pausing non-critical tasks or increasing the daily cap in Settings → Budget Guardrails.",
      read: false,
      toolName: null,
      toolInput: null,
      response: null,
      respondedAt: null,
      createdAt: new Date(now - 2 * HOUR),
    },
    {
      id: crypto.randomUUID(),
      taskId: taskIds[15], // NPS monitoring — P3 (running)
      type: "budget_alert",
      title: "Monthly budget 60% consumed (day 12 of 30)",
      body: "You've used $89.40 of your $150.00 monthly budget with 18 days remaining. Current burn rate projects $223 for the month. Heartbeat schedules account for 45% of spend.",
      read: false,
      toolName: null,
      toolInput: null,
      response: null,
      respondedAt: null,
      createdAt: new Date(now - 6 * HOUR),
    },
    {
      id: crypto.randomUUID(),
      taskId: taskIds[21], // Board deck — P4 (running)
      type: "budget_alert",
      title: "Project over-budget: TechVenture Partners",
      body: "The TechVenture Partners project has used $32.50 against a $25.00 per-project weekly cap. The board deck generation task is the primary driver. Consider adjusting the project budget or pausing lower-priority tasks.",
      read: true,
      toolName: null,
      toolInput: null,
      response: null,
      respondedAt: null,
      createdAt: new Date(now - 4 * HOUR),
    },

    // ── context_proposal (4) ────────────────────────────────────────
    {
      id: crypto.randomUUID(),
      taskId: taskIds[1], // Copy variants — P1
      type: "context_proposal",
      title: "Learned: benefit-led headlines preferred",
      body: "From the launch copy task, I observed that you consistently chose benefit-led headlines over feature-led ones. I'd like to remember this for future marketing tasks so I prioritize pain/outcome framing over feature announcements.",
      read: false,
      toolName: null,
      toolInput: JSON.stringify({
        pattern: "headline_style_preference",
        value: "benefit-led over feature-led",
        confidence: 0.91,
      }),
      response: null,
      respondedAt: null,
      createdAt: new Date(now - 14 * DAY),
    },
    {
      id: crypto.randomUUID(),
      taskId: taskIds[7], // Article — P2
      type: "context_proposal",
      title: "Learned: target 1,500-2,000 words for SEO",
      body: "Based on the orchestration guide's performance (position 14 after 5 days), articles in the 1,500-2,000 word range perform best for our target keywords. Shorter pieces don't rank; longer ones have lower completion rates.",
      read: true,
      toolName: null,
      toolInput: JSON.stringify({
        pattern: "optimal_article_length",
        value: "1500-2000 words",
        confidence: 0.85,
      }),
      response: "approved",
      respondedAt: new Date(now - 9 * DAY),
      createdAt: new Date(now - 10 * DAY),
    },
    {
      id: crypto.randomUUID(),
      taskId: taskIds[37], // Risk scoring — P7
      type: "context_proposal",
      title: "Learned: deal stall threshold is 5 business days",
      body: "Your deal review process consistently flags deals at 5+ business days without activity. I'd like to use this as the default stall threshold for future pipeline analysis and coaching notes.",
      read: false,
      toolName: null,
      toolInput: JSON.stringify({
        pattern: "deal_stall_threshold",
        value: "5 business days",
        confidence: 0.94,
      }),
      response: null,
      respondedAt: null,
      createdAt: new Date(now - 3 * DAY),
    },
    {
      id: crypto.randomUUID(),
      taskId: taskIds[13], // Churn analysis — P3
      type: "context_proposal",
      title: "Learned: NPS <30 triggers immediate outreach",
      body: "From the churn analysis, I identified that accounts with NPS below 30 consistently require immediate CSM outreach. I'd like to apply this threshold as a standard trigger for future health monitoring.",
      read: true,
      toolName: null,
      toolInput: JSON.stringify({
        pattern: "nps_intervention_threshold",
        value: "NPS < 30",
        confidence: 0.89,
      }),
      response: "approved",
      respondedAt: new Date(now - 8 * DAY),
      createdAt: new Date(now - 9 * DAY),
    },

    // ── context_proposal_batch (3) ──────────────────────────────────
    {
      id: crypto.randomUUID(),
      taskId: taskIds[20], // DD memo — P4
      type: "context_proposal_batch",
      title: "4 patterns learned from due diligence",
      body: "After completing the HealthSync DD memo, I identified 4 reusable patterns:\n\n1. **Financial snapshot format** — always include ARR, gross margin, net retention, and runway\n2. **Risk framework** — top 3 risks with specific mitigants\n3. **Market sizing** — always include both top-down and bottom-up approaches\n4. **Recommendation format** — GO/NO-GO with conditions\n\nShall I remember these for future DD work?",
      read: true,
      toolName: null,
      toolInput: JSON.stringify({
        patterns: [
          { key: "dd_financial_snapshot", value: "ARR, GM, NRR, runway" },
          { key: "dd_risk_framework", value: "top 3 with mitigants" },
          { key: "dd_market_sizing", value: "top-down + bottom-up" },
          { key: "dd_recommendation", value: "GO/NO-GO with conditions" },
        ],
        confidence: 0.92,
      }),
      response: "approved",
      respondedAt: new Date(now - 4 * DAY),
      createdAt: new Date(now - 5 * DAY),
    },
    {
      id: crypto.randomUUID(),
      taskId: taskIds[36], // Pipeline snapshot — P7
      type: "context_proposal_batch",
      title: "3 patterns learned from deal review",
      body: "From the weekly deal review process, I identified 3 operating patterns:\n\n1. **Forecast buckets** — committed, best-case, and upside (not just total)\n2. **Coaching format** — 1-2 notes per rep, specific to their deals\n3. **Action limit** — top 3 actions only, ranked by leverage\n\nShall I apply these to future operating notes?",
      read: false,
      toolName: null,
      toolInput: JSON.stringify({
        patterns: [
          { key: "forecast_buckets", value: "committed/best-case/upside" },
          { key: "coaching_format", value: "per-rep, deal-specific" },
          { key: "action_limit", value: "top 3 by leverage" },
        ],
        confidence: 0.88,
      }),
      response: null,
      respondedAt: null,
      createdAt: new Date(now - 4 * DAY),
    },
    {
      id: crypto.randomUUID(),
      taskId: taskIds[43], // SOC 2 analysis — P8
      type: "context_proposal_batch",
      title: "2 compliance patterns codified",
      body: "From the March compliance audit, I identified 2 reusable compliance patterns:\n\n1. **Auto-approve scope** — Read and Grep always, Write never, WebSearch context-dependent\n2. **Severity rating** — Critical (data breach risk), High (policy violation), Medium (process gap), Low (best practice miss)\n\nShall I apply these to future audits?",
      read: true,
      toolName: null,
      toolInput: JSON.stringify({
        patterns: [
          { key: "auto_approve_scope", value: "Read/Grep always, Write never" },
          { key: "severity_rating", value: "Critical/High/Medium/Low" },
        ],
        confidence: 0.95,
      }),
      response: "approved",
      respondedAt: new Date(now - 3 * DAY),
      createdAt: new Date(now - 3 * DAY - 30 * MIN),
    },
  ];
}
