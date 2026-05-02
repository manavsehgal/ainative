import { KPIStrip } from "@/components/apps/kpi-strip";
import type { KpiTile } from "@/lib/apps/view-kits/types";

interface KpisSlotProps {
  tiles: KpiTile[];
}

/**
 * Phase 2: delegates to the `KPIStrip` primitive. Returns null for empty
 * tiles to preserve the Phase 1.1 behavior (no surface for placeholder kit).
 */
export function KpisSlotView({ tiles }: KpisSlotProps) {
  if (tiles.length === 0) return null;
  return <KPIStrip tiles={tiles} />;
}
