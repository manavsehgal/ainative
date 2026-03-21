# Search Index: Claude Agent SDK
Source: https://platform.claude.com/docs/en/agent-sdk/overview | Captured: 2026-03-07 | Files: 27 | ~496KB total

## Quick Reference

| File | Category | Summary |
|------|----------|---------|
| overview.md | Getting Started | SDK overview, capabilities, architecture, comparison to other Claude tools |
| quickstart.md | Getting Started | Step-by-step setup, create a bug-fixing agent, key concepts |
| agent-loop.md | Core Concepts | Message lifecycle, tool execution, context window, turns, hooks |
| claude-code-features.md | Core Concepts | Load CLAUDE.md, skills, hooks, settingSources into SDK agents |
| permissions.md | Configuration | Permission modes (acceptEdits, bypassPermissions, plan), canUseTool callback |
| modifying-system-prompts.md | Configuration | CLAUDE.md, output styles, systemPrompt append, custom system prompts |
| python.md | API Reference | Complete Python API: query(), tool(), ClaudeSDKClient, all types/classes (2396 lines) |
| typescript.md | API Reference | Complete TypeScript API: query(), tool(), Options, all types/interfaces (2182 lines) |
| typescript-v2-preview.md | API Reference | V2 preview: session-based createSession/prompt patterns |
| hooks.md | Features | Pre/post tool hooks, matchers, validation, security controls, notifications |
| custom-tools.md | Features | Build custom tools via in-process MCP servers, type safety, error handling |
| mcp.md | Features | MCP server config, transport types (stdio/HTTP/SSE), tool search, auth |
| subagents.md | Features | Spawn subagents for parallel tasks, context isolation, tool restrictions |
| skills.md | Features | Agent Skills (SKILL.md), loading, tool restrictions, testing |
| plugins.md | Features | Load plugins for commands, agents, skills, hooks via SDK |
| structured-outputs.md | Features | Return validated JSON via JSON Schema, Zod, or Pydantic |
| streaming-output.md | Features | Real-time streaming of text and tool calls, StreamEvent reference |
| streaming-vs-single-mode.md | Features | Streaming input vs single message input modes |
| user-input.md | Features | Handle tool approval requests and clarifying questions from Claude |
| sessions.md | Features | Session IDs, resuming sessions, forking sessions |
| file-checkpointing.md | Features | Track file changes, restore to previous states, checkpoint patterns |
| slash-commands.md | Features | Send slash commands (/compact, /clear), create custom commands |
| todo-tracking.md | Features | Todo lifecycle, monitoring changes, real-time progress display |
| cost-tracking.md | Operations | Token usage tracking, billing, usage reporting, per-model breakdown |
| hosting.md | Operations | Container sandboxing, deployment patterns (ephemeral/long-running/hybrid) |
| secure-deployment.md | Operations | Isolation (sandbox/containers/gVisor/VMs), credential proxy, filesystem config |
| migration-guide.md | Operations | Migrate from Claude Code SDK to Claude Agent SDK, breaking changes |

## Heading Outlines

### overview.md (575 lines)
- ## Capabilities
- ### Claude Code features
- ## Get started
- ## Compare the Agent SDK to other Claude tools
- ## Changelog
- ## Reporting bugs
- ## Branding guidelines
- ## License and terms
- ## Next steps

### quickstart.md (330 lines)
- ## Prerequisites
- ## Setup
- ## Create a buggy file
- ## Build an agent that finds and fixes bugs
- ### Run your agent
- ### Try other prompts
- ### Customize your agent
- ## Key concepts
- ## Next steps

### agent-loop.md (261 lines)
- ## The loop at a glance
- ## Turns and messages
- ## Message types
- ### Handle messages
- ## Tool execution
- ### Built-in tools
- ### Tool permissions
- ### Parallel tool execution
- ## Control how the loop runs
- ### Turns and budget
- ### Effort level
- ### Permission mode
- ### Model
- ## The context window
- ### What consumes context
- ### Automatic compaction
- ### Keep context efficient
- ## Sessions and continuity
- ## Handle the result
- ## Hooks
- ## Full example
- ## Next steps

### claude-code-features.md (192 lines)
- ## Enable Claude Code features with settingSources
- ## Project instructions (CLAUDE.md and rules)
- ### CLAUDE.md load locations
- ## Skills
- ## Hooks
- ### When to use which hook type
- ## Choose the right feature

