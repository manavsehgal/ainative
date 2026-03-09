"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export interface ActivityEntry {
  id: string;
  event: string;
  payload: string | null;
  timestamp: string;
  taskTitle?: string;
}

interface ActivityFeedProps {
  entries: ActivityEntry[];
}

const eventColors: Record<string, string> = {
  tool_start: "bg-status-running",
  content_start: "bg-status-completed",
  content_delta: "bg-status-completed/70",
  completed: "bg-status-completed",
  error: "bg-status-failed",
};

export function ActivityFeed({ entries }: ActivityFeedProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Live Agent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No recent agent activity.
          </p>
        ) : (
          <div className="space-y-1">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-3 py-2.5 border-b last:border-b-0"
              >
                <div
                  className={`h-2 w-2 rounded-full mt-1.5 flex-shrink-0 ${eventColors[entry.event] ?? "bg-muted-foreground"}`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">
                    <span className="font-medium">{entry.event}</span>
                    {entry.taskTitle && (
                      <span className="text-muted-foreground"> — {entry.taskTitle}</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                    {entry.payload && ` · ${entry.payload.slice(0, 60)}${entry.payload.length > 60 ? "..." : ""}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3">
          <Link href="/monitor">
            <Button variant="outline" size="sm" className="w-full">
              Open monitor <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
