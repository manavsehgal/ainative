import type { KpiTile } from "@/lib/apps/view-kits/types";

interface KpisSlotProps {
  tiles: KpiTile[];
}

/**
 * Phase 1.1 placeholder. The real `KPIStrip` primitive lands in Phase 2
 * (`composed-app-kit-tracker-and-hub`). This renderer keeps the slot
 * contract honored without committing to visual polish — when no tiles are
 * supplied (placeholder kit case) it renders nothing.
 */
export function KpisSlotView({ tiles }: KpisSlotProps) {
  if (tiles.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((tile) => (
        <div
          key={tile.id}
          className="rounded-lg border bg-card p-3 space-y-1"
        >
          <div className="text-xs text-muted-foreground">{tile.label}</div>
          <div className="text-lg font-semibold tracking-tight">{tile.value}</div>
          {tile.hint && (
            <div className="text-[11px] text-muted-foreground">{tile.hint}</div>
          )}
        </div>
      ))}
    </div>
  );
}
