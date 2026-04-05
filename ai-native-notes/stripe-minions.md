Minions: Stripe’s one-shot, end-to-end coding agents

https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents

Minions: Stripe’s one-shot, end-to-end coding agents
/
Metadata
Date:
2026.2.09
Author:
Alistair Gray
Reading time:
5 min read
Categories:
AI
Developer Productivity
LLMs
Engineering
Share:
Twitter/X
LinkedIn
/
Article
Across the industry, agentic coding has gone from new and exciting to table stakes, and as underlying models continue to improve, unattended coding agents have gone from possibility to reality.

Minions are Stripe’s homegrown coding agents. They’re fully unattended and built to one-shot tasks. Over a thousand pull requests merged each week at Stripe are completely minion-produced, and while they’re human-reviewed, they contain no human-written code.

Our developers can still plan and collaborate with agents such as Claude and Cursor, but in a world where one of our most constrained resources is developer attention, unattended agents allow for parallelization of tasks.

A typical minion run starts in a Slack message and ends in a pull request which passes CI and is ready for human review, with no interaction in between. We frequently see engineers spinning up multiple minions in parallel, to enable them to parallelize the completion of many different tasks. This can be particularly helpful during an on-call rotation to effectively resolve many small issues that might arise.

In the first part of this blog post miniseries, we’ll show you how our engineers use minions and what they can do. In Part 2, we’ll dive into the implementation under the hood and how we built them.

Why did we build it ourselves?
Vibe coding a prototype from scratch is fundamentally different from contributing code to Stripe’s codebase.

Stripe’s codebase encompasses hundreds of millions of lines of code across a few large repositories. Most of our backend is written in Ruby (not Rails) with Sorbet typing, a relatively uncommon stack. Throughout, our code uses a vast number of homegrown libraries that are unique to Stripe and therefore natively unfamiliar to LLMs.

The stakes are high: this code moves well over $1 trillion per year of payment volume live in production. Simultaneously, Stripe has many intricate real-world dependencies on financial institutions and regulatory and compliance obligations that our code must honor.

LLM agents are incredibly good at building software from scratch when there are relatively few constraints on a system. However, iterating on any codebase of the scale, complexity, and maturity of Stripe’s is inherently much harder. Humans must build sophisticated mental models to make effective changes in our repos, and enabling agents to develop the correct intuitions and use the correct tools within the confines of their context windows is challenging.

Over the years, Stripe has invested in developer productivity foundations that support our unique constraints at all stages in the development lifecycle—source control, environments, code generation, CI, and much more—and so our custom minion harness tightly integrates with that tooling. Minions use the same developer tooling that equally enables Stripe’s human engineers to effectively operate on our scale: if it’s good for humans, it’s good for LLMs, too.

What is it like to use a minion?
There are several different entry points for minions, designed to integrate as ergonomically as possible with where Stripes are. While we provide CLI and web interfaces for initiating minions, engineers will most frequently start one from Slack. By tagging our Slack app, engineers can kick off a minion directly from the thread discussing a change, and it’ll be able to access the entire thread and any links included as context.

If you’re an engineer working on internal tools, you might kick off a minion with a message like this:



A Slack message invoking a minion run

Minions can also be invoked from inside other internal applications at Stripe. Our internal docs platform, feature flag platform, and internal ticketing UI all integrate with minions. For example, when our CI systems detect flaky tests, we create automated tickets that prompt users to fix the problem with a minion.



A flaky test ticket with a button to start a minion that’d fix it

While the minion works, or after the fact, engineers can see the decisions and actions the minion took in a web UI.



An example of the web interface for managing minion runs

Once it has completed its task, a minion creates a branch, pushes it to CI, and prepares a pull request following Stripe’s PR template. If the code looks good, the engineer opens the PR and requests a review from another Stripe engineer. If not, they can give the minion further instructions, and it will push updated code to the branch when it’s done.

Engineers can also iterate on a completed minion run manually once it’s completed. While our North Star is a pull request produced without any human code, a minion run that’s not entirely correct is often still an excellent starting point for an engineer’s focused work.

How do minions work?
There are many stages to a minion, and in the second part of this miniseries, we’ll have more details about how minions work. Many of the details are Stripe-specific, but we do think that there are some generalizable lessons. To whet your appetite, here’s a brief chronological tour.

A minion run starts in an isolated developer environment—or “devbox”—which are the same type of machine that Stripe engineers write code on. Devboxes are pre-warmed so one can be spun up in 10 seconds, with Stripe code and services pre-loaded. They’re isolated from production resources and the internet, so we can run minions on devboxes without human permission checks. This also gives parallelization without the overhead of something like git worktrees, which wouldn’t scale at Stripe.

