"use client";

import { useEffect, useState } from "react";
import { RuntimePreferenceModal } from "./runtime-preference-modal";

/**
 * First-launch trigger for the runtime preference modal.
 *
 * Mounted in the root layout so it runs on every page load. After a single
 * GET to /api/settings/chat, decides whether to show the onboarding modal:
 *
 *   - `defaultModelRecorded === false` AND `modelPreference === null`
 *       → show the modal
 *   - any other state → no-op (the user has already been asked or the
 *     setting was hand-edited)
 *
 * Both Confirm and Skip persist a record, so subsequent loads will see
 * `defaultModelRecorded === true` and skip the modal.
 */
export function RuntimePreferenceBootstrapper() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/chat")
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (data: {
          defaultModelRecorded?: boolean;
          modelPreference?: string | null;
        } | null) => {
          if (cancelled || !data) return;
          // First launch = no defaultModel record yet, no preference logged.
          // The two flags are independent because /api/settings/chat
          // surfaces the raw existence separately from the coerced default.
          if (!data.defaultModelRecorded && data.modelPreference == null) {
            setOpen(true);
          }
        }
      )
      .catch(() => {
        // Silent — fetch failure should never break the app shell.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!open) return null;
  return <RuntimePreferenceModal open={open} onClose={() => setOpen(false)} />;
}
