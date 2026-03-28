---
title: "Human-in-the-Loop"
subtitle: "Permission Systems and Graceful Escalation"
chapter: 8
part: 3
readingTime: 12
relatedDocs: [inbox-notifications, tool-permissions, settings]
lastGeneratedBy: "2026-03-27"
---

## The Problem

Full autonomy is a spectrum, not a switch. Even the most capable AI agents need human oversight for high-stakes decisions. The challenge isn't whether to include humans—it's *where* and *how*. Stagent's permission system implements progressive trust: agents earn broader permissions through demonstrated reliability, while humans retain veto power at configurable checkpoints.

There is a philosophical tension at the heart of every AI agent framework, and it is this: the more capable the system becomes, the harder it is to oversee. This is sometimes called the automation paradox. A novice pilot monitors instruments constantly because they don't trust the autopilot. An expert pilot monitors less because they trust it more — and when the autopilot fails, the expert is slower to notice. The same dynamic plays out with AI agents. When an agent handles ninety-nine tasks flawlessly, the human stops paying attention to the hundredth. And the hundredth is the one that deletes the production database.

Every serious AI agent framework grapples with this tension, and their answers reveal deep assumptions about the relationship between humans and machines. Claude's computer use model takes a conservative approach: the system asks for explicit permission before performing actions that modify state, and Anthropic's safety documentation emphasizes that the human should always be able to intervene. OpenAI's function calling pattern takes a different tack — the model proposes tool calls, but the orchestration layer decides whether to execute them. The model never acts directly; it only requests. LangChain's approach is more permissive by default, with tool execution happening automatically unless the developer explicitly adds a human approval node to the graph.

What I found missing in all of these was a *dynamic* model of trust. Static permission lists — "this tool is always allowed, that tool always requires approval" — work for simple cases but collapse under real-world complexity. The same `Bash` command that is perfectly safe when running `git status` is catastrophic when running `rm -rf /`. The same `Write` tool that is harmless when updating a config file is dangerous when overwriting a migration. Context matters, and the permission system needs to understand context.

The industry is converging on what I think of as the three properties of a good permission system: it should be **granular** (per-tool, per-input, not just per-agent), **learnable** (it should get less annoying over time as trust is established), and **auditable** (every permission decision should be recorded and reviewable). Stagent's implementation is an attempt to satisfy all three.

![Inbox showing workflow progress notifications alongside a permission request](/book/images/inbox-notifications-workflow-progress.png "Here's the inbox during a workflow execution. Notifications show permission requests alongside workflow progress updates...")

## The Permission System

The permission architecture has three layers, evaluated in order from fastest to slowest. This cascade design means that the common case — a pre-approved tool running a familiar command — resolves in microseconds with no I/O, while the rare case — a novel tool invocation that requires human judgment — gracefully escalates to the inbox.

### Layer 1: Tool-Level Permissions

The first layer is the three-tier permission cascade. When the Claude SDK's `canUseTool` callback fires, the system checks three sources of truth before ever bothering the human.

**Profile-level policy** is the fastest check. Each agent profile declares which tools it auto-approves and which it auto-denies. The code-reviewer profile, for instance, auto-approves `Read` and `Grep` but auto-denies `Write` and `Bash` — a code reviewer should be reading, not modifying. This check requires no I/O; it is a simple array inclusion test against the profile's `canUseToolPolicy`.

**Saved user permissions** are the second check. These are patterns that the human has explicitly approved via the "Always Allow" button. When you approve `Bash(command:git *)`, you are telling the system that any Bash command starting with `git` is safe to run without asking. These patterns support glob-style matching — `Bash(command:npm *)` covers `npm install`, `npm test`, `npm run build`, and every other npm subcommand. This check hits the settings table but is cached in practice.

**Notification-based approval** is the fallback. If neither the profile policy nor the saved permissions cover a tool invocation, the system creates a notification in the inbox and blocks the agent until the human responds. The agent does not crash, does not skip the step, and does not hallucinate an alternative. It waits. The implementation uses a Promise that resolves when the user clicks Allow or Deny — with a 120-second timeout as a safety net.

