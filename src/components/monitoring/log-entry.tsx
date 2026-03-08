"use client";

import { useState } from "react";

interface LogEntryData {
  id: string;
  taskId: string | null;
  agentType: string;
  event: string;
  payload: string | null;
  timestamp: string;
}

const eventColors: Record<string, string> = {
  tool_start: "text-blue-500",
  content_block_start: "text-blue-500",
  message_start: "text-blue-500",
  content_block_delta: "text-muted-foreground",
  error: "text-red-500",
  completed: "text-green-500",
};

export function LogEntry({ entry }: { entry: LogEntryData }) {
  const [expanded, setExpanded] = useState(false);

  const time = new Date(entry.timestamp).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

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
    <div
      className="font-mono text-sm py-0.5 hover:bg-muted/50 px-2 rounded cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      <span className="text-muted-foreground">[{time}]</span>{" "}
      <span className={color}>[{entry.event}]</span>{" "}
      <span className="text-foreground">{preview}</span>
      {expanded && entry.payload && (
        <pre className="text-xs text-muted-foreground bg-muted p-2 rounded mt-1 overflow-auto max-h-40 whitespace-pre-wrap">
          {JSON.stringify(JSON.parse(entry.payload), null, 2)}
        </pre>
      )}
    </div>
  );
}
