---
title: "Human-in-the-Loop"
subtitle: "Permission Systems, Multi-Channel Governance, and Graceful Escalation"
chapter: 8
part: 3
readingTime: 12
relatedDocs: [inbox-notifications, tool-permissions, settings]
lastGeneratedBy: "2026-03-31T21:00:00Z"
---

## The Problem

Full autonomy is a spectrum, not a switch. Even the most capable AI agents need human oversight for high-stakes decisions. The challenge is not whether to include humans -- it is *where* and *how*, and increasingly, *through which channel*. Stagent's permission system implements progressive trust: agents earn broader permissions through demonstrated reliability, while humans retain veto power at configurable checkpoints. With multi-channel delivery, those checkpoints now extend beyond the web UI to Slack, Telegram, and webhook endpoints -- governance travels to wherever the human already is.

There is a philosophical tension at the heart of every AI agent framework: the more capable the system becomes, the harder it is to oversee. This is the automation paradox. A novice pilot monitors instruments constantly because they do not trust the autopilot. An expert pilot monitors less because they trust it more -- and when the autopilot fails, the expert is slower to notice. The same dynamic plays out with AI agents. When an agent handles ninety-nine tasks flawlessly, the human stops paying attention to the hundredth. And the hundredth is the one that deletes the production database.

What we found missing in the industry's approaches was a *dynamic* model of trust combined with *multi-channel reach*. Static permission lists -- "this tool is always allowed, that tool always requires approval" -- collapse under real-world complexity. And permission prompts that only appear in a web UI are useless when the team lead is on their phone reviewing from Slack. Stagent's implementation addresses both problems: granular, learnable permissions that get less annoying over time, delivered through whatever channel the human is already using.

## The Permission System

The permission architecture has three layers, evaluated in order from fastest to slowest. This cascade design means that the common case -- a pre-approved tool running a familiar command -- resolves in microseconds with no I/O, while the rare case -- a novel tool invocation that requires human judgment -- gracefully escalates to the inbox and, if configured, to Slack or Telegram.

### Layer 1: Tool-Level Permissions

The first layer is the three-tier permission cascade. When the SDK's `canUseTool` callback fires, the system checks three sources of truth before ever bothering the human.

**Profile-level policy** is the fastest check. Each agent profile declares which tools it auto-approves and which it auto-denies. The code-reviewer profile auto-approves `Read` and `Grep` but auto-denies `Write` and `Bash` -- a code reviewer should be reading, not modifying. This check requires no I/O; it is a simple array inclusion test against the profile's `canUseToolPolicy`.

**Saved user permissions** are the second check. These are patterns that the human has explicitly approved via the "Always Allow" button. When you approve `Bash(command:git *)`, you are telling the system that any Bash command starting with `git` is safe to run without asking. These patterns support glob-style matching.

**Notification-based approval** is the fallback. If neither the profile policy nor saved permissions cover a tool invocation, the system creates a notification and blocks the agent until the human responds.

<!-- filename: src/lib/agents/tool-permissions.ts -->
```typescript
export async function waitForToolPermissionResponse(
  notificationId: string,
): Promise<ToolPermissionResponse> {
  const deadline = Date.now() + 55_000;
  const pollInterval = 1500;

  while (Date.now() < deadline) {
    const [notification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, notificationId));
    // ... poll until response arrives or timeout
  }
}
```

The agent does not crash, does not skip the step, and does not hallucinate an alternative. It waits. The implementation uses a Promise that resolves when the user clicks Allow or Deny -- with a 55-second timeout as a safety net.

### Trust Tier Presets

Beyond individual tool permissions, Stagent offers three one-click presets that set permissions in bulk:

| Preset | What it allows | Risk |
|--------|---------------|------|
| **Read Only** | File reading, search, directory listing | Lowest |
| **Git Safe** | Everything in Read Only plus file edits and git commands | Medium |
| **Full Auto** | All tools except direct user questions | Highest |

Presets are additive -- enabling Git Safe automatically includes Read Only tools. The sidebar footer displays a trust tier badge showing the current level at a glance, so you always know how much latitude your agents have.

