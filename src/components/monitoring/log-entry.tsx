"use client";

import { useState } from "react";
import Link from "next/link";
import { formatTime } from "@/lib/utils/format-timestamp";

export interface LogEntryData {
  id: string;
  taskId: string | null;
  agentType: string;
  event: string;
  payload: string | null;
  timestamp: string;
}

const eventColors: Record<string, string> = {
  tool_start: "text-primary",
  content_block_start: "text-primary",
  message_start: "text-primary",
  content_block_delta: "text-muted-foreground",
  error: "text-destructive",
  completed: "text-chart-2",
};

export function LogEntry({ entry, taskName }: { entry: LogEntryData; taskName?: string }) {
  const [expanded, setExpanded] = useState(false);

  const time = formatTime(entry.timestamp);

  let preview = "";
  try {
    if (entry.payload) {
      const parsed = JSON.parse(entry.payload);
      if (parsed.tool) {
        preview = `${parsed.tool}`;
      } else if (parsed.text) {
        preview = parsed.text.slice(0, 80);
      } else if (parsed.error) {
        preview = parsed.error.slice(0, 80);
      } else if (parsed.result) {
        preview = parsed.result.slice(0, 80);
      }
    }
  } catch {
    preview = entry.payload?.slice(0, 80) ?? "";
  }

  const color = eventColors[entry.event] ?? "text-muted-foreground";

  return (
    <button
      type="button"
      className="w-full text-left font-mono text-sm py-0.5 hover:bg-muted/50 px-2 rounded cursor-pointer"
      onClick={() => setExpanded(!expanded)}
      aria-expanded={expanded}
      aria-label={`Log entry: ${entry.event} at ${time}`}
    >
      <span className="text-muted-foreground">[{time}]</span>{" "}
      {taskName && entry.taskId && (
        <>
          <Link
            href={`/tasks/${entry.taskId}`}
            className="text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {taskName}
          </Link>{" "}
        </>
      )}
      <span className={color}>[{entry.event}]</span>{" "}
      <span className="text-foreground">{preview}</span>
      {expanded && entry.payload && (
        <pre className="text-xs text-muted-foreground bg-muted p-2 rounded mt-1 overflow-auto max-h-40 whitespace-pre-wrap">
          {JSON.stringify(JSON.parse(entry.payload), null, 2)}
        </pre>
      )}
    </button>
  );
}
