# Search Index: Codex SDK
Source: https://developers.openai.com/codex/sdk | Captured: 2026-03-07 | Files: 17 | ~243KB total

## Quick Reference
| File | Category | Summary |
|------|----------|---------|
| overview.md | Getting Started | Codex is OpenAI's coding agent for writing, reviewing, debugging code |
| quickstart.md | Getting Started | Setup instructions for App, IDE extension, CLI, and Cloud surfaces |
| sdk.md | SDK | TypeScript library to control Codex programmatically from Node.js 18+ |
| cli.md | CLI | Codex CLI overview: open-source terminal agent built in Rust |
| cli-reference.md | CLI Reference | Complete catalog of every CLI command, subcommand, and flag |
| cli-features.md | CLI Features | Interactive mode, resume, models, images, review, web search, themes |
| config-basic.md | Configuration | Config file locations, precedence, common options, feature flags |
| config-reference.md | Configuration | Searchable reference for all config.toml and requirements.toml keys |
| mcp.md | Integration | Model Context Protocol setup for third-party tools and context |
| skills.md | Customization | Agent skills: reusable task-specific capabilities with SKILL.md |
| github-action.md | CI/CD | GitHub Action (openai/codex-action@v1) for CI jobs and PR reviews |
| noninteractive.md | CI/CD | Non-interactive codex exec for scripts, pipelines, and automation |
| app-server.md | API | App-server JSON-RPC protocol for rich client integrations |
| guides-agents-sdk.md | Guide | Run Codex as MCP server with OpenAI Agents SDK for multi-agent workflows |
| concepts-customization.md | Concepts | Customization layers: AGENTS.md, Skills, MCP, multi-agents |
| multi-agent.md | Multi-Agent | Multi-agent setup, agent roles, CSV batch processing, approvals |
| concepts-multi-agents.md | Concepts | Multi-agent concepts: context pollution, model selection tradeoffs |

## Heading Outlines
### overview.md (68 lines)
- # Codex

### quickstart.md (423 lines)
- # Quickstart
  - ## Setup

### sdk.md (58 lines)
- # Codex SDK
  - ## TypeScript library
    - ### Installation
    - ### Usage

### cli.md (103 lines)
- # Codex CLI
  - ## CLI setup
  - ## Work with the Codex CLI
    - ### Run Codex interactively
    - ### Control model and reasoning
    - ### Image inputs
    - ### Run local code review
    - ### Use multi-agent
    - ### Web search
    - ### Codex Cloud tasks
    - ### Scripting Codex
    - ### Model Context Protocol
    - ### Approval modes

### cli-reference.md (858 lines)
- # Command line options
  - ## How to read this reference
  - ## Global flags
  - ## Command overview
  - ## Command details
    - ### `codex` (interactive)
    - ### `codex app-server`
    - ### `codex app`
    - ### `codex debug app-server send-message-v2`
    - ### `codex apply`
    - ### `codex cloud`
    - ### `codex completion`
    - ### `codex features`
    - ### `codex exec`
    - ### `codex execpolicy`
    - ### `codex login`
    - ### `codex logout`
    - ### `codex mcp`
    - ### `codex mcp-server`
    - ### `codex resume`
    - ### `codex fork`
    - ### `codex sandbox`
  - ## Flag combinations and safety tips
  - ## Related resources

### cli-features.md (200 lines)
- # Codex CLI features
  - ## Running in interactive mode
  - ## Resuming conversations
  - ## Models and reasoning
  - ## Feature flags
  - ## Multi-agents (experimental)
  - ## Image inputs
  - ## Syntax highlighting and themes
  - ## Running local code review
  - ## Web search
  - ## Running with an input prompt
  - ## Shell completions
  - ## Approval modes
  - ## Scripting Codex
  - ## Working with Codex cloud
  - ## Slash commands
  - ## Prompt editor
  - ## Model Context Protocol (MCP)
  - ## Tips and shortcuts

### config-basic.md (178 lines)
- # Config basics
  - ## Codex configuration file
  - ## Configuration precedence
  - ## Common configuration options
  - ## Feature flags
    - ### Supported features
    - ### Enabling features

### config-reference.md (1344 lines)
- # Configuration Reference
  - ## `config.toml`
  - ## `requirements.toml`

### mcp.md (125 lines)
- # Model Context Protocol
  - ## Supported MCP features
  - ## Connect Codex to an MCP server
    - ### Configure with the CLI
    - ### Configure with config.toml
  - ## Examples of useful MCP servers

### skills.md (152 lines)
- # Agent Skills
  - ## How Codex uses skills
  - ## Create a skill
  - ## Where to save skills
  - ## Install skills
  - ## Enable or disable skills
  - ## Optional metadata
  - ## Best practices

### github-action.md (121 lines)
- # Codex GitHub Action
  - ## Prerequisites
  - ## Example workflow
  - ## Configure `codex exec`
  - ## Manage privileges
  - ## Capture outputs
  - ## Security checklist
  - ## Troubleshooting

