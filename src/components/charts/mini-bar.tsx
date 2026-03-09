interface BarDatum {
  value: number;
  color?: string;
  label?: string;
}

interface MiniBarProps {
  data: BarDatum[];
  width?: number;
  height?: number;
  gap?: number;
  defaultColor?: string;
  label?: string;
  className?: string;
}

export function MiniBar({
  data,
  width = 200,
  height = 32,
  gap = 1,
  defaultColor = "var(--chart-1)",
  label = "Bar chart",
  className,
}: MiniBarProps) {
  if (data.length === 0) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={label}
        className={className}
      >
        <title>{label}</title>
      </svg>
    );
  }

  const max = Math.max(...data.map((d) => d.value));
  const barWidth = (width - gap * (data.length - 1)) / data.length;
  const padding = 2;
  const chartHeight = height - padding;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      className={className}
    >
      <title>{label}</title>
      {data.map((d, i) => {
        const barHeight = max > 0 ? (d.value / max) * chartHeight : 0;
        const x = i * (barWidth + gap);
        const y = height - barHeight;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barWidth}
            height={Math.max(barHeight, 1)}
            rx={1}
            fill={d.color ?? defaultColor}
            opacity={barHeight > 0 ? 0.8 : 0.15}
          />
        );
      })}
    </svg>
  );
}