### The Pattern Matching Engine

The "Always Allow" button generates a permission pattern from the tool invocation. For most tools, the pattern is just the tool name -- `Read`, `Write`, `Grep`. But for `Bash`, the system generates a scoped pattern based on the command prefix.

<!-- filename: src/lib/settings/permissions.ts -->
```typescript
export function buildPermissionPattern(
  toolName: string,
  input: Record<string, unknown>
): string {
  if (toolName === "Bash" && typeof input.command === "string") {
    const command = input.command;
    const firstWord = command.split(/\s+/)[0];
    return `Bash(command:${firstWord} *)`;
  }
  // Most tools are safe to blanket-allow
  return toolName;
}

export function matchesPermission(
  toolName: string,
  input: Record<string, unknown>,
  pattern: string
): boolean {
  const parenIdx = pattern.indexOf("(");

  // No constraint — bare tool name match
  if (parenIdx === -1) {
    return pattern === toolName;
  }

  const patternTool = pattern.slice(0, parenIdx);
  if (patternTool !== toolName) return false;

  // Parse constraint: "key:glob)"
  const constraint = pattern.slice(parenIdx + 1, -1);
  const colonIdx = constraint.indexOf(":");
  if (colonIdx === -1) return false;

  const key = constraint.slice(0, colonIdx);
  const glob = constraint.slice(colonIdx + 1);
  const inputValue = String(input[key] ?? "");

  if (glob.endsWith("*")) {
    return inputValue.startsWith(glob.slice(0, -1));
  }
  return inputValue === glob;
}
```

This is a deliberate design choice. Blanket-allowing Bash would be reckless. But scoping by command prefix gives the human meaningful control without forcing them to approve every individual invocation. `Bash(command:git *)` covers `git status`, `git diff`, `git log`, and every other git subcommand -- all safe. `Bash(command:rm *)` would need explicit, conscious approval.

### Layer 2: Workflow-Level Checkpoints

The second layer operates at the workflow level. Any workflow step can be marked `requiresApproval: true`, which pauses the entire workflow and creates a notification. The human can approve, edit the step's configuration, or reject -- canceling the remaining workflow.

This layer exists because some decisions are not about individual tool calls but about workflow direction. "Should we proceed with the competitor analysis, or pivot to customer research?" is not a question a tool permission system can answer. It is a strategic checkpoint that requires human judgment.

### Layer 3: Escalation Protocols

The third layer handles agent uncertainty. When an agent encounters a situation it cannot resolve -- ambiguous requirements, conflicting constraints, missing information -- it escalates to the human through the `AskUserQuestion` tool. Unlike permission requests, questions always reach the human because they represent genuine uncertainty that no policy can resolve.

## The Notification Inbox: Seven Types of Governance

The inbox receives seven notification types, each serving a different purpose in human-agent collaboration:

1. **Permission requests** -- an agent needs to use a tool that is not pre-approved
2. **Agent questions** -- the agent has decided it needs human input
3. **Workflow progress** -- running status updates as each step completes
4. **Task completions/failures** -- bookend notifications signaling work is done or broken
5. **Budget alerts** -- spending has crossed 80% or 100% of a configured cap
6. **Context proposals** -- the agent wants to store learned context for future use
7. **Handoff approvals** -- one agent wants to delegate work to another (Chapter 7)

The implementation uses a database polling pattern rather than WebSockets. This was a pragmatic choice -- the polling pattern is simpler, and the latency added (a few hundred milliseconds) is imperceptible to a human reading a permission request.

> [!info]
> **Ambient Approval Toast**
> Not every permission request deserves a full inbox notification. Low-stakes requests -- reading a file, listing a directory -- can be presented as toast notifications that auto-dismiss after a few seconds if the user does not intervene. This keeps the inbox focused on decisions that genuinely require attention while still maintaining the audit trail.

## Multi-Channel Governance

This is where the human-in-the-loop story takes a significant step forward. Permission requests and handoff approvals no longer live only in Stagent's web UI. With delivery channels configured, governance events flow to wherever the human already is.

