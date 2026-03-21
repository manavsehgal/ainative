# Customization

Customization is how you make Codex work the way your team works.

In Codex, customization comes from a few layers that work together:

- **Project guidance (`AGENTS.md`)** for persistent instructions
- **Skills** for reusable workflows and domain expertise
- **[MCP](https://developers.openai.com/codex/mcp)** for access to external tools and shared systems
- **[Multi-agents](https://developers.openai.com/codex/concepts/multi-agents)** for delegating work to specialized sub-agents

These are complementary, not competing. `AGENTS.md` shapes behavior, skills package repeatable processes, and [MCP](https://developers.openai.com/codex/mcp) connects Codex to systems outside the local workspace.

## AGENTS Guidance

`AGENTS.md` gives Codex durable project guidance that travels with your repository and applies before the agent starts work. Keep it small.

Use it for the rules you want Codex to follow every time in a repo, such as:

- Build and test commands
- Review expectations
- Repo-specific conventions
- Directory-specific instructions

When the agent makes incorrect assumptions about your codebase, correct them in `AGENTS.md` and ask the agent to update `AGENTS.md` so the fix persists. Treat it as a feedback loop.

**Updating `AGENTS.md`:** Start with only the instructions that matter. Codify recurring review feedback, put guidance in the closest directory where it applies, and tell the agent to update `AGENTS.md` when you correct something so future sessions inherit the fix.

### When to update `AGENTS.md`

- **Repeated mistakes**: If the agent makes the same mistake repeatedly, add a rule.
- **Too much reading**: If it finds the right files but reads too many documents, add routing guidance (which directories/files to prioritize).
- **Recurring PR feedback**: If you leave the same feedback more than once, codify it.
- **In GitHub**: In a pull request comment, tag `@codex` with a request (for example, `@codex add this to AGENTS.md`) to delegate the update to a cloud task.
- **Automate drift checks**: Use [automations](https://developers.openai.com/codex/app/automations) to run recurring checks (for example, daily) that look for guidance gaps and suggest what to add to `AGENTS.md`.

Pair `AGENTS.md` with infrastructure that enforces those rules: pre-commit hooks, linters, and type checkers catch issues before you see them, so the system gets smarter about preventing recurring mistakes.

Codex can load guidance from multiple locations: a global file in your Codex home directory (for you as a developer) and repo-specific files that teams can check in. Files closer to the working directory take precedence.
Use the global file to shape how Codex communicates with you (for example, review style, verbosity, and defaults), and keep repo files focused on team and codebase rules.

<FileTree
  class="mt-4"
  tree={[
    {
      name: "~/.codex/",
      open: true,
      children: [
        { name: "AGENTS.md", comment: "Global (for you as a developer)" },
      ],
    },
    {
      name: "repo-root/",
      open: true,
      children: [
        { name: "AGENTS.md", comment: "Repo-specific (for your team)" },
      ],
    },
  ]}
/>

[Custom instructions with AGENTS.md](https://developers.openai.com/codex/guides/agents-md)

## Skills

Skills give Codex reusable capabilities for repeatable workflows.
Skills are often the best fit for reusable workflows because they support richer instructions, scripts, and references while staying reusable across tasks.
Skills are loaded and visible to the agent (at least their metadata), so Codex can discover and choose them implicitly. This keeps rich workflows available without bloating context up front.

A skill is typically a `SKILL.md` file plus optional scripts, references, and assets.

<FileTree
  class="mt-4"
  tree={[
    {
      name: "my-skill/",
      open: true,
      children: [
        { name: "SKILL.md", comment: "Required: instructions + metadata" },
        { name: "scripts/", comment: "Optional: executable code" },
        { name: "references/", comment: "Optional: documentation" },
        { name: "assets/", comment: "Optional: templates, resources" },
      ],
    },
  ]}
/>

The skill directory can include a `scripts/` folder with CLI scripts that Codex invokes as part of the workflow (for example, seed data or run validations). When the workflow needs external systems (issue trackers, design tools, docs servers), pair the skill with [MCP](https://developers.openai.com/codex/mcp).

Example `SKILL.md`:

```md
---
name: commit
description: Stage and commit changes in semantic groups. Use when the user wants to commit, organize commits, or clean up a branch before pushing.
---

1. Do not run `git add .`. Stage files in logical groups by purpose.
2. Group into separate commits: feat → test → docs → refactor → chore.
3. Write concise commit messages that match the change scope.
4. Keep each commit focused and reviewable.
```

Use skills for:

- Repeatable workflows (release steps, review routines, docs updates)
- Team-specific expertise
- Procedures that need examples, references, or helper scripts

Skills can be global (in your user directory, for you as a developer) or repo-specific (checked into `.agents/skills`, for your team). Put repo skills in `.agents/skills` when the workflow applies to that project; use your user directory for skills you want across all repos.

| Layer  | Global                 | Repo                                    |
| :----- | :--------------------- | :-------------------------------------- |
| AGENTS | `~/.codex/AGENTS.md`   | `AGENTS.md` in repo root or nested dirs |
| Skills | `$HOME/.agents/skills` | `.agents/skills` in repo                |

Codex uses progressive disclosure for skills:

- It starts with metadata (`name`, `description`) for discovery
- It loads `SKILL.md` only when a skill is chosen
- It reads references or runs scripts only when needed

Skills can be invoked explicitly, and Codex can also choose them implicitly when the task matches the skill description. Clear skill descriptions improve triggering reliability.

[Agent Skills](https://developers.openai.com/codex/skills)

## MCP

MCP (Model Context Protocol) is the standard way to connect Codex to external tools and context providers.
It's especially useful for remotely hosted systems such as Figma, Linear, Jira, GitHub, or internal knowledge services your team depends on.

Use MCP when Codex needs capabilities that live outside the local repo, such as issue trackers, design tools, browsers, or shared documentation systems.

A useful mental model:

- **Host**: Codex
- **Client**: the MCP connection inside Codex
- **Server**: the external tool or context provider

MCP servers can expose:

- **Tools** (actions)
- **Resources** (readable data)
- **Prompts** (reusable prompt templates)

This separation helps you reason about trust and capability boundaries. Some servers mainly provide context, while others expose powerful actions.

In practice, MCP is often most useful when paired with skills:

- A skill defines the workflow and names the MCP tools to use

[Model Context Protocol](https://developers.openai.com/codex/mcp)

## Multi-agents

You can create different agents with different roles and prompt them to use tools differently. For example, one agent might run specific testing commands and configurations, while another has MCP servers that fetch production logs for debugging. Each sub-agent stays focused and uses the right tools for its job.

[Multi-agents concepts](https://developers.openai.com/codex/concepts/multi-agents)

## Skills + MCP together

Skills plus MCP is where it all comes together: skills define repeatable workflows, and MCP connects them to external tools and systems.
If a skill depends on MCP, declare that dependency in `agents/openai.yaml` so Codex can install and wire it automatically (see [Agent Skills](https://developers.openai.com/codex/skills)).

## Next step

Build in this order:

1. [Custom instructions with AGENTS.md](https://developers.openai.com/codex/guides/agents-md) so Codex follows your repo conventions. Add pre-commit hooks and linters to enforce those rules.
2. [Skills](https://developers.openai.com/codex/skills) so you never have the same conversation twice. Skills can include a `scripts/` directory with CLI scripts or pair with [MCP](https://developers.openai.com/codex/mcp) for external systems.
3. [MCP](https://developers.openai.com/codex/mcp) when workflows need external systems (Linear, JIRA, docs servers, design tools).
4. [Multi-agents](https://developers.openai.com/codex/multi-agent) when you're ready to delegate noisy or specialized tasks to sub-agents.