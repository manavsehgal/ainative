export interface LogSeed {
  id: string;
  taskId: string;
  agentType: string;
  event: string;
  payload: string;
  timestamp: Date;
}

interface TasksByStatus {
  completed: string[];
  failed: string[];
  running: string[];
}

export function createLogs(taskMap: TasksByStatus): LogSeed[] {
  const logs: LogSeed[] = [];
  const now = Date.now();
  const DAY = 86_400_000;

  // Completed tasks — 6 log entries each
  taskMap.completed.forEach((taskId, i) => {
    const base = now - (10 - i) * DAY;
    const gap = 3000; // 3s between events

    logs.push(
      {
        id: crypto.randomUUID(),
        taskId,
        agentType: "claude-agent",
        event: "message_start",
        payload: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          role: "assistant",
        }),
        timestamp: new Date(base),
      },
      {
        id: crypto.randomUUID(),
        taskId,
        agentType: "claude-agent",
        event: "content_block_start",
        payload: JSON.stringify({
          type: "thinking",
          text: "Let me analyze the provided information and break down the key components...",
        }),
        timestamp: new Date(base + gap),
      },
      {
        id: crypto.randomUUID(),
        taskId,
        agentType: "claude-agent",
        event: "tool_start",
        payload: JSON.stringify({
          tool: "Read",
          input: { file_path: "/attached/document" },
        }),
        timestamp: new Date(base + gap * 2),
      },
      {
        id: crypto.randomUUID(),
        taskId,
        agentType: "claude-agent",
        event: "content_block_delta",
        payload: JSON.stringify({
          type: "text",
          text: "Based on my analysis of the provided materials, here are the key findings...",
        }),
        timestamp: new Date(base + gap * 3),
      },
      {
        id: crypto.randomUUID(),
        taskId,
        agentType: "claude-agent",
        event: "tool_start",
        payload: JSON.stringify({
          tool: "Write",
          input: { file_path: "/output/result.md" },
        }),
        timestamp: new Date(base + gap * 4),
      },
      {
        id: crypto.randomUUID(),
        taskId,
        agentType: "claude-agent",
        event: "completed",
        payload: JSON.stringify({
          stop_reason: "end_turn",
          usage: {
            input_tokens: 2400 + i * 300,
            output_tokens: 1200 + i * 150,
          },
        }),
        timestamp: new Date(base + gap * 5),
      }
    );
  });

  // Failed tasks — 4 log entries each
  taskMap.failed.forEach((taskId, i) => {
    const base = now - (6 - i) * DAY;
    const gap = 3000;

    logs.push(
      {
        id: crypto.randomUUID(),
        taskId,
        agentType: "claude-agent",
        event: "message_start",
        payload: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          role: "assistant",
        }),
        timestamp: new Date(base),
      },
      {
        id: crypto.randomUUID(),
        taskId,
        agentType: "claude-agent",
        event: "content_block_start",
        payload: JSON.stringify({
          type: "thinking",
          text: "I need to enrich the prospect data by querying external APIs...",
        }),
        timestamp: new Date(base + gap),
      },
      {
        id: crypto.randomUUID(),
        taskId,
        agentType: "claude-agent",
        event: "tool_start",
        payload: JSON.stringify({
          tool: "WebSearch",
          input: { query: "company enrichment data" },
        }),
        timestamp: new Date(base + gap * 2),
      },
      {
        id: crypto.randomUUID(),
        taskId,
        agentType: "claude-agent",
        event: "error",
        payload: JSON.stringify({
          error: "Rate limit exceeded — too many requests to enrichment API. Please retry after 60 seconds.",
          code: "rate_limit_error",
        }),
        timestamp: new Date(base + gap * 3),
      }
    );
  });

  // Running tasks — 3 log entries each (in progress)
  taskMap.running.forEach((taskId, i) => {
    const base = now - (2 + i) * 3600_000; // hours ago
    const gap = 3000;

    logs.push(
      {
        id: crypto.randomUUID(),
        taskId,
        agentType: "claude-agent",
        event: "message_start",
        payload: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          role: "assistant",
        }),
        timestamp: new Date(base),
      },
      {
        id: crypto.randomUUID(),
        taskId,
        agentType: "claude-agent",
        event: "content_block_start",
        payload: JSON.stringify({
          type: "thinking",
          text: "Working through the analysis step by step...",
        }),
        timestamp: new Date(base + gap),
      },
      {
        id: crypto.randomUUID(),
        taskId,
        agentType: "claude-agent",
        event: "tool_start",
        payload: JSON.stringify({
          tool: "Read",
          input: { file_path: "/attached/document" },
        }),
        timestamp: new Date(base + gap * 2),
      }
    );
  });

  return logs;
}