The core agent loop runs on a fork of Block’s coding agent goose, one of the first widely used coding agents, which we forked early on. We’ve customized the orchestration flow in an opinionated way to interleave agent loops and deterministic code—for git operations, linters, testing, and so on—so that minion runs mix the creativity of an agent with the assurance that they’ll always complete Stripe-required steps like linters.

In general, minions read the same coding agent rule files that human-operated tools such as Cursor and Claude Code do, consuming several different agent rule file formats. However, it would be impractical for Stripe to have many unconditional rules, so almost all agent rules at Stripe are conditionally applied based on subdirectories.

Minions are connected to MCP, which provides a common language for networkable LLM function calling. This is how they gather context like internal documentation, ticket details, build statuses, code intelligence via Sourcegraph search, and more. Indeed, we deterministically run relevant MCP tools over likely-looking links before a minion run even starts, to better hydrate the context.

Since MCP is a common language for all agents at Stripe, not just minions, we built a central internal MCP server called Toolshed, which hosts more than 400 MCP tools spanning internal systems and SaaS platforms we use at Stripe. Minions and other agents have connectivity to configurable but curated subsets of the full breadth of tools.

Minions are built with the goal of one-shotting their tasks, but if they don’t, then it’s key to give agents feedback. We do this via several automated layers of tests that minions can iterate against. The first line of defense is an automated local executable, which uses heuristics to select and automatically run selected lints on each git push. This takes less than five seconds.

We seek to “shift feedback left” when thinking about developer productivity. That means that it’s best for humans and agents if any lint step that would fail in CI is enforced in the IDE or on a git push, and presented to the engineer immediately.

If the local testing doesn’t catch anything, CI selectively runs tests from Stripe’s battery of tests—there are over three million of them—upon a push. Many of our tests have autofixes for failures, which we automatically apply. If a test failure has no autofix, we send it back to the minion to try and fix.

Since CI runs cost tokens, compute, and time, we only have at most two rounds of CI. If tests fail after an initial push, we prompt the minion to fix failing tests and push a second time, but are then done. There’s a balancing act between speed and completeness here, and there are diminishing marginal returns for an LLM to run many rounds of a full CI loop. We feel this guidance of “often one, at most two, CI runs—and only after we’ve fixed everything we can locally” strikes a good balance.

In short, minions are set up with the same tools we give human engineers and the necessary context to follow Stripe best practices in the code they write. And engineers can and do invoke them ergonomically as part of their normal job duties.

What’s next?
Minions have already reimagined what it’s like to code at Stripe. The industry is still exploring what the future of agentic coding will look like, but we’re sure that the unattended code agent use case will remain among the most exciting applications of agents.

In Part 2, we’ll dive more deeply into how we implemented minions.

Interested in working with, or on, minions? We’re hiring.

Minions: Stripe’s one-shot, end-to-end coding agents—Part 2
Minions: Stripe’s one-shot, end-to-end coding agents—Part 2
/
Metadata
Date:
2026.2.19
Author:
Alistair Gray
Reading time:
8 min read
Categories:
AI
Developer Productivity
LLMs
Engineering
Share:
Twitter/X
LinkedIn
/
Article
As a recap of Part 1 in this blog miniseries, minions are a homegrown unattended agentic coding flow at Stripe. Over 1,300 Stripe pull requests (up from 1,000 as of Part 1) merged each week are completely minion-produced, human-reviewed, but containing no human-written code.

If you haven’t read Part 1, we recommend checking that out first to understand the developer experience of using minions. In this post, we’ll dive deeper into some more details of how they’re built, focusing on the Stripe-specific portions of the minion flow.

Devboxes, hot and ready
For maximum effectiveness, unattended agent coding at scale requires a cloud developer environment that’s parallelizable, predictable, and isolated. Humans should be able to give many agents logically separate work. Agents should have clean environments and working directories: it unnecessarily wastes tokens on resolution if agents are interfering with one another’s changes. Full autonomy also requires the agent to be systematically isolated from acting destructively over privileged or sensitive machines, especially with a human’s personal credentials.

It’s challenging to get agents running on a developer’s laptop with all these properties. Containerization or git worktrees can help, but they’re hard to combine and it’s fundamentally difficult to build local agents that have all the power of a developer’s shell but are appropriately constrained.

Minions at Stripe get these properties by default, however, by running on the same standard developer environment that Stripe engineers use: the devbox.

A Stripe devbox is an AWS EC2 instance that contains our source code and runs services under development. Most human-written Stripe code is already produced within an IDE that’s remotely connected to a devbox via SSH. In DevOps terminology, devboxes are “cattle, not pets”: they’re standardized and easy to replace, rather than bespoke and long-lived.

Many engineers use one devbox per task—a Stripe engineer might have half a dozen running at a time.



A snippet of an engineer’s list of active devboxes, with minion runs

