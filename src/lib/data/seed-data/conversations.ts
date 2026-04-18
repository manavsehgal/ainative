export interface ConversationSeed {
  id: string;
  projectId: string;
  title: string;
  runtimeId: string;
  modelId: string;
  status: "active" | "archived";
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessageSeed {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  status: "complete";
  createdAt: Date;
}

interface ConversationsResult {
  conversations: ConversationSeed[];
  messages: ChatMessageSeed[];
}

export function createConversations(
  projectIds: string[]
): ConversationsResult {
  const now = Date.now();
  const DAY = 86_400_000;
  const MIN = 60_000;

  const [launchProject, contentProject, csProject, tvpProject, greenleafProject, , revopsProject] = projectIds;

  const conv1Id = crypto.randomUUID();
  const conv2Id = crypto.randomUUID();
  const conv3Id = crypto.randomUUID();
  const conv4Id = crypto.randomUUID();
  const conv5Id = crypto.randomUUID();
  const conv6Id = crypto.randomUUID();

  const conversations: ConversationSeed[] = [
    {
      id: conv1Id,
      projectId: launchProject,
      title: "Launch copy strategy",
      runtimeId: "claude-agent-sdk",
      modelId: "claude-sonnet-4-5-20250514",
      status: "active",
      createdAt: new Date(now - 5 * DAY),
      updatedAt: new Date(now - 5 * DAY + 30 * MIN),
    },
    {
      id: conv2Id,
      projectId: contentProject,
      title: "SEO content plan for Q2",
      runtimeId: "claude-agent-sdk",
      modelId: "claude-sonnet-4-5-20250514",
      status: "active",
      createdAt: new Date(now - 3 * DAY),
      updatedAt: new Date(now - 3 * DAY + 25 * MIN),
    },
    {
      id: conv3Id,
      projectId: csProject,
      title: "Churn risk for Enterprise accounts",
      runtimeId: "claude-agent-sdk",
      modelId: "claude-sonnet-4-5-20250514",
      status: "active",
      createdAt: new Date(now - 2 * DAY),
      updatedAt: new Date(now - 2 * DAY + 20 * MIN),
    },
    {
      id: conv4Id,
      projectId: tvpProject,
      title: "TechVenture due diligence scope",
      runtimeId: "claude-agent-sdk",
      modelId: "claude-sonnet-4-5-20250514",
      status: "active",
      createdAt: new Date(now - 7 * DAY),
      updatedAt: new Date(now - 7 * DAY + 35 * MIN),
    },
    {
      id: conv5Id,
      projectId: revopsProject,
      title: "Deal review: Meridian Corp stall",
      runtimeId: "claude-agent-sdk",
      modelId: "claude-sonnet-4-5-20250514",
      status: "active",
      createdAt: new Date(now - 1 * DAY),
      updatedAt: new Date(now - 1 * DAY + 40 * MIN),
    },
    {
      id: conv6Id,
      projectId: greenleafProject,
      title: "Product listing A/B results",
      runtimeId: "openai-codex-app-server",
      modelId: "codex-mini-latest",
      status: "archived",
      createdAt: new Date(now - 10 * DAY),
      updatedAt: new Date(now - 8 * DAY),
    },
  ];

  const messages: ChatMessageSeed[] = [
    // ── Conv 1: Launch copy strategy (8 messages) ───────────────────
    {
      id: crypto.randomUUID(),
      conversationId: conv1Id,
      role: "user",
      content:
        "We need to finalize the hero headline for the v2 launch page. The 3 variants are: A) 'Your Business, Run by AI' B) 'Stop Stitching — Start Orchestrating' C) '52 Agents. One Command Center.' Which resonates best for mid-market ops buyers?",
      status: "complete",
      createdAt: new Date(now - 5 * DAY),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv1Id,
      role: "assistant",
      content:
        "For mid-market ops buyers, I'd rank them: **A > B > C**.\n\nVariant A ('Your Business, Run by AI') works because it promises a business outcome, not a feature. Ops buyers think in terms of workflows and results, not agent counts.\n\nVariant B is strong but assumes the reader already knows about the 'stitching problem' — it requires context that cold traffic won't have.\n\nVariant C is impressive but speaks to engineers more than ops leaders. '52 agents' is a feature metric, not a benefit.\n\nRecommendation: A/B test A vs B. A for broad traffic, B for retargeting (they already know the problem).",
      status: "complete",
      createdAt: new Date(now - 5 * DAY + 2 * MIN),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv1Id,
      role: "user",
      content: "Good analysis. What about the supporting subheadline for variant A?",
      status: "complete",
      createdAt: new Date(now - 5 * DAY + 8 * MIN),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv1Id,
      role: "assistant",
      content:
        "For Variant A, the subheadline should bridge from the aspirational headline to a concrete capability. Two options:\n\n1. **Capability-led:** \"Orchestrate 52+ AI agents across marketing, sales, and ops — with governance, auditability, and one dashboard.\"\n\n2. **Pain-led:** \"Stop stitching together 15 tools. One platform to plan, build, run, and scale your AI operations.\"\n\nI'd go with #2 — it turns B's insight into supporting copy for A, giving you the best of both angles.",
      status: "complete",
      createdAt: new Date(now - 5 * DAY + 10 * MIN),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv1Id,
      role: "user",
      content: "Love it. Now draft the 3-email launch sequence — Day 0 announcement, Day 3 deep dive, Day 7 social proof.",
      status: "complete",
      createdAt: new Date(now - 5 * DAY + 15 * MIN),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv1Id,
      role: "assistant",
      content:
        "**Day 0 — Launch Announcement**\nSubject: \"Your Business, Run by AI — ainative v2 is live\"\nHook: The gap between 'run this agent' and 'run my business' just closed.\nBody: Quick overview of what's new (multi-runtime, heartbeat scheduling, governed execution). CTA: Start free.\n\n**Day 3 — Feature Deep Dive**\nSubject: \"How 52 agents work together (without chaos)\"\nHook: Most AI tools add agents. We added orchestration.\nBody: Workflow patterns, governance model, cost controls. CTA: See it in action (2-min demo video).\n\n**Day 7 — Social Proof**\nSubject: \"A solo founder runs 3 businesses with ainative\"\nHook: Meet Alex, who replaced 8 SaaS tools with one dashboard.\nBody: Before/after, specific workflows, time saved. CTA: Start your free trial.",
      status: "complete",
      createdAt: new Date(now - 5 * DAY + 18 * MIN),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv1Id,
      role: "user",
      content: "The Day 7 subject line is good but 'Alex' feels generic. Can we use a more specific persona?",
      status: "complete",
      createdAt: new Date(now - 5 * DAY + 25 * MIN),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv1Id,
      role: "assistant",
      content:
        "Agreed — specificity builds trust. Revised options:\n\n1. \"How a DTC founder cut ops overhead by 60% with AI agents\"\n2. \"From 15 tools to 1: an agency owner's AI stack consolidation\"\n3. \"'I run my entire GTM with 12 agents' — a founder's story\"\n\n#3 is the strongest — it's specific, quotable, and the number '12 agents' makes it tangible without being overwhelming. It also targets our primary persona (solo founder doing GTM).",
      status: "complete",
      createdAt: new Date(now - 5 * DAY + 28 * MIN),
    },

    // ── Conv 2: SEO content plan (7 messages) ───────────────────────
    {
      id: crypto.randomUUID(),
      conversationId: conv2Id,
      role: "user",
      content:
        "Let's plan the Q2 content calendar. Our top keyword cluster is around 'AI agent orchestration' but we also need to cover governance and multi-runtime topics. What's the best sequencing?",
      status: "complete",
      createdAt: new Date(now - 3 * DAY),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv2Id,
      role: "assistant",
      content:
        "Here's the recommended sequence based on keyword difficulty and topic dependencies:\n\n**Week 14:** \"AI Agent Orchestration Guide\" (KD 38, 2.4K vol) — pillar page, already published\n**Week 15:** \"Multi-Agent Workflows Explained\" (KD 42, 1.8K) — builds on the pillar\n**Week 16:** \"Governance for Agentic AI\" (KD 22, 890) — low competition, unique angle\n**Week 17:** \"AI Ops for Solo Founders\" (KD 30, 1.2K) — persona-specific\n**Week 18:** \"Heartbeat Scheduling Deep Dive\" (KD 12, 180) — niche but high-intent\n\nThe logic: start with the highest-volume pillar, then branch into sub-topics that link back. Save niche pieces for later when the pillar is ranking.",
      status: "complete",
      createdAt: new Date(now - 3 * DAY + 3 * MIN),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv2Id,
      role: "user",
      content: "The governance piece has low volume. Is it worth prioritizing?",
      status: "complete",
      createdAt: new Date(now - 3 * DAY + 8 * MIN),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv2Id,
      role: "assistant",
      content:
        "Great question. The volume is low but the strategic value is high for three reasons:\n\n1. **Zero competition** — no one has written a comprehensive governance piece for agentic AI. We'd own the SERP.\n2. **High intent** — people searching 'agent governance' are evaluating platforms, not just learning. These are bottom-funnel keywords.\n3. **Differentiation** — governance is our moat. Publishing thought leadership here positions us as the authority before competitors catch up.\n\nI'd keep it in Week 16 but optimize for a long-tail cluster: 'AI agent governance framework', 'agent permission management', 'governed AI execution'.",
      status: "complete",
      createdAt: new Date(now - 3 * DAY + 11 * MIN),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv2Id,
      role: "user",
      content: "Convinced. What about distribution for these articles?",
      status: "complete",
      createdAt: new Date(now - 3 * DAY + 15 * MIN),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv2Id,
      role: "assistant",
      content:
        "Distribution matrix per article:\n\n- **LinkedIn** (all articles): Hook post + 3 takeaways, published same day as blog\n- **Newsletter** (all articles): Featured in weekly edition with editorial intro\n- **Dev.to** (technical pieces only: orchestration, multi-runtime): Cross-post 3 days after publish for backlink equity\n- **Twitter/X** (all articles): Thread format — 5 tweets per article\n- **Hacker News** (orchestration + governance): Submit with discussion-friendly title\n\nKey rule: LinkedIn posts go out at 8:30am ET Tuesday/Thursday for maximum engagement with our ops buyer persona.",
      status: "complete",
      createdAt: new Date(now - 3 * DAY + 18 * MIN),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv2Id,
      role: "user",
      content: "Perfect. Add this to the editorial calendar and set up the recurring content check-in schedule.",
      status: "complete",
      createdAt: new Date(now - 3 * DAY + 22 * MIN),
    },

    // ── Conv 3: Churn risk analysis (6 messages) ────────────────────
    {
      id: crypto.randomUUID(),
      conversationId: conv3Id,
      role: "user",
      content: "We just got the Q1 NPS results back. Several enterprise accounts dropped significantly. Can you analyze the churn risk across the cohort?",
      status: "complete",
      createdAt: new Date(now - 2 * DAY),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv3Id,
      role: "assistant",
      content:
        "I've analyzed the Q1 cohort (47 accounts). Here's the breakdown:\n\n**Green (healthy):** 31 accounts (66%) — regular usage, NPS 50+\n**Yellow (watch):** 11 accounts (23%) — reduced activity or NPS 30-50\n**Red (at-risk):** 5 accounts (11%) — significant churn signals\n\nThe 5 red accounts:\n1. **BrightPath** — NPS dropped to 28, no login in 19 days, 5 open tickets\n2. **TechStart** — NPS 22, no login in 34 days, 6 tickets (likely already churned)\n3. **NexaPay** — NPS 38 (declining), onboarding stalled at Day 3\n4. **DataFlow AI** — NPS 45 but 3 tickets this week (spike)\n5. **Meridian Corp** — NPS 42, login gap growing\n\nCommon pattern: **no workflow created by Day 7** correlates with churn at 82%.",
      status: "complete",
      createdAt: new Date(now - 2 * DAY + 3 * MIN),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv3Id,
      role: "user",
      content: "That Day 7 workflow insight is huge. Can we use it as an early warning trigger?",
      status: "complete",
      createdAt: new Date(now - 2 * DAY + 8 * MIN),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv3Id,
      role: "assistant",
      content:
        "Absolutely — I'd recommend a two-tier early warning system:\n\n**Tier 1 — Day 5 (soft nudge):** If no workflow created by Day 5, send a targeted email: 'Build your first workflow in 3 minutes' with a template gallery link. This gives them 2 days before the critical threshold.\n\n**Tier 2 — Day 7 (CSM outreach):** If still no workflow, auto-create a task for the assigned CSM: 'Schedule onboarding call — account has not created first workflow.' Include the account health data.\n\nThis catches 82% of potential churners before they disengage. We can configure this as a heartbeat schedule that evaluates daily.",
      status: "complete",
      createdAt: new Date(now - 2 * DAY + 11 * MIN),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv3Id,
      role: "user",
      content: "What about the 5 red accounts right now? What's the rescue plan?",
      status: "complete",
      createdAt: new Date(now - 2 * DAY + 15 * MIN),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv3Id,
      role: "assistant",
      content:
        "Here's the triage plan by urgency:\n\n1. **TechStart** (34 days no login) — likely gone. Send a 'we miss you' email with a re-activation offer. If no response in 5 days, tag as lost.\n2. **BrightPath** (19 days, 5 tickets) — active issues driving disengagement. Escalate to CS manager for personal call + ticket fast-track.\n3. **NexaPay** (stalled onboarding) — book a 30-min guided setup session this week. They need hands-on help.\n4. **DataFlow AI** (ticket spike) — investigate the 3 tickets — could be a bug. If product issue, escalate to eng; if confusion, send a focused tutorial.\n5. **Meridian Corp** (growing gap) — proactive NPS follow-up call. Their NPS is 42 — still recoverable with attention.\n\nI can create tasks for each intervention and assign to the right CSM. Want me to proceed?",
      status: "complete",
      createdAt: new Date(now - 2 * DAY + 18 * MIN),
    },

    // ── Conv 4: TechVenture DD scope (8 messages) ───────────────────
    {
      id: crypto.randomUUID(),
      conversationId: conv4Id,
      role: "user",
      content: "We're looking at HealthSync as a potential investment. They're an AI-powered scheduling platform for healthcare. Can you help scope the due diligence?",
      status: "complete",
      createdAt: new Date(now - 7 * DAY),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv4Id,
      role: "assistant",
      content:
        "Happy to help scope this. For a healthcare AI investment, I'd recommend a 5-phase DD framework:\n\n1. **Financial deep dive** — ARR, margins, retention, burn rate (3 years)\n2. **Market sizing** — TAM/SAM/SOM for AI healthcare scheduling\n3. **Competitive positioning** — incumbent analysis, switching costs, moat\n4. **Regulatory assessment** — HIPAA compliance, data handling, liability\n5. **Team & tech evaluation** — founding team, tech stack, IP\n\nWhat's the investment thesis driving this? That'll help me prioritize which areas go deepest.",
      status: "complete",
      createdAt: new Date(now - 7 * DAY + 2 * MIN),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv4Id,
      role: "user",
      content: "The thesis is that AI-native scheduling can reduce no-shows by 30%+ and that's a massive cost savings for practices. They claim 35% reduction.",
      status: "complete",
      createdAt: new Date(now - 7 * DAY + 6 * MIN),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv4Id,
      role: "assistant",
      content:
        "That's a strong thesis. No-shows cost the US healthcare system $150B annually, so a 35% reduction is a compelling value prop.\n\nTo validate this, I'll need:\n- **Cohort data**: Is the 35% sustained across different practice types, or only for specific specialties?\n- **Methodology**: How is it measured? Before/after on the same practice vs. benchmark comparison?\n- **Retention signal**: Practices that see 35% reduction should have exceptional retention. Let's check net retention as a proxy.\n\nI'll prioritize the financial deep dive and market sizing first. Regulatory can run in parallel since it's mostly checkbox verification for a SOC 2 / HIPAA BAA company.",
      status: "complete",
      createdAt: new Date(now - 7 * DAY + 9 * MIN),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv4Id,
      role: "user",
      content: "They shared a data room. Here's the financial package — 3 years of quarterlies.",
      status: "complete",
      createdAt: new Date(now - 7 * DAY + 15 * MIN),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv4Id,
      role: "assistant",
      content:
        "I've reviewed the financial package. Initial findings:\n\n- **ARR trajectory**: $3.2M → $8.2M over 9 quarters (42% YoY, strong)\n- **Gross margin**: Improved from 74% to 78% (good leverage)\n- **Net retention**: 118% (excellent — expansion revenue from existing accounts)\n- **Burn**: $380K/mo, 14-month runway (needs funding or profitability path)\n- **Concern**: Average contract value declining ($76K → $59K) — could indicate SMB drift\n\nThe declining ACV is worth investigating. If they're moving downmarket, the no-show reduction claim needs to hold for smaller practices too. I'll model three scenarios next.",
      status: "complete",
      createdAt: new Date(now - 7 * DAY + 20 * MIN),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv4Id,
      role: "user",
      content: "Good catch on the ACV decline. Can you also check customer concentration risk? I've heard their top accounts are heavy.",
      status: "complete",
      createdAt: new Date(now - 7 * DAY + 28 * MIN),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv4Id,
      role: "assistant",
      content:
        "Customer concentration is indeed a risk. From the data room:\n\n- **Top 5 accounts = 62% of ARR** ($5.1M of $8.2M)\n- **Largest account = 18% of ARR** ($1.5M — a large health system)\n- **Top 10 = 78% of ARR**\n\nThis is elevated. Best practice for a Series B company is top 5 under 40%. They need a logo diversification plan.\n\nHowever, the 118% net retention partially mitigates this — existing accounts are expanding, suggesting deep product fit. The risk is binary: lose a top-5 account and you lose 10-18% of ARR overnight.\n\nI'll include this as Risk #1 in the DD memo with a recommended condition: 'Invest at $45M with condition that they add 3 new enterprise logos in 6 months to de-risk concentration.'",
      status: "complete",
      createdAt: new Date(now - 7 * DAY + 32 * MIN),
    },

    // ── Conv 5: Deal review — Meridian stall (9 messages) ───────────
    {
      id: crypto.randomUUID(),
      conversationId: conv5Id,
      role: "user",
      content: "Meridian Corp deal has been stalled for 12 days. It's a $220K opportunity. What's going on and how do we rescue it?",
      status: "complete",
      createdAt: new Date(now - 1 * DAY),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv5Id,
      role: "assistant",
      content:
        "Let me pull the activity data for Meridian Corp.\n\n**Deal details:**\n- Amount: $220K | Stage: Proposal | Owner: Sarah K\n- Days in stage: 12 (avg for this stage is 6)\n- Last activity: Email sent March 22, no reply\n- Champion: VP Ops, Jennifer Torres\n- Decision-maker: CTO, absent from last 2 calls\n\n**Red flags:**\n1. Champion hasn't opened last 2 emails (possible OOO or disengagement)\n2. CTO hasn't attended since the demo — may not be bought in\n3. No defined next step in CRM\n\nThis looks like a champion-goes-dark + missing executive sponsor pattern. Very recoverable but needs immediate action.",
      status: "complete",
      createdAt: new Date(now - 1 * DAY + 2 * MIN),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv5Id,
      role: "user",
      content: "What's the rescue playbook for this pattern?",
      status: "complete",
      createdAt: new Date(now - 1 * DAY + 6 * MIN),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv5Id,
      role: "assistant",
      content:
        "Three-step rescue for champion-dark + missing exec:\n\n**Step 1 — Multi-channel reach (today):**\nSend Jennifer a brief LinkedIn message: 'Quick check — noticed our last few emails may have gotten buried. Happy to reconnect when timing is right.' This bypasses a full inbox.\n\n**Step 2 — Executive air cover (this week):**\nHave your VP of Sales reach out to Meridian's CTO directly. Peer-to-peer outreach works 3x better than rep-to-exec. Frame it as: 'I noticed our teams have been talking — wanted to personally make sure we're aligned on the value.'\n\n**Step 3 — Value reinforcement (within 48h):**\nSend Jennifer a short case study relevant to her team's pain point. Don't ask for a meeting — just provide value. If she engages, propose a 15-min recap call.\n\n**If no response in 5 business days:** Escalate to deal qualification review. A $220K deal with no champion response for 17+ days may need to be moved to pipeline at risk.",
      status: "complete",
      createdAt: new Date(now - 1 * DAY + 9 * MIN),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv5Id,
      role: "user",
      content: "Good plan. Draft the LinkedIn message for Sarah to send.",
      status: "complete",
      createdAt: new Date(now - 1 * DAY + 14 * MIN),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv5Id,
      role: "assistant",
      content:
        "Here's the LinkedIn message for Sarah:\n\n---\n\n\"Hi Jennifer — hope you're having a good week. I wanted to pop over here in case my emails got lost in the mix. We'd put together a proposal based on your team's workflow needs and I want to make sure it's still on your radar.\n\nNo rush at all — if timing has shifted, I totally understand. Just let me know if it makes sense to reconnect, even for a quick 10 minutes.\n\nLooking forward to hearing from you!\"\n\n---\n\n**Why this works:** Casual tone (LinkedIn ≠ email formality), acknowledges she might be busy without being pushy, low commitment ask (10 min), and positions the ball in her court.",
      status: "complete",
      createdAt: new Date(now - 1 * DAY + 16 * MIN),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv5Id,
      role: "user",
      content: "Now draft the VP-to-CTO email for the executive air cover.",
      status: "complete",
      createdAt: new Date(now - 1 * DAY + 22 * MIN),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv5Id,
      role: "assistant",
      content:
        "Here's the VP-to-CTO outreach:\n\n---\n\nSubject: Quick question about your AI ops evaluation\n\nHi [CTO name],\n\nI noticed our teams have been in conversation about how ainative could support Meridian's operations team. Wanted to personally reach out — our VP Ops champions tend to see the most value when there's alignment at the technology leadership level too.\n\nWould you have 15 minutes this week for a quick technical overview? Happy to focus specifically on the governance and security model, which I know matters for CTO-level sign-off.\n\nEither way, appreciate you considering us.\n\nBest,\n[VP Sales name]\n\n---\n\n**Coaching note for Sarah:** Time this 24 hours after the LinkedIn message to Jennifer. If Jennifer responds first, adjust the CTO email to reference her engagement.",
      status: "complete",
      createdAt: new Date(now - 1 * DAY + 25 * MIN),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv5Id,
      role: "user",
      content: "What should we do about the other stalled deals — Atlas Financial and Pinnacle Tech?",
      status: "complete",
      createdAt: new Date(now - 1 * DAY + 32 * MIN),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv5Id,
      role: "assistant",
      content:
        "Different patterns, different plays:\n\n**Atlas Financial ($95K, competitive threat):**\n- They mentioned CrewAI in the last call. This is a competitive deal.\n- **Action:** Send the competitive battle card (ainative vs CrewAI) to Mike R. Key differentiators: governance model, multi-runtime support, and enterprise audit trail — things CrewAI doesn't have.\n- **Timeline:** Demo focused on governance this week. If they're evaluating both, we need to be the last demo they see.\n\n**Pinnacle Tech ($65K, qualification concern):**\n- Close date pushed 3 times. No executive sponsor identified.\n- **Action:** Honest qualification check with Jordan L. Questions to answer: Is there budget? Is there a timeline? Is there a decision-maker we haven't met?\n- **Recommendation:** If the answer to any of those is 'no', move to nurture. A $65K deal that's been stalled for 15 days and pushed 3x is likely not ready to buy this quarter.\n\nI can create tasks for both rescue plans and assign to the right reps.",
      status: "complete",
      createdAt: new Date(now - 1 * DAY + 38 * MIN),
    },

    // ── Conv 6: Product listing A/B results — archived (6 messages) ─
    {
      id: crypto.randomUUID(),
      conversationId: conv6Id,
      role: "user",
      content: "The A/B test on the Bamboo Kitchen Set listing has been running for 2 weeks. What are the results?",
      status: "complete",
      createdAt: new Date(now - 10 * DAY),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv6Id,
      role: "assistant",
      content:
        "Results for SKU-1042 (Bamboo Kitchen Set) A/B test:\n\n**Control (original listing):**\n- Click-through: 2.1% | Conversion: 8.4% | Revenue: $1,240\n\n**Variant (optimized copy):**\n- Click-through: 3.4% | Conversion: 11.2% | Revenue: $1,890\n\n**Lift:** +62% CTR, +33% conversion, +52% revenue\n\nThe variant is a clear winner with 99.2% statistical confidence. The primary driver was the keyword-optimized title — 'Bamboo Kitchen Set' moved from position 14 to position 3 in the first 80 characters.",
      status: "complete",
      createdAt: new Date(now - 10 * DAY + 3 * MIN),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv6Id,
      role: "user",
      content: "Great results. Roll out the variant and start the next test.",
      status: "complete",
      createdAt: new Date(now - 10 * DAY + 8 * MIN),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv6Id,
      role: "assistant",
      content:
        "Done. I've staged the variant as the new default for SKU-1042 and queued the next A/B test:\n\n**Next test: Organic Cotton Sheets (SKU-1108)**\n- Current: Strong reviews (4.6, 1,205 reviews) but title is keyword-weak\n- Hypothesis: Adding 'Queen Size' and '100% GOTS Certified' to the title will improve relevance for high-intent searches\n- Test duration: 14 days\n- Success metric: +20% CTR (baseline 2.8%)\n\nI'll report results in 2 weeks. Want me to also queue the Recycled Glass Vases test to run in parallel?",
      status: "complete",
      createdAt: new Date(now - 10 * DAY + 11 * MIN),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv6Id,
      role: "user",
      content: "Yes, run both in parallel. Different products so no conflict.",
      status: "complete",
      createdAt: new Date(now - 10 * DAY + 15 * MIN),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv6Id,
      role: "assistant",
      content:
        "Both tests are now live:\n\n1. **Organic Cotton Sheets** — testing keyword-enriched title (14 days)\n2. **Recycled Glass Vases** — testing benefit-led bullet points vs feature-led (14 days)\n\nI'll monitor daily for any anomalies and send a summary at the halfway point. The GreenLeaf Commerce project dashboard will show real-time test status.\n\nOverall listing optimization progress: 3 of 10 SKUs tested, 1 winner deployed. On track to complete all 10 by end of month.",
      status: "complete",
      createdAt: new Date(now - 10 * DAY + 18 * MIN),
    },
  ];

  return { conversations, messages };
}