### noninteractive.md (237 lines)
- # Non-interactive mode
  - ## When to use `codex exec`
  - ## Basic usage
  - ## Permissions and safety
  - ## Make output machine-readable
  - ## Create structured outputs with a schema
  - ## Authenticate in CI
  - ## Resume a non-interactive session
  - ## Git repository required
  - ## Common automation patterns

### app-server.md (1437 lines)
- # Codex App Server
  - ## Protocol
  - ## Message schema
  - ## Getting started
  - ## Core primitives
  - ## Lifecycle overview
  - ## Initialization
  - ## Experimental API opt-in
  - ## API overview
  - ## Models
    - ### List models (`model/list`)
    - ### List experimental features (`experimentalFeature/list`)
  - ## Threads
    - ### Start or resume a thread
    - ### Read a stored thread (without resuming)
    - ### List threads (with pagination & filters)
    - ### Track thread status changes
    - ### List loaded threads
    - ### Unsubscribe from a loaded thread
    - ### Archive a thread
    - ### Unarchive a thread
    - ### Trigger thread compaction
    - ### Roll back recent turns
  - ## Turns
    - ### Sandbox read access (`ReadOnlyAccess`)
    - ### Start a turn
    - ### Steer an active turn
    - ### Start a turn (invoke a skill)
    - ### Interrupt a turn
  - ## Review
  - ## Command execution
    - ### Read admin requirements (`configRequirements/read`)
    - ### Windows sandbox setup (`windowsSandbox/setupStart`)
  - ## Events
    - ### Notification opt-out
    - ### Fuzzy file search events (experimental)
    - ### Windows sandbox setup events
    - ### Turn events
    - ### Items
    - ### Item deltas
  - ## Errors
  - ## Approvals
    - ### Command execution approvals
    - ### File change approvals
    - ### `tool/requestUserInput`
    - ### Dynamic tool calls (experimental)
    - ### MCP tool-call approvals (apps)
  - ## Skills
  - ## Apps (connectors)
    - ### Config RPC examples for app settings
    - ### Detect and import external agent config
  - ## Auth endpoints
    - ### Authentication modes
    - ### API overview
    - ### 1) Check auth state
    - ### 2) Log in with an API key
    - ### 3) Log in with ChatGPT (browser flow)
    - ### 3b) Log in with externally managed ChatGPT tokens
    - ### 4) Cancel a ChatGPT login
    - ### 5) Logout
    - ### 6) Rate limits (ChatGPT)

### guides-agents-sdk.md (409 lines)
- # Use Codex with the Agents SDK
- # Running Codex as an MCP server
- # Creating multi-agent workflows
  - ## Install dependencies
  - ## Initialize Codex CLI as an MCP server
  - ## Build a single-agent workflow
  - ## Expand to a multi-agent workflow
  - ## Trace the workflow

### concepts-customization.md (171 lines)
- # Customization
  - ## AGENTS Guidance
    - ### When to update `AGENTS.md`
  - ## Skills
  - ## MCP
  - ## Multi-agents
  - ## Skills + MCP together
  - ## Next step

### multi-agent.md (310 lines)
- # Multi-agents
  - ## Enable multi-agent
  - ## Typical workflow
  - ## Managing sub-agents
  - ## Process CSV batches with sub-agents
  - ## Approvals and sandbox controls
  - ## Agent roles
    - ### Schema
    - ### Example agent roles

### concepts-multi-agents.md (52 lines)
- # Multi-agents
  - ## Why multi-agent workflows help
  - ## Core terms
  - ## Choosing models and reasoning
    - ### Model choice
    - ### Reasoning effort (`model_reasoning_effort`)

## API Elements
**Classes:** `Codex` -> sdk.md

**Functions/Methods:** `codex.startThread()` -> sdk.md | `thread.run()` -> sdk.md | `codex.resumeThread()` -> sdk.md | `codex()` MCP tool -> guides-agents-sdk.md | `codex-reply()` MCP tool -> guides-agents-sdk.md | `spawn_agents_on_csv()` -> multi-agent.md | `report_agent_job_result()` -> multi-agent.md

**CLI Commands:** `codex` -> cli-reference.md | `codex exec` -> cli-reference.md, noninteractive.md | `codex app-server` -> cli-reference.md, app-server.md | `codex app` -> cli-reference.md | `codex apply` -> cli-reference.md | `codex cloud` -> cli-reference.md | `codex completion` -> cli-reference.md | `codex features` -> cli-reference.md | `codex execpolicy` -> cli-reference.md | `codex login` -> cli-reference.md | `codex logout` -> cli-reference.md | `codex mcp` -> cli-reference.md, mcp.md | `codex mcp-server` -> cli-reference.md, guides-agents-sdk.md | `codex resume` -> cli-reference.md | `codex fork` -> cli-reference.md | `codex sandbox` -> cli-reference.md

