import type { KpiTile } from "@/lib/apps/view-kits/types";

interface KPIStripProps {
  tiles: KpiTile[];
}

/**
 * Generic 1-6 tile horizontal strip used by composed-app view kits. Pure
 * presentation — no DB, no state. The view-model author (a kit) is
 * responsible for evaluating KpiSpecs into KpiTile values; this component
 * just renders them.
 *
 * Why clip at 6: the responsive grid (lg:grid-cols-6) wraps awkwardly past
 * 6, and 6 is the design ceiling per the spec. Authors needing 7+ should
 * compose two strips.
 */
export function KPIStrip({ tiles }: KPIStripProps) {
  if (tiles.length === 0) return null;
  const visible = tiles.slice(0, 6);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {visible.map((tile) => (
        <div
          key={tile.id}
          className="rounded-lg border bg-card p-3 space-y-1"
          data-kit-primitive="kpi-tile"
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