We want it to feel effortless to spin up a new devbox, so we aim for it to be ready within 10 seconds. To achieve this “hot and ready” standard, we proactively provision and warm up a pool of devboxes so they are ready when a developer wants them. This includes cloning gigantic git repositories, warming Bazel and type checking caches, starting code generation services that continually run on devboxes, and more. After 10 seconds, the devbox owner has a box checked out to a recent copy of master across all of Stripe’s main repos, which is immediately ready to open a REPL, run a test, make a code change and type check it, or start a web service.

We built out devboxes for the needs of human engineers, long before LLM coding agents existed. As it turns out, parallelism, predictability, and isolation were also very desirable properties as well for Stripe engineers to be able to work most effectively. What’s good for humans is good for agents, and building on this infrastructural primitive paid dividends as a natural home for LLM agents.

The agent
In contrast to devboxes that already powered human development, our agent harness was custom-built for the minions use case.

In late 2024, as coding agents emerged across the industry, we internally forked Block’s goose—one of the first widely used coding agents—and customized it to work within Stripe’s LLM infrastructure. Over time, we focused our feature development of goose on the needs of minions, rather than those of human-supervised tools: that’s a use case that’s well-filled by third-party tools such as Cursor and Claude Code, which are already made available to our engineers.

In fact, the most unique aspect of minions is the absence of a supervisory human. Off-the-shelf local coding agents are usually optimized for working through code changes as a companion to engineers, typically with one “looking over its shoulder,” so to speak. Minions, however, are fully unattended, so our agent harness can’t use human-facing features such as interruptibility or human-triggered commands to initiate or steer the agent run.

On the flip side, the quarantined devbox environment means that the agent doesn’t need confirmation prompts; any mistakes an agent might make are confined to the limited blast radius of one devbox, so we can safely run the agent with full permissions and skip confirmation prompts.

We can also dial in optimizations precisely tuned to Stripe’s development flow. We’ve made many small optimizations based on the particulars of Stripe’s systems. A larger optimization—which turned out to be more fundamental to our implementation of minions—is the notion of a blueprint.

Blueprints
The most common primitives for orchestrating an LLM flow are workflows and agents. A workflow is an LLM system that operates via a fixed graph of steps, where each node in the graph is responsible for a narrowly scoped portion of the overall goal, and predefined edges control the execution flow between these discrete nodes.

On the other hand, an agent is typically a simpler “loop with tools” orchestration pattern, where the LLM relies on its own judgment to repeatedly call the tools at its disposal and decide—based on the results of those tool calls—what to do next.

Minions are orchestrated with a primitive we call “blueprints.” Blueprints are workflows defined in code that direct a minion run. Blueprints combine the determinism of workflows with agents’ flexibility in dealing with the unknown: a given node can run either deterministic code or an agent loop focused on a task. In essence, a blueprint is like a collection of agent skills interwoven with deterministic code so that particular subtasks can be handled most appropriately.

In the blueprint that powers minions, for example, there are agent-like nodes with labels such as “Implement task” or “Fix CI failures.” Those agent nodes are given wide latitude to make their own decisions based on input. However, the blueprint also has nodes with labels such as “Run configured linters” or “Push changes,” which are fully deterministic: those particular nodes don’t invoke an LLM at all—they just run code.

Thus, blueprints are a way to guarantee certain subtasks are completed deterministically within the agentic run. The minion blueprint ends up looking like a state machine that intermixes deterministic code nodes and free-flowing agent nodes.



Example blueprint. Deterministic nodes are indicated with rectangles, and agentic subtasks are indicated with the cloud shape.

In our experience, writing code to deterministically accomplish small decisions we can anticipate—such as “always lint changes at the end of a run”—saves tokens (and CI costs) at scale and gives the agent a little less opportunity to get things wrong. In aggregate, we find that “putting LLMs into contained boxes” compounds into system-wide reliability upside. Blueprint machinery makes context engineering of these subagents easy, whether that consists of constraining tools, modifying system prompts, or simplifying the conversation context as required for the subtask at hand.

Individual teams can also set up blueprints optimized for their specialized needs. For example, we’ve had teams build custom blueprints to encode running tricky LLM-assisted migrations across the codebase that couldn’t be accomplished with a straightforward fully deterministic codemod.

Context gathering: Rule files
In a large codebase such as Stripe’s, an agent set loose without any guidance might encounter trouble following best practices or using the proper libraries, even with good linters. To help with this issue, various agent rule formats—think CLAUDE.md or AGENTS.md—allow agents to “learn” about the codebase automatically as they traverse its directory structure.

Due to the size of our repositories, we use unconditional global rules very judiciously, since otherwise the agent’s whole context window would fill with rules before the agent even starts. Instead, we almost exclusively give minions context from files that are scoped to specific subdirectories or file patterns, automatically attached as the agent traverses the filesystem.

