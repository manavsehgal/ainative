# Multi-agents

Codex can run multi-agent workflows by spawning specialized agents in parallel and then collecting their results in one response. This can be particularly helpful for complex tasks that are highly parallel, such as codebase exploration or implementing a multi-step feature plan.

With multi-agent workflows you can also define your own set of agents with different model configurations and instructions depending on the agent.

For the concepts and tradeoffs behind multi-agent workflows (including context pollution/context rot and model-selection guidance), see [Multi-agents concepts](https://developers.openai.com/codex/concepts/multi-agents).

## Enable multi-agent

Multi-agent workflows are currently experimental and need to be explicitly enabled.

You can enable this feature from the CLI with `/experimental`. Enable
**Multi-agents**, then restart Codex.

Multi-agent activity is currently surfaced in the CLI. Visibility in other
  surfaces (the Codex app and IDE Extension) is coming soon.

You can also add the [`multi_agent` feature flag](https://developers.openai.com/codex/config-basic#feature-flags) directly to your configuration file (`~/.codex/config.toml`):

```toml
[features]
multi_agent = true
```

## Typical workflow

Codex handles orchestration across agents, including spawning new sub-agents, routing follow-up instructions, waiting for results, and closing agent threads.

When many agents are running, Codex waits until all requested results are available, then returns a consolidated response.

Codex will automatically decide when to spawn a new agent or you can explicitly ask it to do so.

For long-running commands or polling workflows, Codex can also use the built-in `monitor` role, which is tuned for waiting and repeated status checks.

To see it in action, try the following prompt on your project:

```text
I would like to review the following points on the current PR (this branch vs main). Spawn one agent per point, wait for all of them, and summarize the result for each point.
1. Security issue
2. Code quality
3. Bugs
4. Race
5. Test flakiness
6. Maintainability of the code
```

## Managing sub-agents

- Use `/agent` in the CLI to switch between active agent threads and inspect the ongoing thread.
- Ask Codex directly to steer a running sub-agent, stop it, or close completed agent threads.
- The `wait` tool supports long polling windows for monitoring workflows (up to 1 hour per call).

## Process CSV batches with sub-agents

Use `spawn_agents_on_csv` when you have many similar tasks that can be expressed as one row per work item. Codex reads the CSV, spawns one worker sub-agent per row, waits for the full batch to finish, and exports the combined results to CSV.

This works well for repeated audits such as:

- reviewing one file, package, or service per row
- checking a list of incidents, PRs, or migration targets
- generating structured summaries for many similar inputs

The tool accepts:

- `csv_path` for the source CSV
- `instruction` for the worker prompt template, using `{column_name}` placeholders
- `id_column` when you want stable item ids from a specific column
- `output_schema` when each worker should return a JSON object with a fixed shape
- `output_csv_path`, `max_concurrency`, and `max_runtime_seconds` for job control

Each worker must call `report_agent_job_result` exactly once. If a worker exits without reporting a result, that row is marked as failed in the exported CSV.

Example prompt:

```text
Create /tmp/components.csv with columns path,owner and one row per frontend component.

Then call spawn_agents_on_csv with:
- csv_path: /tmp/components.csv
- id_column: path
- instruction: "Review {path} owned by {owner}. Return JSON with keys path, risk, summary, and follow_up via report_agent_job_result."
- output_csv_path: /tmp/components-review.csv
- output_schema: an object with required string fields path, risk, summary, and follow_up
```

When you run this through `codex exec`, Codex shows a single-line progress update on `stderr` while the batch is running. The exported CSV includes the original row data plus metadata such as `job_id`, `item_id`, `status`, `last_error`, and `result_json`.

Related runtime settings:

- `agents.max_threads` caps how many agent threads can stay open concurrently.
- `agents.job_max_runtime_seconds` sets the default per-worker timeout for CSV fan-out jobs. A per-call `max_runtime_seconds` override takes precedence.
- `sqlite_home` controls where Codex stores the SQLite-backed state used for agent jobs and their exported results.

## Approvals and sandbox controls

Sub-agents inherit your current sandbox policy.

In interactive CLI sessions, approval requests can surface from inactive agent
threads even while you are looking at the main thread. The approval overlay
shows the source thread label, and you can press `o` to open that thread before
you approve, reject, or answer the request.

In non-interactive flows, or whenever a run cannot surface a fresh approval,
an action that needs new approval fails and the error is surfaced back to the
parent workflow.

Codex also reapplies the parent turn's live runtime overrides when it spawns a
child. That includes sandbox and approval choices you set interactively during
the session, such as `/approvals` changes or `--yolo`, even if the selected
agent role loads a config file with different defaults.

You can also override the sandbox configuration for individual [agent roles](#agent-roles) such as explicitly marking an agent to work in read-only mode.

## Agent roles

You configure agent roles in the `[agents]` section of your [configuration](https://developers.openai.com/codex/config-basic#configuration-precedence).

Agent roles can be defined either in your local configuration (typically `~/.codex/config.toml`) or shared in a project-specific `.codex/config.toml`.

Each role can provide guidance (`description`) for when Codex should use this agent, and optionally load a
role-specific config file (`config_file`) when Codex spawns an agent with that role.

Codex ships with built-in roles:

- `default`: general-purpose fallback role.
- `worker`: execution-focused role for implementation and fixes.
- `explorer`: read-heavy codebase exploration role.
- `monitor`: long-running command/task monitoring role (optimized for waiting/polling).

Each agent role can override your default configuration. Common settings to override for an agent role are:

- `model` and `model_reasoning_effort` to select a specific model for your agent role
- `sandbox_mode` to mark an agent as `read-only`
- `developer_instructions` to give the agent role additional instructions without relying on the parent agent for passing them

### Schema

| Field                            | Type          | Required | Purpose                                                                       |
| -------------------------------- | ------------- | :------: | ----------------------------------------------------------------------------- |
| `agents.max_threads`             | number        |    No    | Maximum number of concurrently open agent threads.                            |
| `agents.max_depth`               | number        |    No    | Maximum nesting depth for spawned agent threads (root session starts at 0).   |
| `agents.job_max_runtime_seconds` | number        |    No    | Default timeout per worker for `spawn_agents_on_csv` jobs.                    |
| `[agents.<name>]`                | table         |    No    | Declares a role. `<name>` is used as the `agent_type` when spawning an agent. |
| `agents.<name>.description`      | string        |    No    | Human-facing role guidance shown to Codex when it decides which role to use.  |
| `agents.<name>.config_file`      | string (path) |    No    | Path to a TOML config layer applied to spawned agents for that role.          |

**Notes:**

- Unknown fields in `[agents.<name>]` are rejected.
- `agents.max_depth` defaults to `1`, which allows a direct child agent to spawn but prevents deeper nesting.
- `agents.job_max_runtime_seconds` is optional. When you leave it unset, `spawn_agents_on_csv` falls back to its per-call default timeout of 1800 seconds per worker.
- Relative `config_file` paths are resolved relative to the `config.toml` file that defines the role.
- `agents.<name>.config_file` is validated at config load time and must point to an existing file.
- If a role name matches a built-in role (for example, `explorer`), your user-defined role takes precedence.
- If Codex can't load a role config file, agent spawns can fail until you fix the file.
- Any configuration not set by the agent role will be inherited from the parent session.

### Example agent roles

The best role definitions are narrow and opinionated. Give each role one clear job, a tool surface that matches that job, and instructions that keep it from drifting into adjacent work.

#### Example 1: PR review team

This pattern splits review into three focused roles:

- `explorer` maps the codebase and gathers evidence.
- `reviewer` looks for correctness, security, and test risks.
- `docs_researcher` checks framework or API documentation through a dedicated MCP server.

Project config (`.codex/config.toml`):

```toml
[agents]
max_threads = 6
max_depth = 1

[agents.explorer]
description = "Read-only codebase explorer for gathering evidence before changes are proposed."
config_file = "agents/explorer.toml"

[agents.reviewer]
description = "PR reviewer focused on correctness, security, and missing tests."
config_file = "agents/reviewer.toml"

[agents.docs_researcher]
description = "Documentation specialist that uses the docs MCP server to verify APIs and framework behavior."
config_file = "agents/docs-researcher.toml"
```

`agents/explorer.toml`:

```toml
model = "gpt-5.3-codex-spark"
model_reasoning_effort = "medium"
sandbox_mode = "read-only"
developer_instructions = """
Stay in exploration mode.
Trace the real execution path, cite files and symbols, and avoid proposing fixes unless the parent agent asks for them.
Prefer fast search and targeted file reads over broad scans.
"""
```

`agents/reviewer.toml`:

```toml
model = "gpt-5.3-codex"
model_reasoning_effort = "high"
sandbox_mode = "read-only"
developer_instructions = """
Review code like an owner.
Prioritize correctness, security, behavior regressions, and missing test coverage.
Lead with concrete findings, include reproduction steps when possible, and avoid style-only comments unless they hide a real bug.
"""
```

`agents/docs-researcher.toml`:

```toml
model = "gpt-5.3-codex-spark"
model_reasoning_effort = "medium"
sandbox_mode = "read-only"
developer_instructions = """
Use the docs MCP server to confirm APIs, options, and version-specific behavior.
Return concise answers with links or exact references when available.
Do not make code changes.
"""

[mcp_servers.openaiDeveloperDocs]
url = "https://developers.openai.com/mcp"
```

This setup works well for prompts like:

```text
Review this branch against main. Have explorer map the affected code paths, reviewer find real risks, and docs_researcher verify the framework APIs that the patch relies on.
```

#### Example 2: frontend integration debugging team

This pattern is useful for UI regressions, flaky browser flows, or integration bugs that cross application code and the running product.

Project config (`.codex/config.toml`):

```toml
[agents]
max_threads = 6
max_depth = 1

[agents.explorer]
description = "Read-only codebase explorer for locating the relevant frontend and backend code paths."
config_file = "agents/explorer.toml"

[agents.browser_debugger]
description = "UI debugger that uses browser tooling to reproduce issues and capture evidence."
config_file = "agents/browser-debugger.toml"

[agents.worker]
description = "Implementation-focused agent for small, targeted fixes after the issue is understood."
config_file = "agents/worker.toml"
```

`agents/explorer.toml`:

```toml
model = "gpt-5.3-codex-spark"
model_reasoning_effort = "medium"
sandbox_mode = "read-only"
developer_instructions = """
Map the code that owns the failing UI flow.
Identify entry points, state transitions, and likely files before the worker starts editing.
"""
```

`agents/browser-debugger.toml`:

```toml
model = "gpt-5.3-codex"
model_reasoning_effort = "high"
sandbox_mode = "workspace-write"
developer_instructions = """
Reproduce the issue in the browser, capture exact steps, and report what the UI actually does.
Use browser tooling for screenshots, console output, and network evidence.
Do not edit application code.
"""

[mcp_servers.chrome_devtools]
url = "http://localhost:3000/mcp"
startup_timeout_sec = 20
```

`agents/worker.toml`:

```toml
model = "gpt-5.3-codex"
model_reasoning_effort = "medium"
developer_instructions = """
Own the fix once the issue is reproduced.
Make the smallest defensible change, keep unrelated files untouched, and validate only the behavior you changed.
"""

[[skills.config]]
path = "/Users/me/.agents/skills/docs-editor/SKILL.md"
enabled = false
```

This setup works well for prompts like:

```text
Investigate why the settings modal fails to save. Have browser_debugger reproduce it, explorer trace the responsible code path, and worker implement the smallest fix once the failure mode is clear.
```