"use client";

export function ConnectionIndicator({ connected }: { connected: boolean }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={`h-2 w-2 rounded-full ${
          connected ? "bg-success" : "bg-status-failed"
        }`}
      />
      {connected ? "Connected" : "Disconnected"}
    </div>
  );
}
