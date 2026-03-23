"use client";

import { useEffect, useState } from "react";

/** Small "Updated" dot badge for sidebar — shows when docs changed since last visit */
export function PlaybookUpdatedBadge() {
  const [hasUpdates, setHasUpdates] = useState(false);

  useEffect(() => {
    fetch("/api/user-guide/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.hasUpdates) setHasUpdates(true);
      })
      .catch(() => {});
  }, []);

  if (!hasUpdates) return null;

  return (
    <span className="ml-auto flex h-2 w-2 rounded-full bg-primary" aria-label="Updated docs available" />
  );
}