### permissions.md (201 lines)
- ## How permissions are evaluated
- ## Permission modes
- ### Available modes
- ### Set permission mode
- ### Mode details
- #### Accept edits mode (`acceptEdits`)
- #### Bypass permissions mode (`bypassPermissions`)
- #### Plan mode (`plan`)
- ## Related resources

### modifying-system-prompts.md (495 lines)
- ## Understanding system prompts
- ## Methods of modification
- ### Method 1: CLAUDE.md files (project-level instructions)
- ### Method 2: Output styles (persistent configurations)
- ### Method 3: Using `systemPrompt` with append
- ### Method 4: Custom system prompts
- ## Comparison of all four approaches
- ## Use cases and best practices
- ## Combining approaches
- ## See also

### python.md (2396 lines)
- ## Installation
- ## Choosing Between `query()` and `ClaudeSDKClient`
- ## Functions
  - ### `query()`
  - ### `tool()`
  - ### `create_sdk_mcp_server()`
- ## Classes
  - ### `ClaudeSDKClient`
- ## Types
  - ### `SdkMcpTool`
  - ### `ClaudeAgentOptions`
  - ### `OutputFormat`
  - ### `SystemPromptPreset`
  - ### `SettingSource`
  - ### `AgentDefinition`
  - ### `PermissionMode`
  - ### `CanUseTool`
  - ### `ToolPermissionContext`
  - ### `PermissionResult`
  - ### `PermissionResultAllow`
  - ### `PermissionResultDeny`
  - ### `PermissionUpdate`
  - ### `SdkBeta`
  - ### `McpSdkServerConfig`
  - ### `McpServerConfig`
  - ### `SdkPluginConfig`
- ## Message Types
  - ### `Message`
  - ### `UserMessage`
  - ### `AssistantMessage`
  - ### `SystemMessage`
  - ### `ResultMessage`
  - ### `StreamEvent`
- ## Content Block Types
  - ### `ContentBlock`
  - ### `TextBlock`
  - ### `ThinkingBlock`
  - ### `ToolUseBlock`
  - ### `ToolResultBlock`
- ## Error Types
  - ### `ClaudeSDKError`
  - ### `CLINotFoundError`
  - ### `CLIConnectionError`
  - ### `ProcessError`
  - ### `CLIJSONDecodeError`
- ## Hook Types
  - ### `HookEvent`
  - ### `HookCallback`
  - ### `HookContext`
  - ### `HookMatcher`
  - ### `HookInput`
  - ### `BaseHookInput`
  - ### `PreToolUseHookInput`
  - ### `PostToolUseHookInput`
  - ### `UserPromptSubmitHookInput`
  - ### `StopHookInput`
  - ### `SubagentStopHookInput`
  - ### `PreCompactHookInput`
  - ### `HookJSONOutput`
- ## Tool Input/Output Types
  - ### Task, AskUserQuestion, Bash, Edit, Read, Write, Glob, Grep
  - ### NotebookEdit, WebFetch, WebSearch, TodoWrite, BashOutput
  - ### KillBash, ExitPlanMode, ListMcpResources, ReadMcpResource
- ## Advanced Features with ClaudeSDKClient
- ## Example Usage
- ## Sandbox Configuration
  - ### `SandboxSettings`
  - ### `SandboxNetworkConfig`
  - ### `SandboxIgnoreViolations`
- ## See also

### typescript.md (2182 lines)
- ## Installation
- ## Functions
  - ### `query()`
  - ### `tool()`
  - ### `createSdkMcpServer()`
- ## Types
  - ### `Options`
  - ### `Query`
  - ### `AgentDefinition`
  - ### `SettingSource`
  - ### `PermissionMode`
  - ### `CanUseTool`
  - ### `PermissionResult`
  - ### `McpServerConfig`
  - ### `SdkPluginConfig`
- ## Message Types
  - ### `SDKMessage`
  - ### `SDKAssistantMessage`
  - ### `SDKUserMessage`
  - ### `SDKResultMessage`
  - ### `SDKSystemMessage`
  - ### `SDKPartialAssistantMessage`
  - ### `SDKCompactBoundaryMessage`
  - ### `SDKPermissionDenial`
- ## Hook Types
  - ### `HookEvent`
  - ### `HookCallback`
  - ### `HookCallbackMatcher`
  - ### `HookInput`
  - ### `BaseHookInput`
  - ### (PreToolUse, PostToolUse, Notification, UserPromptSubmit, SessionStart/End, Stop, SubagentStart/Stop, PreCompact, PermissionRequest)
  - ### `HookJSONOutput`
