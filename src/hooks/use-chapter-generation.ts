"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import type { ChapterStaleness } from "@/lib/book/update-detector";

interface UseChapterGenerationOptions {
  chapterId: string;
  onComplete: () => void;
}

export interface UseChapterGenerationReturn {
  staleness: ChapterStaleness | null;
  isStale: boolean;
  isGenerating: boolean;
  progressMessage: string;
  taskStatus: string | null;
  error: string | null;
  triggerGeneration: () => Promise<void>;
}

/** Translate an agent log event into a human-readable progress label */
function deriveProgressMessage(event: string, payload: string | null): string | null {
  try {
    const p = payload ? JSON.parse(payload) : {};

    switch (event) {
      case "message_start":
        return "Agent started...";

      case "tool_start": {
        const tool = p.tool ?? p.name;
        if (!tool) return "Using tool...";
        if (tool === "Read") {
          const file = extractFilename(p.input);
          return file ? `Reading ${file}...` : "Reading source files...";
        }
        if (tool === "Write") return "Writing chapter file...";
        if (tool === "Edit") return "Editing chapter...";
        if (tool === "Bash") return "Running command...";
        if (tool === "Grep") return "Searching codebase...";
        if (tool === "Glob") return "Finding files...";
        return `Using ${tool}...`;
      }

      case "content_block_start":
        if (p.type === "thinking") return "Planning structure...";
        if (p.type === "text") return "Composing content...";
        return null;

      case "content_block_delta":
        // Only update if it's a text delta (agent is writing)
        if (p.type === "text") return "Composing content...";
        return null;

      case "completed":
        return "Finishing up...";

      case "error":
        return null; // handled separately

      default:
        return null;
    }
  } catch {
    return null;
  }
}

/** Extract a short filename from tool input (e.g., "/long/path/schema.ts" → "schema.ts") */
function extractFilename(input: unknown): string | null {
  if (!input) return null;
  // input may be { file_path: "..." } or { path: "..." } or a string
  const raw =
    typeof input === "string"
      ? input
      : typeof input === "object" && input !== null
        ? (input as Record<string, unknown>).file_path ?? (input as Record<string, unknown>).path
        : null;
  if (typeof raw !== "string") return null;
  const parts = raw.split("/");
  return parts[parts.length - 1] || null;
}

export function useChapterGeneration({
  chapterId,
  onComplete,
}: UseChapterGenerationOptions): UseChapterGenerationReturn {
  const [staleness, setStaleness] = useState<ChapterStaleness | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState("Starting...");
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const fallbackPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Fetch staleness on mount and when chapterId changes
  useEffect(() => {
    let cancelled = false;
    async function fetchStaleness() {
      try {
        const res = await fetch(`/api/book/regenerate?chapterId=${chapterId}`);
        if (res.ok && !cancelled) {
          setStaleness(await res.json());
        }
      } catch {
        // Staleness is informational — fail silently
      }
    }
    fetchStaleness();
    return () => { cancelled = true; };
  }, [chapterId]);

  // Reset state when chapterId changes
  useEffect(() => {
    setTaskId(null);
    setTaskStatus(null);
    setProgressMessage("Starting...");
    setError(null);
    cleanup();
  }, [chapterId]); // eslint-disable-line react-hooks/exhaustive-deps

  function cleanup() {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    if (fallbackPollRef.current) {
      clearInterval(fallbackPollRef.current);
      fallbackPollRef.current = null;
    }
  }

  // SSE subscription for live progress + fallback poll
  useEffect(() => {
    if (!taskId || (taskStatus !== "queued" && taskStatus !== "running")) {
      return;
    }

    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      const es = new EventSource(`/api/logs/stream?taskId=${taskId}`);
      esRef.current = es;

      es.onmessage = (event) => {
        try {
          const log = JSON.parse(event.data);
          const msg = deriveProgressMessage(log.event, log.payload);
          if (msg) setProgressMessage(msg);

          // Detect terminal states from the stream
          if (log.event === "completed") {
            toast.success("Chapter generated — refreshing...");
            setTaskId(null);
            cleanup();
            onCompleteRef.current();
          } else if (log.event === "error") {
            const p = log.payload ? JSON.parse(log.payload) : {};
            toast.error("Chapter generation failed");
            setError(p.error ?? "Generation failed");
            setTaskId(null);
            cleanup();
          }

          // Update status from stream events
          if (log.event === "message_start" || log.event === "tool_start") {
            setTaskStatus("running");
          }
        } catch {
          // malformed event — skip
        }
      };

      es.onerror = () => {
        es.close();
        esRef.current = null;
        // Reconnect after 3s
        reconnectTimeout = setTimeout(connect, 3_000);
      };
    }

    connect();

    // Fallback poll every 15s in case SSE drops silently
    fallbackPollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/tasks/${taskId}`);
        if (!res.ok) return;
        const task = await res.json();
        if (task.status === "completed") {
          toast.success("Chapter generated — refreshing...");
          setTaskId(null);
          cleanup();
          onCompleteRef.current();
        } else if (task.status === "failed") {
          toast.error("Chapter generation failed");
          setError(task.result ?? "Generation failed");
          setTaskId(null);
          cleanup();
        }
      } catch {
        // keep trying
      }
    }, 15_000);

    return () => {
      cleanup();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [taskId, taskStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const triggerGeneration = useCallback(async () => {
    setError(null);
    setProgressMessage("Starting...");

    try {
      const res = await fetch("/api/book/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg = data?.error ?? `Failed to start generation (${res.status})`;
        toast.error(msg);
        setError(msg);
        return;
      }

      const data = await res.json();
      setTaskId(data.taskId);
      setTaskStatus("queued");
      toast.info(`${data.isNew ? "Generating" : "Regenerating"} Chapter ${data.chapterNumber}...`);
    } catch {
      toast.error("Network error — could not reach server");
      setError("Network error");
    }
  }, [chapterId]);

  const isGenerating = taskStatus === "queued" || taskStatus === "running";

  return {
    staleness,
    isStale: staleness?.isStale ?? false,
    isGenerating,
    progressMessage,
    taskStatus,
    error,
    triggerGeneration,
  };
}
