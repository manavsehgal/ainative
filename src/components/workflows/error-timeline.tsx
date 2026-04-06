"use client";

interface TimelineEvent {
  timestamp: string;
  event: string;
  severity: "success" | "warning" | "error";
  details: string;
}

interface ErrorTimelineProps {
  events: TimelineEvent[];
}

const severityColor: Record<TimelineEvent["severity"], string> = {
  success: "bg-green-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
};

function formatRelativeTime(firstMs: number, currentMs: number): string {
  const diffMs = currentMs - firstMs;
  if (diffMs < 1000) return "+0s";
  const totalSeconds = Math.floor(diffMs / 1000);
  if (totalSeconds < 60) return `+${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `+${minutes}m ${seconds}s`;
}

function formatEventLabel(event: string): string {
  return event
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ErrorTimeline({ events }: ErrorTimelineProps) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No timeline events found.
      </p>
    );
  }

  const firstTimestamp = new Date(events[0].timestamp).getTime();

  return (
    <div className="relative pl-6">
      {/* Vertical line */}
      <div className="absolute left-[5px] top-1 bottom-1 w-0.5 bg-border" />

      <div className="space-y-4">
        {events.map((event, index) => {
          const currentMs = new Date(event.timestamp).getTime();
          const relTime = formatRelativeTime(firstTimestamp, currentMs);

          return (
            <div key={index} className="relative flex items-start gap-3">
              {/* Dot */}
              <div
                className={`absolute -left-6 top-1 h-3 w-3 rounded-full border-2 border-background ${severityColor[event.severity]}`}
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {formatEventLabel(event.event)}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {relTime}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 break-words">
                  {event.details}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