- ## Tool Input Types
  - ### `ToolInput`, Task, AskUserQuestion, Bash, Edit, Read, Write, Glob, Grep
  - ### NotebookEdit, WebFetch, WebSearch, TodoWrite, ExitPlanMode, ListMcpResources, ReadMcpResource
- ## Tool Output Types
  - ### `ToolOutput`, Task, AskUserQuestion, Bash, Edit, Read, Write, Glob, Grep
  - ### NotebookEdit, WebFetch, WebSearch, TodoWrite, ExitPlanMode, ListMcpResources, ReadMcpResource
- ## Permission Types
  - ### `PermissionUpdate`
  - ### `PermissionBehavior`
  - ### `PermissionRuleValue`
- ## Other Types
  - ### `ApiKeySource`, `SdkBeta`, `SlashCommand`, `ModelInfo`, `McpServerStatus`
  - ### `AccountInfo`, `ModelUsage`, `Usage`, `CallToolResult`, `AbortError`
- ## Sandbox Configuration
  - ### `SandboxSettings`
  - ### `NetworkSandboxSettings`
  - ### `SandboxIgnoreViolations`
- ## See also

### typescript-v2-preview.md (397 lines)
- ## Installation
- ## Quick start
  - ### One-shot prompt
  - ### Basic session
  - ### Multi-turn conversation
  - ### Session resume
  - ### Cleanup
- ## API reference
  - ### `unstable_v2_createSession()`
  - ### `unstable_v2_resumeSession()`
  - ### `unstable_v2_prompt()`
  - ### Session interface
- ## Feature availability
- ## Feedback
- ## See also

### hooks.md (851 lines)
- ## Available hooks
- ## Common use cases
- ## Configure hooks
- ### Matchers
- ### Callback function inputs
- ### Input data
- ### Callback outputs
- #### Permission decision flow
- #### Block a tool
- #### Modify tool input
- #### Add a system message
- #### Auto-approve specific tools
- ## Handle advanced scenarios
- ### Chaining multiple hooks
- ### Tool-specific matchers with regex
- ### Tracking subagent activity
- ### Async operations in hooks
- ### Sending notifications (TypeScript only)
- ## Fix common issues
- ### Hook not firing
- ### Matcher not filtering as expected
- ### Hook timeout
- ### Tool blocked unexpectedly
- ### Modified input not applied
- ### Session hooks not available
- ### Subagent permission prompts multiplying
- ### Recursive hook loops with subagents
- ### systemMessage not appearing in output
- ## Learn more

### custom-tools.md (758 lines)
- ## Creating Custom Tools
- ## Using Custom Tools
- ### Tool Name Format
- ### Configuring Allowed Tools
- ### Multiple Tools Example
- ## Type Safety with Python
- ## Error Handling
- ## Example Tools
- ### Database Query Tool
- ### API Gateway Tool
- ### Calculator Tool
- ## Related Documentation

### mcp.md (808 lines)
- ## Quickstart
- ## Add an MCP server
- ### In code
- ### From a config file
- ## Allow MCP tools
- ### Tool naming convention
- ### Grant access with allowedTools
- ### Alternative: Change the permission mode
- ### Discover available tools
- ## Transport types
- ### stdio servers
- ### HTTP/SSE servers
- ### SDK MCP servers
- ## MCP tool search
- ### How it works
- ### Configure tool search
- ## Authentication
- ### Pass credentials via environment variables
- ### HTTP headers for remote servers
- ### OAuth2 authentication
- ## Examples
- ### List issues from a repository
- ### Query a database
- ## Error handling
- ## Troubleshooting
- ## Related resources

### subagents.md (554 lines)
- ## Overview
- ## Benefits of using subagents
- ## Creating subagents
- ### Programmatic definition (recommended)
- ### AgentDefinition configuration
- ### Filesystem-based definition (alternative)
- ## Invoking subagents
- ### Automatic invocation
- ### Explicit invocation
- ### Dynamic agent configuration
- ## Detecting subagent invocation
- ## Resuming subagents
- ## Tool restrictions
- ### Common tool combinations
- ## Troubleshooting

