"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

export function UnreadBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    async function fetchCount() {
      try {
        const res = await fetch("/api/notifications?countOnly=true&unread=true");
        if (res.ok) {
          const data = await res.json();
          setCount(data.count ?? 0);
        }
      } catch {
        // Silently fail
      }
    }

    fetchCount();
    // Aligned with InboxList polling at 10s to reduce duplicate requests
    const interval = setInterval(fetchCount, 10_000);
    return () => clearInterval(interval);
  }, []);

  if (count === 0) return null;

  return (
    <Badge variant="destructive" className="ml-auto text-xs h-5 min-w-5 px-1.5" aria-label={`${count} unread notifications`}>
      {count > 99 ? "99+" : count}
    </Badge>
  );
}
