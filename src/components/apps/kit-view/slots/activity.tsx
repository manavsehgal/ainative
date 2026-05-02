import type { ActivityFeedSlot } from "@/lib/apps/view-kits/types";

interface ActivitySlotProps {
  slot: ActivityFeedSlot;
}

/**
 * Activity feed slot — Phase 2 wires `RunHistoryTimeline` here for kits that
 * surface recent runs (Tracker, Workflow Hub). Phase 1.1 just renders
 * whatever the kit hands over (placeholder kit supplies nothing).
 */
export function ActivitySlotView({ slot }: ActivitySlotProps) {
  return (
    <section data-kit-slot="activity" className="space-y-2">
      {slot.content}
    </section>
  );
}