### skills.md (316 lines)
- ## Overview
- ## How Skills Work with the SDK
- ## Using Skills with the SDK
- ## Skill Locations
- ## Creating Skills
- ## Tool Restrictions
- ## Discovering Available Skills
- ## Testing Skills
- ## Troubleshooting
- ## Related Documentation

### plugins.md (351 lines)
- ## What are plugins?
- ## Loading plugins
- ### Path specifications
- ## Verifying plugin installation
- ## Using plugin commands
- ## Complete example
- ## Plugin structure reference
- ## Common use cases
- ## Troubleshooting

### structured-outputs.md (417 lines)
- ## Why structured outputs?
- ## Quick start
- ## Type-safe schemas with Zod and Pydantic
- ## Output format configuration
- ## Example: TODO tracking agent
- ## Error handling
- ## Related resources

### streaming-output.md (401 lines)
- ## Enable streaming output
- ## StreamEvent reference
- ## Message flow
- ## Stream text responses
- ## Stream tool calls
- ## Build a streaming UI
- ## Known limitations
- ## Next steps

### streaming-vs-single-mode.md (299 lines)
- ## Overview
- ## Streaming Input Mode (Recommended)
- ### How It Works
- ### Benefits
- ### Implementation Example
- ## Single Message Input
- ### When to Use Single Message Input
- ### Limitations
- ### Implementation Example

### user-input.md (768 lines)
- ## Detect when Claude needs input
- ## Handle tool approval requests
- ### Respond to tool requests
- ## Handle clarifying questions
- ### Question format
- ### Response format
- ### Complete example
- ## Limitations
- ## Other ways to get user input

### sessions.md (253 lines)
- ## How Sessions Work
- ### Getting the Session ID
- ## Resuming Sessions
- ## Forking Sessions

### file-checkpointing.md (823 lines)
- ## How checkpointing works
- ## Implement checkpointing
- ## Common patterns
- ### Checkpoint before risky operations
- ### Multiple restore points
- ## Try it out
- ## Limitations
- ## Troubleshooting

### slash-commands.md (500 lines)
- ## Discovering Available Slash Commands
- ## Sending Slash Commands
- ## Common Slash Commands
- ### `/compact` - Compact Conversation History
- ### `/clear` - Clear Conversation
- ## Creating Custom Slash Commands
- ### File Locations
- ### File Format
- ### Using Custom Commands in the SDK
- ### Advanced Features
- ### Organization with Namespacing
- ### Practical Examples

### todo-tracking.md (181 lines)
- ### Todo Lifecycle
- ### When Todos Are Used
- ## Examples
- ### Monitoring Todo Changes
- ### Real-time Progress Display
- ## Related Documentation

### cost-tracking.md (387 lines)
- ## Understanding Token Usage
- ## Usage Reporting Structure
- ### Single vs Parallel Tool Use
- ### Message Flow Example
- ## Important Usage Rules
- ## Implementation: Cost Tracking System
- ## Handling Edge Cases
- ## Best Practices
- ## Usage Fields Reference
- ## Example: Building a Billing Dashboard
- ## Related Documentation

### hosting.md (135 lines)
- ## Hosting Requirements
- ### Container-Based Sandboxing
- ### System Requirements
- ## Understanding the SDK Architecture
- ## Sandbox Provider Options
- ## Production Deployment Patterns
- ### Pattern 1: Ephemeral Sessions
- ### Pattern 2: Long-Running Sessions
- ### Pattern 3: Hybrid Sessions
- ### Pattern 4: Single Containers
- ## Next Steps

### secure-deployment.md (350 lines)
- ## What are we protecting against?
- ## Built-in security features
- ## Security principles
- ### Security boundaries
- ### Least privilege
- ### Defense in depth
- ## Isolation technologies
- ### Sandbox runtime
- ### Containers
- ### gVisor
- ### Virtual machines
- ### Cloud deployments
- ## Credential management
- ### The proxy pattern
- ### Configuring Claude Code to use a proxy
- ### Implementing a proxy
- ### Credentials for other services
- ## Filesystem configuration
- ### Read-only code mounting
- ### Writable locations
- ## Further reading

### migration-guide.md (335 lines)
- ## Overview
- ## What's Changed
- ## Migration Steps
- ### For TypeScript/JavaScript Projects
- ### For Python Projects
- ## Breaking changes
- ### Python: ClaudeCodeOptions renamed to ClaudeAgentOptions
- ### System prompt no longer default
- ### Settings Sources No Longer Loaded by Default
- ## Why the Rename?
- ## Getting Help
- ## Next Steps