<!-- filename: src/lib/agents/claude-agent.ts -->
```typescript
async function handleToolPermission(
  taskId: string,
  toolName: string,
  input: Record<string, unknown>,
  canUseToolPolicy?: CanUseToolPolicy
): Promise<ToolPermissionResponse> {
  const isQuestion = toolName === "AskUserQuestion";

  // Layer 1: Profile-level canUseToolPolicy — fastest check, no I/O
  if (!isQuestion && canUseToolPolicy) {
    if (canUseToolPolicy.autoApprove?.includes(toolName)) {
      return buildAllowedToolPermissionResponse(input);
    }
    if (canUseToolPolicy.autoDeny?.includes(toolName)) {
      return { behavior: "deny", message: `Profile policy denies ${toolName}` };
    }
  }

  // Layer 2: Saved user permissions — skip notification for pre-approved tools
  if (!isQuestion) {
    const { isToolAllowed } = await import("@/lib/settings/permissions");
    if (await isToolAllowed(toolName, input)) {
      return buildAllowedToolPermissionResponse(input);
    }
  }

  // Layer 3: Block on human response via notification inbox
  // ...
}
```
*Three-tier permission cascade — profile policy, then saved permissions, then human approval*

The pattern matching deserves its own explanation. When a user clicks "Always Allow," the system generates a permission pattern from the tool invocation. For most tools, the pattern is just the tool name — `Read`, `Write`, `Grep`. But for `Bash`, the system generates a scoped pattern based on the first word of the command: `Bash(command:git *)`, `Bash(command:npm *)`, `Bash(command:ls *)`. This is a deliberate design choice. Blanket-allowing Bash would be reckless. But scoping by command prefix gives the human meaningful control without forcing them to approve every individual invocation.