### Channel Gateway: Bidirectional Chat

The channel gateway bridges inbound messages from Slack and Telegram to Stagent's chat engine. When a user sends a message in a connected Slack channel, the gateway resolves or creates a conversation binding, feeds the message to the chat engine, and sends the response back to the same thread.

<!-- filename: src/lib/channels/gateway.ts -->
```typescript
export async function handleInboundMessage(
  params: HandleInboundParams
): Promise<GatewayResult> {
  const { channelConfigId, message } = params;

  // Skip bot messages to prevent loops
  if (message.isBot) {
    return { success: true };
  }

  // Resolve or create binding (channel+thread → conversation)
  let binding = getBindingByConfigAndThread(
    channelConfigId,
    message.externalThreadId ?? null
  );

  if (!binding) {
    const conversation = await createConversation({
      runtimeId: DEFAULT_RUNTIME,
      modelId: DEFAULT_MODEL,
      title: `Channel: ${config.name}`,
    });
    // Create binding linking channel thread to conversation
    // ...
  }
  // Process turn through chat engine, send response back
}
```

The critical feature is permission forwarding. When the chat engine encounters a tool that requires approval, the gateway formats a permission prompt and sends it to the channel thread. The human replies with "approve", "deny", or "always allow" -- in plain text, right in Slack or Telegram.

<!-- filename: src/lib/channels/gateway.ts -->
```typescript
const APPROVE_PATTERNS = /^(approve|yes|allow|ok|y)$/i;
const DENY_PATTERNS = /^(deny|no|reject|n)$/i;
const ALWAYS_ALLOW_PATTERNS = /^(always\s*allow)$/i;

function parsePermissionReply(text: string): ToolPermissionResponse | null {
  const trimmed = text.trim();
  if (ALWAYS_ALLOW_PATTERNS.test(trimmed)) return { behavior: "allow" };
  if (APPROVE_PATTERNS.test(trimmed)) return { behavior: "allow" };
  if (DENY_PATTERNS.test(trimmed)) return { behavior: "deny" };
  return null;
}
```

This means a team lead can approve a handoff from their phone. A developer can grant a tool permission from a Slack notification without context-switching to the browser. Governance meets the human where they are, not where the software lives.

### Three Channel Types

Stagent supports three delivery channel types, each with different capabilities:

- **Slack** -- webhook URL for outbound notifications, bot token + signing secret for bidirectional chat. Auto-polling via `conversations.history` API fetches messages without requiring a public webhook endpoint.
- **Telegram** -- bot token for both outbound notifications and bidirectional chat. Auto-polling fetches updates without a webhook.
- **Webhook** -- send notifications to any HTTP endpoint (outbound only). Useful for integrating with custom dashboards, PagerDuty, or other alerting systems.

Each channel card in Settings has four controls: a **Chat** toggle for bidirectional mode, an **Active** toggle, a **Test** button, and a **Delete** button. The Chat toggle is only available for Slack and Telegram -- webhooks are inherently one-way.

> [!tip]
> **Progressive Trust in Practice**
> A new Stagent installation starts with tight permissions -- almost every tool call requires approval. As you work with the system and click "Always Allow" on tools you trust, the agent becomes progressively more autonomous. After a week of regular use, most sessions run without interruptions. This is not a configuration step you do upfront; it is an emergent property of using the system. The permission list grows organically, reflecting your actual trust boundaries rather than some theoretical security model you defined before you understood the agent's behavior.

## The Automation Paradox

The automation paradox -- first articulated by Lisanne Bainbridge in 1983 -- states that the more reliable an automated system becomes, the less prepared the human operator is to intervene when it fails. This is the central design challenge for AI agent permission systems.

Consider what happens as Stagent's permission system matures. In the first week, the user is actively engaged. Every permission request is novel. By the third week, most common tools are pre-approved. Permission requests are rare. By the third month, when a genuinely dangerous request arrives, the user's decision-making muscle has atrophied.

