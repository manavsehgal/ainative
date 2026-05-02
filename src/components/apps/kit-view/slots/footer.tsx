import type { ManifestPaneSlot } from "@/lib/apps/view-kits/types";

interface FooterSlotProps {
  slot: ManifestPaneSlot;
}

/**
 * Footer slot. The actual manifest sheet is mounted by the header (its
 * "View manifest ▾" trigger is what users click), so this slot currently
 * renders nothing visible — it carries the manifest pane data through the
 * `ViewModel` for the header to consume.
 *
 * Reserved for future bottom-of-page metadata (last-updated timestamp,
 * source-of-truth note, audit trail) without re-shaping the kit contract.
 */
export function FooterSlotView(_props: FooterSlotProps) {
  return null;
}