## API Elements

Functions: `query()` → python.md, typescript.md | `tool()` → python.md, typescript.md | `create_sdk_mcp_server()` → python.md | `createSdkMcpServer()` → typescript.md | `unstable_v2_createSession()` → typescript-v2-preview.md | `unstable_v2_resumeSession()` → typescript-v2-preview.md | `unstable_v2_prompt()` → typescript-v2-preview.md

Classes: `ClaudeSDKClient` → python.md | `Query` → typescript.md

Types: `ClaudeAgentOptions` → python.md | `Options` → typescript.md | `AgentDefinition` → python.md, typescript.md | `SettingSource` → python.md, typescript.md | `PermissionMode` → python.md, typescript.md | `CanUseTool` → python.md, typescript.md | `PermissionResult` → python.md, typescript.md | `PermissionUpdate` → python.md, typescript.md | `OutputFormat` → python.md | `SystemPromptPreset` → python.md | `SdkMcpTool` → python.md | `ToolPermissionContext` → python.md | `PermissionResultAllow` → python.md | `PermissionResultDeny` → python.md | `SdkBeta` → python.md, typescript.md | `McpServerConfig` → python.md, typescript.md | `SdkPluginConfig` → python.md, typescript.md | `SandboxSettings` → python.md, typescript.md

Messages: `Message` → python.md | `UserMessage` → python.md | `AssistantMessage` → python.md | `SystemMessage` → python.md | `ResultMessage` → python.md | `StreamEvent` → python.md, streaming-output.md | `SDKMessage` → typescript.md | `SDKAssistantMessage` → typescript.md | `SDKUserMessage` → typescript.md | `SDKResultMessage` → typescript.md | `SDKSystemMessage` → typescript.md | `SDKPartialAssistantMessage` → typescript.md

Content Blocks: `ContentBlock` → python.md | `TextBlock` → python.md | `ThinkingBlock` → python.md | `ToolUseBlock` → python.md | `ToolResultBlock` → python.md

Errors: `ClaudeSDKError` → python.md | `CLINotFoundError` → python.md | `CLIConnectionError` → python.md | `ProcessError` → python.md | `CLIJSONDecodeError` → python.md | `AbortError` → typescript.md

Hooks: `HookEvent` → python.md, typescript.md | `HookCallback` → python.md, typescript.md | `HookMatcher` → python.md | `HookCallbackMatcher` → typescript.md | `HookContext` → python.md | `HookInput` → python.md, typescript.md | `PreToolUseHookInput` → python.md, typescript.md | `PostToolUseHookInput` → python.md, typescript.md | `UserPromptSubmitHookInput` → python.md, typescript.md | `StopHookInput` → python.md, typescript.md | `SubagentStopHookInput` → python.md, typescript.md | `PreCompactHookInput` → python.md, typescript.md | `HookJSONOutput` → python.md, typescript.md | `NotificationHookInput` → typescript.md | `SessionStartHookInput` → typescript.md | `SessionEndHookInput` → typescript.md | `SubagentStartHookInput` → typescript.md | `PermissionRequestHookInput` → typescript.md

## Task Map

- Install/setup → quickstart.md, overview.md
- Create and run an agent → quickstart.md, agent-loop.md
- Use query() or ClaudeSDKClient → python.md, typescript.md
- Create custom tools → custom-tools.md
- Connect MCP servers → mcp.md
- Intercept tool calls with hooks → hooks.md
- Modify system prompts → modifying-system-prompts.md
- Load CLAUDE.md/skills/hooks → claude-code-features.md
- Configure permissions → permissions.md
- Spawn subagents → subagents.md
- Get structured JSON output → structured-outputs.md
- Stream responses in real-time → streaming-output.md
- Choose streaming vs single mode → streaming-vs-single-mode.md
- Handle user approval/input → user-input.md
- Manage sessions/resume → sessions.md
- Track file changes/rollback → file-checkpointing.md
- Use slash commands → slash-commands.md
- Track todos → todo-tracking.md
- Load plugins → plugins.md
- Use skills → skills.md
- Track costs/billing → cost-tracking.md
- Deploy/host in production → hosting.md, secure-deployment.md
- Secure deployments → secure-deployment.md
- Migrate from old SDK → migration-guide.md
- TypeScript V2 preview → typescript-v2-preview.md
