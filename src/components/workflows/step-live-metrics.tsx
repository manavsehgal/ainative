"use client";

import { useEffect, useRef, useState } from "react";
import { Wrench, Clock, Coins, Hash } from "lucide-react";

interface StepLiveMetricsProps {
  taskId: string;
  budgetCapUsd: number;
}

interface MetricsState {
  tokens: number;
  costUsd: number;
  currentTool: string | null;
  turnNumber: number;
  startedAt: number;
  elapsed: string;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function StepLiveMetrics({ taskId, budgetCapUsd }: StepLiveMetricsProps) {
  const [metrics, setMetrics] = useState<MetricsState>({
    tokens: 0,
    costUsd: 0,
    currentTool: null,
    turnNumber: 0,
    startedAt: Date.now(),
    elapsed: "0s",
  });
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Elapsed time ticker
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setMetrics((prev) => ({
        ...prev,
        elapsed: formatElapsed(Date.now() - prev.startedAt),
      }));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // SSE subscription
  useEffect(() => {
    const params = new URLSearchParams({ taskId });
    const es = new EventSource(`/api/logs/stream?${params}`);
    eventSourceRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const eventType: string = data.event ?? "";
        const payload = data.payload ? JSON.parse(data.payload) : {};

        if (eventType === "tool_start" || eventType === "tool_use") {
          setMetrics((prev) => ({
            ...prev,
            currentTool: payload.toolName ?? payload.tool ?? prev.currentTool,
            turnNumber: prev.turnNumber + 1,
          }));
        }

        if (eventType === "content_block_delta" || eventType === "token_usage") {
          const tokenDelta = payload.tokens ?? payload.inputTokens ?? 0;
          const costDelta = payload.costUsd ?? 0;
          setMetrics((prev) => ({
            ...prev,
            tokens: prev.tokens + tokenDelta,
            costUsd: prev.costUsd + costDelta,
          }));
        }

        if (eventType === "completed" || eventType === "step_completed") {
          setMetrics((prev) => ({
            ...prev,
            currentTool: null,
          }));
          if (timerRef.current) clearInterval(timerRef.current);
        }
      } catch {
        // Ignore malformed events
      }
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [taskId]);

  const costPercent = budgetCapUsd > 0 ? Math.min((metrics.costUsd / budgetCapUsd) * 100, 100) : 0;

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Tokens tile */}
      <div className="rounded-lg border bg-white p-3 shadow-sm">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Hash className="h-3.5 w-3.5" />
          Tokens
        </div>
        <div className="mt-1 font-mono text-lg font-semibold">
          {metrics.tokens.toLocaleString()}
        </div>
        <div className="text-xs text-muted-foreground">tokens</div>
      </div>

      {/* Cost tile */}
      <div className="rounded-lg border bg-white p-3 shadow-sm">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Coins className="h-3.5 w-3.5" />
          Cost
        </div>
        <div className="mt-1 font-mono text-lg font-semibold">
          ${metrics.costUsd.toFixed(2)}
        </div>
        <div className="mt-1">
          <div className="h-1.5 w-full rounded-full bg-[oklch(0.92_0_0)]">
            <div
              className="h-1.5 rounded-full bg-[oklch(0.6_0.15_250)] transition-all duration-300"
              style={{ width: `${costPercent}%` }}
            />
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            of ${budgetCapUsd.toFixed(2)} cap
          </div>
        </div>
      </div>

      {/* Current Tool tile */}
      <div className="rounded-lg border bg-white p-3 shadow-sm">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Wrench className="h-3.5 w-3.5" />
          Current Tool
        </div>
        <div className="mt-1 truncate font-mono text-lg font-semibold">
          {metrics.currentTool ?? "\u2014"}
        </div>
        <div className="text-xs text-muted-foreground">
          turn {metrics.turnNumber}
        </div>
      </div>

      {/* Elapsed tile */}
      <div className="rounded-lg border bg-white p-3 shadow-sm">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          Elapsed
        </div>
        <div className="mt-1 font-mono text-lg font-semibold">
          {metrics.elapsed}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {connected ? (
            <>
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[oklch(0.65_0.15_145)]" />
              live
            </>
          ) : (
            <>
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[oklch(0.8_0_0)]" />
              disconnected
            </>
          )}
        </div>
      </div>
    </div>
  );
}
