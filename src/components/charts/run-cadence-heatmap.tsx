export type CadenceCell = {
  date: string;
  runs: number;
  status?: "success" | "fail";
};

export interface RunCadenceHeatmapProps {
  cells: CadenceCell[];
  weeks?: number;
}

const CELL_SIZE = 12;
const CELL_GAP = 2;

export function RunCadenceHeatmap({ cells, weeks = 12 }: RunCadenceHeatmapProps) {
  const days = weeks * 7;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cellMap = new Map<string, CadenceCell>();
  cells.forEach((c) => cellMap.set(c.date, c));

  const grid: { date: string; runs: number; status?: "success" | "fail" }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const cell = cellMap.get(key);
    grid.push({
      date: key,
      runs: cell?.runs ?? 0,
      status: cell?.status,
    });
  }

  const width = weeks * (CELL_SIZE + CELL_GAP);
  const height = 7 * (CELL_SIZE + CELL_GAP);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="text-muted-foreground"
    >
      {grid.map((cell, i) => {
        const week = Math.floor(i / 7);
        const day = i % 7;
        const x = week * (CELL_SIZE + CELL_GAP);
        const y = day * (CELL_SIZE + CELL_GAP);
        const intensity = cell.runs === 0 ? 0 : Math.min(cell.runs / 3, 1);
        const fill =
          cell.status === "fail"
            ? "var(--destructive)"
            : `color-mix(in srgb, var(--accent) ${intensity * 100}%, var(--muted))`;
        return (
          <rect
            key={cell.date}
            x={x}
            y={y}
            width={CELL_SIZE}
            height={CELL_SIZE}
            rx={2}
            fill={fill}
            data-heatmap-cell=""
            data-date={cell.date}
            data-runs={String(cell.runs)}
            data-status={cell.status ?? ""}
          />
        );
      })}
    </svg>
  );
}