The design response is multi-layered. First, the pattern system is context-aware -- `Bash(command:git *)` approves git commands but not arbitrary shell operations. Second, the notification rendering emphasizes what is *different* about each request, showing the actual command or file path. Third, the audit trail creates accountability -- every permission decision is recorded with a timestamp, tool name, input, and response. Fourth, multi-channel delivery means the request appears where the human is most likely to actually read it, not buried in a tab they closed three hours ago.

> [!warning]
> **Budget Alerts as Governance**
> When spending approaches a configured budget cap (at 80% and 100%), the inbox surfaces budget alert notifications. These are not just informational -- after the cap is exceeded, new agent work is blocked. Combined with per-schedule cost budgets and the heartbeat scheduler's suppression logic, budget alerts form a financial governance layer that complements tool permissions. An agent might have permission to use every tool, but if it has blown the daily budget, it cannot run at all.

## Lessons Learned

### The "Always Allow" Button Is the Key Feature

Without progressive permissions, a typical coding session generates over 200 tool permission requests per day. The cognitive overhead is crushing. The agent is *capable* but *unusable*. The "Always Allow" button transforms the experience -- within a few sessions, common tools are pre-approved and the permission system fades into the background. The key insight is that the button does not weaken security. It *strengthens* it by reducing approval fatigue.

### Don't Hide the Override

Early designs tucked the "Always Allow" option behind a settings page. Nobody used it. The override moved to the permission request itself -- right next to Allow and Deny, a third button: "Always Allow." Usage jumped immediately. The lesson: if a meta-decision can be made at the point of the original decision, it should be. The user has maximum context and maximum motivation to eliminate future friction.

### Multi-Channel Delivery Changes the Math

Before delivery channels, permission requests had a single audience: whoever had the Stagent tab open. If nobody was looking at the browser, agents blocked indefinitely until the 55-second timeout expired. With Slack and Telegram integration, approval requests reach the human through push notifications on their phone. The effective response time dropped from "whenever they check the tab" to "within seconds of the notification." This changes which operations you are comfortable making approval-gated -- the friction is low enough that even moderate-risk operations can require approval without destroying productivity.

### Audit Trails Build Trust

The audit trail was initially a debugging tool. It turned out to be a trust-building feature. Knowing that every agent action is recorded and reviewable changes the emotional calculus of granting permissions. "What if something goes wrong?" becomes "I can see exactly what happened and when." The audit trail also enables a feedback loop: when a permission decision leads to a bad outcome, you can review the log, identify the overly broad pattern, and tighten it.

> [!lesson]
> **The Trust Ratchet**
> Progressive trust works like a ratchet. Permissions expand easily -- one click on "Always Allow." But they can also be retracted through the settings page when a pattern proves too broad. The asymmetry is intentional. Expanding trust is a high-frequency, low-ceremony action because it happens during active use. Contracting trust is a low-frequency, deliberate action because it happens during reflection. This matches the natural rhythm of human-agent collaboration: fast trust-building during flow states, careful trust-revision during review.

## The Human as System Designer

This chapter's central argument is that the human's highest-leverage role in an AI-native system is not making individual decisions but designing the decision-making infrastructure. The permission system is one expression of this idea. The workflow checkpoint is another. The channel configuration is a third.

In each case, the human makes a *meta-decision* that governs hundreds or thousands of future decisions. Clicking "Always Allow" on `Read` means never being asked again. Placing a `requiresApproval` checkpoint before the "send email" step means every future execution pauses there. Configuring a Slack channel for bidirectional chat means governance events reach the team wherever they are. Configuring a budget cap means agents stop before they overspend.

These meta-decisions compound. A mature Stagent installation, where the human has spent a few weeks shaping permissions and configuring channels, operates with a level of autonomy that would be terrifying without the guardrails -- and feels natural with them. The agent runs for minutes or hours without interruption, executing complex multi-step workflows. But every tool it uses was approved by a human. Every workflow checkpoint was placed by a human. Every budget cap was set by a human. Every delivery channel was configured by a human.

The agent is autonomous. The human designed the autonomy. And the audit trail means the design can always be revised.

[Try: Check Your Inbox](/inbox)
