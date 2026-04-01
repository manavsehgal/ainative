---
title: Ollama Runtime Provider
status: completed
priority: P2
milestone: post-mvp
source: ideas/vision/Stagent-OpenClaw-Companion-Research-Report.md
dependencies: [provider-runtime-abstraction]
---

# Ollama Runtime Provider

## Description

Add Ollama as a fifth runtime adapter in Stagent's multi-provider architecture, enabling local model execution for privacy-sensitive operations and cost optimization. Ollama runs models locally (Llama, Mistral, Gemma, Phi, etc.) with zero API costs and full data privacy — no tokens leave the machine.

This aligns with Stagent's local-first philosophy and serves two key personas: cost-conscious solo founders who can't afford Claude Opus for every heartbeat check, and users handling sensitive data (financial records, customer PII, legal documents) who need inference without cloud API calls.

The adapter follows the established `AgentRuntimeAdapter` interface pattern from `provider-runtime-abstraction`, integrating with the existing runtime catalog, cost metering ledger, and smart runtime router.

## User Story

As a cost-conscious solo founder, I want to run routine agent tasks (heartbeat checks, simple classifications, data formatting) on local models via Ollama, so that I reserve expensive cloud API calls for complex reasoning tasks.

## Technical Approach

### Runtime Adapter

New file: `src/lib/agents/runtime/ollama-adapter.ts`

Implements the `AgentRuntimeAdapter` interface:

```typescript
interface OllamaAdapterConfig {
  baseUrl: string;           // Default: http://localhost:11434
  defaultModel: string;      // Default: llama3.2
  timeout: number;           // Default: 120000ms
  contextLength: number;     // Model-dependent, default: 8192
}
```

**Agentic loop implementation:**
1. **Chat completion**: Use Ollama's `/api/chat` endpoint with streaming
2. **Tool use**: Ollama supports function calling for compatible models (Llama 3.1+, Mistral, etc.). Map Stagent's tool definitions to Ollama's tool format.
3. **Multi-turn**: Maintain conversation history in the adapter, sending full message history on each turn
4. **Stop conditions**: Max turns, explicit stop, tool approval gate (same as other adapters)
5. **Streaming**: SSE streaming via Ollama's streaming response mode

**Key differences from cloud adapters:**
- No API key required — Ollama runs locally
- No cost per token — cost metering records $0 but tracks token counts for monitoring
- Model availability depends on what's pulled locally (`ollama list`)
- Context window varies by model (4K-128K depending on model)
- No prompt caching (local inference doesn't benefit from server-side caching)

### Runtime Catalog Registration

Add to `src/lib/agents/runtime/catalog.ts`:

```typescript
{
  id: 'ollama',
  name: 'Ollama (Local)',
  description: 'Local model execution via Ollama. Zero cost, full privacy.',
  category: 'local',
  requiresCredentials: false,
  capabilities: {
    streaming: true,
    toolUse: true,            // Model-dependent
    imageInput: false,        // Most local models don't support vision
    codeExecution: false,
    webSearch: false,
    maxContextTokens: null,   // Model-dependent, discovered at runtime
  },
  defaultModel: 'llama3.2',
  availableModels: [],        // Populated dynamically from `ollama list`
}
```

### Model Discovery

New utility: `src/lib/agents/runtime/ollama-models.ts`

- On adapter initialization, call `GET /api/tags` to list locally available models
- Parse model metadata (parameter count, context length, capabilities)
- Expose via API: `GET /api/runtimes/ollama/models` — returns available local models
- Cache model list with 5-minute TTL (models don't change frequently)

### Smart Router Integration

Extend `src/lib/agents/router.ts` (`suggestRuntime()`):

- **Cost preference**: When user prefers "cost" optimization, suggest Ollama for tasks that don't require advanced reasoning
- **Privacy signals**: When task description or profile contains privacy keywords (financial, medical, legal, PII, confidential), suggest Ollama
- **Complexity routing**: Simple tasks (classification, formatting, summarization) → Ollama; complex tasks (multi-step reasoning, code generation, research) → cloud providers
- **Fallback**: If Ollama is unavailable (not running, model not pulled), fall back to next best runtime

### Cost Metering Integration

Extend usage metering in `src/lib/usage/`:

- Record Ollama usage with `cost: 0` but track `inputTokens` and `outputTokens` for monitoring
- Dashboard shows Ollama usage as "Local (free)" alongside paid provider spend
- Budget guardrails don't trigger for Ollama runs (cost is always 0)
- Display estimated cloud-equivalent cost for Ollama runs: "This would have cost $X on Claude" — helps users appreciate the savings

### Connection Health

- **Health check**: Periodically ping `GET /api/tags` to verify Ollama is running
- **UI indicator**: Settings page shows Ollama connection status (connected/disconnected/not installed)
- **Graceful degradation**: If Ollama goes down mid-run, the adapter returns an error; the smart router suggests an alternative runtime

### Settings UI

Add "Ollama" section to the runtime configuration in Settings:

1. **Connection**: Base URL input (default: localhost:11434), test connection button
2. **Default model**: Dropdown populated from discovered models
3. **Model management**: List of available models with size and capability info
4. **Pull model**: Button to pull new models (runs `ollama pull <model>` via API)

## Acceptance Criteria

- [ ] Ollama adapter implements full `AgentRuntimeAdapter` interface
- [ ] Streaming chat completion works with Ollama's `/api/chat` endpoint
- [ ] Tool use works for compatible models (Llama 3.1+, Mistral)
- [ ] Multi-turn conversation maintains history correctly
- [ ] Model discovery lists locally available models via `/api/tags`
- [ ] Runtime catalog includes Ollama with correct capabilities
- [ ] Smart router suggests Ollama for cost-sensitive and privacy-sensitive tasks
- [ ] Cost metering records $0 cost but tracks token counts
- [ ] Dashboard shows Ollama usage alongside paid provider spend
- [ ] Settings UI shows connection status and available models
- [ ] Graceful handling when Ollama is not running (clear error, suggest alternatives)
- [ ] Profile `supportedRuntimes` and `preferredRuntime` can include `ollama`
- [ ] Existing runtimes (claude-code, openai-codex, anthropic-direct, openai-direct) are unaffected

## Scope Boundaries

**Included:**
- Ollama runtime adapter with streaming, tool use, and multi-turn support
- Model discovery and availability checking
- Smart router integration for cost/privacy routing
- Cost metering with $0 cost tracking
- Settings UI for Ollama configuration
- Connection health monitoring

**Excluded:**
- Gemini runtime adapter — separate feature if demand exists
- DeepSeek runtime adapter — separate feature if demand exists
- Model fine-tuning or training — Ollama handles this natively
- Custom model creation — use Ollama's Modelfile directly
- GPU management or performance tuning — Ollama handles this
- Model downloading UI beyond simple pull button — use Ollama CLI

## References

- Source: `ideas/vision/Stagent-OpenClaw-Companion-Research-Report.md` — Section 3.7 (Broader LLM Provider Support)
- Existing runtime catalog: `src/lib/agents/runtime/catalog.ts`
- Existing adapter pattern: `src/lib/agents/runtime/anthropic-direct.ts` (reference implementation)
- Existing smart router: `src/lib/agents/router.ts`
- Existing cost metering: `src/lib/usage/` (usage ledger)
- Related features: smart-runtime-router (routes tasks to Ollama), heartbeat-scheduler (heartbeat checks are ideal Ollama workload)