**CLI Flags:** `--model, -m` -> cli-reference.md | `--image, -i` -> cli-reference.md | `--sandbox, -s` -> cli-reference.md | `--ask-for-approval, -a` -> cli-reference.md | `--full-auto` -> cli-reference.md | `--yolo` -> cli-reference.md | `--cd, -C` -> cli-reference.md | `--search` -> cli-reference.md | `--add-dir` -> cli-reference.md | `--json` -> cli-reference.md | `--output-last-message, -o` -> cli-reference.md | `--output-schema` -> cli-reference.md, noninteractive.md | `--oss` -> cli-reference.md | `--profile, -p` -> cli-reference.md | `--config, -c` -> cli-reference.md | `--enable` / `--disable` -> cli-reference.md | `--ephemeral` -> cli-reference.md | `--skip-git-repo-check` -> cli-reference.md | `--no-alt-screen` -> cli-reference.md

**Config Options:** `model` -> config-basic.md, config-reference.md | `review_model` -> config-reference.md | `model_provider` -> config-reference.md | `model_context_window` -> config-reference.md | `model_reasoning_effort` -> config-basic.md, config-reference.md | `approval_policy` -> config-basic.md, config-reference.md | `sandbox_mode` -> config-basic.md, config-reference.md | `web_search` -> config-basic.md, config-reference.md | `personality` -> config-basic.md | `log_dir` -> config-basic.md | `shell_environment_policy` -> config-basic.md | `[features]` -> config-basic.md | `[mcp_servers.*]` -> mcp.md, config-reference.md | `[agents.*]` -> multi-agent.md | `agents.max_threads` -> multi-agent.md | `agents.max_depth` -> multi-agent.md | `agents.job_max_runtime_seconds` -> multi-agent.md | `[[skills.config]]` -> skills.md

**App-Server Methods:** `thread/start` -> app-server.md | `thread/read` -> app-server.md | `thread/list` -> app-server.md | `thread/subscribe` -> app-server.md | `thread/unsubscribe` -> app-server.md | `thread/archive` -> app-server.md | `thread/unarchive` -> app-server.md | `thread/compact` -> app-server.md | `thread/rollback` -> app-server.md | `turn/start` -> app-server.md | `turn/steer` -> app-server.md | `turn/cancel` -> app-server.md | `model/list` -> app-server.md | `experimentalFeature/list` -> app-server.md | `configRequirements/read` -> app-server.md

**Feature Flags:** `multi_agent` -> config-basic.md, multi-agent.md | `shell_snapshot` -> config-basic.md | `unified_exec` -> config-basic.md | `collaboration_modes` -> config-basic.md | `personality` -> config-basic.md | `request_rule` -> config-basic.md | `shell_tool` -> config-basic.md | `undo` -> config-basic.md | `apps` -> config-basic.md | `use_linux_sandbox_bwrap` -> config-basic.md

**Types/Events (app-server):** `thread.started` -> noninteractive.md | `turn.started` -> noninteractive.md | `turn.completed` -> noninteractive.md | `turn.failed` -> noninteractive.md | `item.started` -> noninteractive.md | `item.completed` -> noninteractive.md | `ReadOnlyAccess` -> app-server.md

**Slash Commands:** `/review` -> cli-features.md | `/model` -> cli-features.md | `/theme` -> cli-features.md | `/permissions` -> cli-features.md | `/clear` -> cli-features.md | `/copy` -> cli-features.md | `/exit` -> cli-features.md | `/mcp` -> mcp.md | `/agent` -> multi-agent.md | `/experimental` -> multi-agent.md | `/skills` -> skills.md

## Task Map
- Install/setup Codex -> quickstart.md, cli.md
- Use Codex programmatically (SDK) -> sdk.md
- Run Codex non-interactively in CI -> noninteractive.md, github-action.md
- Configure models, sandbox, approvals -> config-basic.md, config-reference.md
- Add MCP servers for external tools -> mcp.md, concepts-customization.md
- Create/manage agent skills -> skills.md, concepts-customization.md
- Set up multi-agent workflows -> multi-agent.md, concepts-multi-agents.md
- Build Agents SDK integration -> guides-agents-sdk.md
- Build custom client via app-server -> app-server.md
- Review code with Codex -> cli-features.md
- Customize with AGENTS.md -> concepts-customization.md
- Automate PR reviews in GitHub Actions -> github-action.md, noninteractive.md
- Configure feature flags -> config-basic.md
- Resume/fork conversations -> cli-features.md, cli-reference.md
- Use web search -> cli-features.md, config-basic.md
- Process CSV batches with sub-agents -> multi-agent.md
- Manage sandbox and security -> cli-reference.md, config-basic.md
- Authenticate Codex (login/API key) -> cli-reference.md, noninteractive.md