<!-- filename: src/lib/settings/permissions.ts -->
```typescript
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
*Pattern matching with glob support — scoped permissions for dangerous tools, blanket permissions for safe ones*

Browser automation introduces a new dimension to permission governance. Chrome DevTools MCP (29 tools) and Playwright MCP (50+ tools) can be enabled from Settings with independent toggles. Permission tiering automatically approves read-only browser operations like taking screenshots or reading page content, while mutation operations — clicking buttons, filling forms, navigating pages — flow through the inbox approval queue. This preserves the human-in-the-loop guarantee even when agents interact with external web applications.

### Layer 2: Workflow-Level Checkpoints

The second layer operates at the workflow level, not the tool level. Any workflow step can be marked `requiresApproval: true`, which pauses the entire workflow and creates a notification. The human can then approve, edit the step's configuration, or reject — which cancels the remaining workflow.

This layer exists because some decisions are not about individual tool calls but about workflow direction. "Should we proceed with the competitor analysis, or pivot to customer research?" is not a question a tool permission system can answer. It is a strategic checkpoint that requires human judgment about what work should be done, not what tools should be used.

The workflow checkpoint pattern is especially important for multi-step processes involving external communication. Draft an email, get human approval, then send it. Generate a report, get stakeholder review, then publish. The cost of a wrong intermediate step is high enough that a pause-and-review gate is worth the friction.

### Layer 3: Escalation Protocols

The third layer handles agent uncertainty. When an agent encounters a situation it cannot resolve — ambiguous requirements, conflicting constraints, missing information — it can explicitly escalate to the human through the `AskUserQuestion` tool. Unlike permission requests, which are generated by the system when the agent tries to use a tool, questions are generated by the agent itself when it decides it needs human input.

This distinction matters architecturally. Permission requests flow through the tool permission cascade and can be auto-resolved by saved patterns. Questions always reach the human because they represent genuine uncertainty that no policy can resolve. An agent asking "Should this function handle the edge case where the input is null, or should we let the caller handle it?" is exercising judgment about when to defer, and that judgment is part of what makes the system trustworthy.

> [!tip]
> **Progressive Trust in Practice**
> A new Stagent installation starts with tight permissions — almost every tool call requires approval. As you work with the system and click "Always Allow" on tools you trust, the agent becomes progressively more autonomous. After a week of regular use, most sessions run without interruptions. This is not a configuration step you do upfront; it is an emergent property of using the system. The permission list grows organically, reflecting your actual trust boundaries rather than some theoretical security model you defined before you understood the agent's behavior.

## The Notification Inbox

The notification inbox is the physical manifestation of the human-in-the-loop pattern. It serves three functions simultaneously: **Awareness** (what is the agent doing?), **Action** (does the agent need something from me?), and **Audit** (what happened while I was away?).

The inbox receives several notification types, each serving a different purpose in the human-agent collaboration. Permission requests arrive when an agent needs to use a tool that is not pre-approved. Agent questions arrive when the agent has decided it needs human input. Workflow progress updates arrive as each step completes, giving the human a running view of long-running processes. Task completions and failures arrive as bookends, signaling when work is done or when something went wrong.

The implementation uses a database polling pattern rather than WebSockets. This was a pragmatic choice. WebSockets add operational complexity — connection management, reconnection logic, state synchronization after disconnects. The polling pattern is simpler: the notification table acts as a message queue, the UI polls at a short interval, and the `canUseTool` callback blocks on a Promise that resolves when the user responds through the API. The latency added by polling (a few hundred milliseconds) is imperceptible to a human who is reading a permission request and deciding whether to approve it.

Rich content rendering is critical for permission decisions. A notification that says "Bash tool requires permission" is useless. A notification that says "Run command: `npm install --save-dev @testing-library/react`" gives the human everything they need to make an informed decision in two seconds. The permission summary system extracts the most relevant field from the tool input — the command for Bash, the file path for Read/Write/Edit, the first meaningful parameter for MCP tools — and presents it prominently.

Progressive disclosure handles the long tail. Most permission decisions can be made from the summary alone. But when the human needs more context — the full command with all flags, the complete file path, every parameter of an MCP tool call — they can expand the notification to see the full detail. This two-level presentation respects both the human's time (fast approvals for routine requests) and their need for information (full context for unusual ones).

The chat-based permission flow deserves special mention. In the chat interface, permission requests appear inline as interactive cards within the conversation stream. The agent's message flow pauses, a permission card appears with Allow, Always Allow, and Deny buttons, and the conversation resumes when the human responds. This feels natural — it is a conversation, and the agent is asking for permission mid-sentence. The implementation bridges the SDK's `canUseTool` callback to the SSE stream through an `AsyncQueue` side channel, allowing permission events to interleave with text generation events without breaking the streaming protocol.

> [!info]
> **Ambient Approval Toast**
> Not every permission request deserves a full inbox notification. Low-stakes requests — reading a file, listing a directory — can be presented as toast notifications that auto-dismiss after a few seconds if the user does not intervene. This keeps the inbox focused on decisions that genuinely require attention while still maintaining the audit trail. The toast pattern works because the cost of a wrong decision is low: if the agent reads a file it should not have, the consequence is a wasted API call, not a deleted database.

## The Automation Paradox

I want to dwell on the philosophical dimension because it shapes every design decision in this chapter. The automation paradox — first articulated by Lisanne Bainbridge in 1983, studying industrial process control — states that the more reliable an automated system becomes, the less prepared the human operator is to intervene when it fails. This is not a hypothetical concern for AI agent systems. It is the central design challenge.

Consider what happens as Stagent's permission system matures. In the first week, the user is actively engaged. Every permission request is novel. The user reads the command, thinks about whether it is safe, and makes a deliberate decision. By the third week, the user has clicked "Always Allow" on most common tools. Permission requests are rare. The user's attention drifts. By the third month, when a genuinely dangerous permission request arrives — a Bash command that would modify system files, a Write operation targeting a production config — the user's decision-making muscle has atrophied. The reflexive response is to approve, because approving has been the right choice ninety-nine times out of a hundred.

The design response to this paradox is multi-layered. First, the permission pattern system is context-aware. `Bash(command:git *)` approves git commands but not arbitrary shell operations. The scoping forces the system to escalate novel command patterns even if the tool itself has been previously approved. Second, the notification rendering emphasizes what is different about each request. The summary shows the actual command or file path, not a generic "tool requires permission" message. Third, the audit trail creates accountability. Every permission decision is recorded with a timestamp, the tool name, the input, and the response. If something goes wrong, you can trace the exact decision that allowed it.

But the deepest response is architectural. The human in Stagent's loop is not primarily an *operator* — someone who monitors and intervenes. The human is a *system designer* — someone who shapes the rules by which the agent operates. Every "Always Allow" click is an act of system design. Every workflow checkpoint placement is an act of system design. Every agent profile's `canUseToolPolicy` configuration is an act of system design. The human's role shifts from making individual decisions to making meta-decisions: not "should this command run?" but "what class of commands should run without asking?"

This reframing is essential because it changes what the human needs to be good at. An operator needs vigilance — the ability to stay alert through long stretches of routine. A system designer needs judgment — the ability to define good policies from limited examples. The second is a much more natural fit for how humans actually work with AI systems. We are bad at sustained vigilance. We are good at pattern recognition and rule-setting.

## Lessons Learned

### The "Always Allow" Button Is the Key Feature

I measured this during development. Without progressive permissions, a typical coding session generated over 200 tool permission requests per day. Read a file? Permission. Run a test? Permission. Check git status? Permission. The cognitive overhead was crushing. The agent was *capable* but *unusable* — every ten seconds of autonomous work was interrupted by a permission dialog.

The "Always Allow" button transformed the experience. Within a few sessions, the common tools were pre-approved, and the permission system faded into the background — surfacing only for genuinely novel operations. The key insight is that the button does not weaken security. It *strengthens* it by reducing approval fatigue. A user who sees three permission requests per hour gives each one genuine attention. A user who sees three per minute clicks "Allow" reflexively. The "Always Allow" button makes the remaining requests meaningful.

### Don't Hide the Override

Early designs tucked the "Always Allow" option behind a settings page. Users had to navigate away from their current context, find the tool permission section, and manually add patterns. Nobody did it. The override moved to the permission request itself — right next to Allow and Deny, a third button: "Always Allow." Usage jumped immediately. The lesson is broader than permissions: if a meta-decision (a decision about decisions) can be made at the point of the original decision, it should be. The user has maximum context at that moment and maximum motivation to eliminate future friction.

### Audit Trails Build Trust

The audit trail was initially an afterthought — a debugging tool for developers. It turned out to be a trust-building feature for users. Knowing that every agent action is recorded and reviewable changes the emotional calculus of granting permissions. "What if something goes wrong?" becomes "I can see exactly what happened and when." This is the same dynamic that makes version control feel safe for developers — not because rollbacks are easy, but because the history is always there.

The audit trail also enables a feedback loop that I did not originally anticipate. When a permission decision leads to a bad outcome — an agent writes to the wrong file, a Bash command has unintended side effects — you can review the audit log, identify the overly broad permission pattern, and tighten it. The system does not just learn to be more autonomous; it learns to be *appropriately* autonomous, with the human refining the boundaries based on observed behavior.

> [!tip]
> **The Trust Ratchet**
> Progressive trust works like a ratchet. Permissions expand easily — one click on "Always Allow." But they can also be retracted through the settings page when a pattern proves too broad. The asymmetry is intentional. Expanding trust is a high-frequency, low-ceremony action because it happens during active use. Contracting trust is a low-frequency, deliberate action because it happens during reflection. This matches the natural rhythm of human-agent collaboration: fast trust-building during flow states, careful trust-revision during review.

## The Human as System Designer

This chapter's central argument is that the human's highest-leverage role in an AI-native system is not making individual decisions but designing the decision-making infrastructure. The permission system is one expression of this idea. The workflow checkpoint is another. The agent profile's policy configuration is a third.

In each case, the human makes a *meta-decision* that governs hundreds or thousands of future decisions. Clicking "Always Allow" on `Read` means the human will never again be asked whether the agent can read a file. Placing a `requiresApproval` checkpoint before the "send email" step means every future execution of that workflow will pause for human review at that exact point. Configuring a code-reviewer profile to auto-deny `Write` means no agent running that profile can ever modify a file without explicit per-invocation approval.

These meta-decisions compound. A mature Stagent installation, where the human has spent a few weeks shaping permissions and designing workflows, operates with a level of autonomy that would be terrifying without the guardrails — and feels natural with them. The agent runs for minutes or hours without interruption, executing complex multi-step workflows, using dozens of tools. But every tool it uses was approved by a human, either individually or through a pattern. Every workflow checkpoint was placed by a human. Every profile policy was configured by a human.

The agent is autonomous. The human designed the autonomy. And the audit trail means the design can always be revised.

[Try: Check Your Inbox](/inbox)
