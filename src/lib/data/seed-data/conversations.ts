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
  const HOUR = 3_600_000;
  const MIN = 60_000;

  const [investmentProject, launchProject, leadGenProject] = projectIds;

  const conv1Id = crypto.randomUUID();
  const conv2Id = crypto.randomUUID();
  const conv3Id = crypto.randomUUID();

  const conversations: ConversationSeed[] = [
    {
      id: conv1Id,
      projectId: investmentProject,
      title: "Portfolio rebalancing strategy",
      runtimeId: "claude-agent-sdk",
      modelId: "claude-sonnet-4-5-20250514",
      status: "active",
      createdAt: new Date(now - 3 * DAY),
      updatedAt: new Date(now - 3 * DAY + 20 * MIN),
    },
    {
      id: conv2Id,
      projectId: launchProject,
      title: "Landing page headline options",
      runtimeId: "claude-agent-sdk",
      modelId: "claude-sonnet-4-5-20250514",
      status: "active",
      createdAt: new Date(now - 1 * DAY),
      updatedAt: new Date(now - 1 * DAY + 15 * MIN),
    },
    {
      id: conv3Id,
      projectId: leadGenProject,
      title: "Outreach sequence review",
      runtimeId: "claude-agent-sdk",
      modelId: "claude-sonnet-4-5-20250514",
      status: "archived",
      createdAt: new Date(now - 7 * DAY),
      updatedAt: new Date(now - 6 * DAY),
    },
  ];

  const messages: ChatMessageSeed[] = [
    // Conversation 1: Portfolio rebalancing
    {
      id: crypto.randomUUID(),
      conversationId: conv1Id,
      role: "user",
      content:
        "My tech allocation is at 42% after the recent rally. What's a sensible rebalancing target?",
      status: "complete",
      createdAt: new Date(now - 3 * DAY),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv1Id,
      role: "assistant",
      content:
        "A 42% tech concentration is elevated. For a growth-oriented portfolio, 30-35% is a common target. I'd suggest trimming in two tranches over the next month to reduce timing risk, starting with your most appreciated positions.",
      status: "complete",
      createdAt: new Date(now - 3 * DAY + 2 * MIN),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv1Id,
      role: "user",
      content: "What sectors should I rotate into?",
      status: "complete",
      createdAt: new Date(now - 3 * DAY + 10 * MIN),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv1Id,
      role: "assistant",
      content:
        "Given your current underweight in healthcare (8%) and industrials (5%), those are natural recipients. Healthcare offers defensive characteristics while industrials give you cyclical upside. A 5% shift into each would bring you to a more balanced allocation.",
      status: "complete",
      createdAt: new Date(now - 3 * DAY + 12 * MIN),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv1Id,
      role: "user",
      content: "Makes sense. Draft a rebalancing plan I can review this weekend.",
      status: "complete",
      createdAt: new Date(now - 3 * DAY + 20 * MIN),
    },

    // Conversation 2: Landing page headlines
    {
      id: crypto.randomUUID(),
      conversationId: conv2Id,
      role: "user",
      content:
        "We need three headline variants for the SaaS launch page. Target audience is mid-market ops teams.",
      status: "complete",
      createdAt: new Date(now - 1 * DAY),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv2Id,
      role: "assistant",
      content:
        'Here are three angles:\n\n1. **Pain-led:** "Stop losing 12 hours a week to manual handoffs"\n2. **Outcome-led:** "Ship ops workflows in minutes, not sprints"\n3. **Social proof:** "Join 400+ ops teams that automated their first workflow in under a day"\n\nI\'d recommend A/B testing #1 vs #2 first — pain-led headlines typically outperform on cold traffic.',
      status: "complete",
      createdAt: new Date(now - 1 * DAY + 3 * MIN),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv2Id,
      role: "user",
      content:
        "I like #1 and #2. Can you write the supporting subheadline for each?",
      status: "complete",
      createdAt: new Date(now - 1 * DAY + 8 * MIN),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv2Id,
      role: "assistant",
      content:
        'For #1: "Automate approvals, routing, and status updates across your stack — no code required."\n\nFor #2: "Drag-and-drop workflow builder with 50+ integrations. Your team ships faster from day one."',
      status: "complete",
      createdAt: new Date(now - 1 * DAY + 10 * MIN),
    },

    // Conversation 3: Outreach sequence (archived)
    {
      id: crypto.randomUUID(),
      conversationId: conv3Id,
      role: "user",
      content:
        "Review our 5-step outreach sequence. Open rates are good but reply rates dropped below 3%.",
      status: "complete",
      createdAt: new Date(now - 7 * DAY),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv3Id,
      role: "assistant",
      content:
        "The main issue is steps 3-5 — they repeat the value prop without adding new information. Each follow-up should introduce a distinct proof point: a case study, a metric, or a relevant trigger event. I'd also shorten step 4 to under 50 words — brevity drives replies in later sequence steps.",
      status: "complete",
      createdAt: new Date(now - 7 * DAY + 4 * MIN),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv3Id,
      role: "user",
      content: "Rewrite steps 3-5 with that approach.",
      status: "complete",
      createdAt: new Date(now - 7 * DAY + 12 * MIN),
    },
    {
      id: crypto.randomUUID(),
      conversationId: conv3Id,
      role: "assistant",
      content:
        '**Step 3 (Day 5):** "Quick note — [Company] cut their approval cycle from 3 days to 4 hours with our workflow builder. Worth a 15-min look?"\n\n**Step 4 (Day 8):** "Saw your team just posted a RevOps role. Happy to share how others automated that work instead."\n\n**Step 5 (Day 12):** "Last reach-out — here\'s a 2-min demo showing the exact workflow your peers use. [link]"',
      status: "complete",
      createdAt: new Date(now - 7 * DAY + 15 * MIN),
    },
  ];

  return { conversations, messages };
}
