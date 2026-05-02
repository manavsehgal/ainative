import type { SecondarySlot } from "@/lib/apps/view-kits/types";

interface SecondarySlotProps {
  slots: SecondarySlot[];
}

/**
 * Renders 0..3 secondary cards arranged in a responsive grid. Used by
 * domain kits (Coach surfaces "Open questions" / "Risk", Ledger surfaces
 * "Top movers" / "Allocation drift"). Phase 1.1's placeholder doesn't
 * populate this slot.
 */
export function SecondarySlotView({ slots }: SecondarySlotProps) {
  if (slots.length === 0) return null;
  const cols =
    slots.length === 1
      ? "grid-cols-1"
      : slots.length === 2
        ? "grid-cols-1 sm:grid-cols-2"
        : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
  return (
    <div className={`grid gap-4 ${cols}`}>
      {slots.map((slot) => (
        <section
          key={slot.id}
          data-kit-slot="secondary"
          className="space-y-2"
        >
          {slot.title && (
            <h2 className="text-sm font-medium">{slot.title}</h2>
          )}
          {slot.content}
        </section>
      ))}
    </div>
  );
}