From our perspective, it’s best to avoid duplication of rule files in favor of our agent reading the same context that human-directed agents use. Given that, we standardized on a popular rule format that supported these features—Cursor’s—and modified our harness to allow minions to read those rules in addition to a previous homegrown format.

We also now sync our Cursor rules into a format that Claude Code can read as well, so that our three most popular coding agents (minions, Cursor, and Claude Code) can all benefit from the guidance that lives in rule files that Stripe engineers are scaffolding in our codebase.

Context gathering: MCP
Reading from a filesystem works well for static context gathering, but agents frequently need to dynamically fetch information using networked tool calls. In particular, to fully hydrate user requests, minions need to retrieve information such as internal documentation, ticket details, build statuses, code intelligence, and more. Upon release, the Model Context Protocol (MCP) quickly became the industry-wide standard for networked tool calls, and we moved to integrate minions with it.

Stripe has built or integrated lots of agents running on different frameworks: a no-code internal agent builder, custom agents running on dedicated services, third-party off-the-shelf agents, command-line agentic tools and other coding agents, and agentic Slack bots. All these agents, not just minions, needed MCP capabilities, often including overlapping sets of common tools.

To support all of these, we built a centralized internal MCP server called Toolshed, which makes it easy for Stripe engineers to author new tools and make them automatically discoverable to our agentic systems. All our agentic systems are able to use Toolshed as a shared capability layer; adding a tool to Toolshed immediately grants capabilities to our whole fleet of hundreds of different agents.

Toolshed currently contains nearly 500 MCP tools for internal systems and SaaS platforms we use at Stripe. Agents perform best when given a “smaller box” with a tastefully curated set of tools, so we configure different agents to request only a subset of Toolshed tools relevant to their task. Minions are no exception and are provided an intentionally small subset of tools by default, although per-user customizability allows engineers to configure additional thematically grouped sets of tools for their own minions to use.

Since minions operate autonomously with full freedom to call their MCP tools, we also have an internal security control framework that ensures they can’t use their tools to perform destructive actions. As a first line of defense, though, our devboxes already run in our QA environment, and consequently, minions don’t have access to real user data, Stripe’s production services, or arbitrary network egress. This is no accident: we built isolated devboxes deliberately, so humans have an environment they can experiment within safely. But, as with so much else, a development environment that’s safe for humans has proven to be just as useful for minions.

… and iterate
While we build minions with the goal of one-shotting their tasks, it’s key to give agents automated feedback that they can iterate against to make progress. Stripe’s enormous preexisting battery of tests—over three million of them—can provide this feedback. However, while a pushed branch will run all relevant tests in CI, we don’t want to rely too heavily on CI for all our code feedback.

We try to operate under the principle of “shifting feedback left” when thinking about developer productivity. That phrase means that if we know an automated check will fail CI, it’s best if it’s also enforced in the IDE and presented to the engineer right away, since that’s the fastest way to provide feedback to the user.

For example, we have pre-push hooks to fix the most common lint issues. A background daemon precomputes lint rule heuristics that apply to a change and caches the results of running those lints, so developers can usually get lint fixes in well under a second on a push.

Minions naturally integrate with this framework as well, so they don’t have to waste tokens or CI minutes by iterating against an auto-formatter or similar. We run a subset of linters as a deterministic node within the agent devloop blueprint, and loop on that lint node locally before pushing an agent’s branch, so that the branch has a fair shot at passing CI the first time around.

It’s infeasible to run all tests locally, so we also include one iteration against the full CI suite into the standard minion blueprint. After a minion pushes a change, we run CI and auto-apply any autofixes for failing tests. If there are failures with no autofix, we send the failure back to a blueprint agent node and give the minion one more chance to fix the failing test locally. After the second push and CI run, we send the branch back to its human operator for manual scrutiny.

Why have only one or two rounds of CI? There’s a balancing act between speed and completeness here; CI runs cost tokens, compute, and time, and we think there are diminishing marginal returns if an LLM is running against indefinitely many rounds of a full CI loop. We feel that our policy strikes a good balance between the competing considerations here.

In conclusion
Minions are just one way that Stripe is using AI to accelerate our engineers, but we think they’re a great example of how we’re able to blend industry-standard concepts—such as agent harnesses and MCP—with our own mix of internal tooling and infrastructure that our engineers have relentlessly tuned over the years to maximize developer productivity.

Whether it’s through improving documentation, developer environments, or iteration loops, we’ve found time and time again that our investments in human developer productivity over time have returned to pay dividends in the world of agents.

Minions have already changed the landscape of software engineering at Stripe. We’re continuing to make them better as we build out our agent experience with the latest and greatest from the industry at large, adapted to work at Stripe scale. Combined with the taste and expertise we’ve learned in hard-fought battles for human developer experience, we’ll make them the best they can be.