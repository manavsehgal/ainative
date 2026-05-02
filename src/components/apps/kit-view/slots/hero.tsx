import type { HeroSlot } from "@/lib/apps/view-kits/types";

interface HeroSlotProps {
  slot: HeroSlot;
}

/**
 * Renders the kit's hero content (table-spreadsheet for Tracker, latest
 * digest for Coach, queue+draft for Inbox, etc.). Phase 1.1's placeholder
 * kit doesn't supply a hero, so this renders the slot only when present.
 */
export function HeroSlotView({ slot }: HeroSlotProps) {
  return <section data-kit-slot="hero">{slot.content}</section>;
}
