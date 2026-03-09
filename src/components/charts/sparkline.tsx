interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillOpacity?: number;
  label?: string;
  className?: string;
}

export function Sparkline({
  data,
  width = 100,
  height = 24,
  color = "var(--chart-1)",
  fillOpacity = 0.15,
  label = "Sparkline chart",
  className,
}: SparklineProps) {
  // Not enough data — show muted placeholder
  if (data.length < 2) {
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
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="var(--muted-foreground)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          opacity={0.3}
        />
      </svg>
    );
  }

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const padding = 2;
  const chartHeight = height - padding * 2;
  const stepX = width / (data.length - 1);

  const points = data.map((value, i) => {
    const x = i * stepX;
    const y = padding + chartHeight - ((value - min) / range) * chartHeight;
    return `${x},${y}`;
  });

  const polylinePoints = points.join(" ");

  // Area fill: close the path along the bottom
  const areaPoints = `${points[0].split(",")[0]},${height} ${polylinePoints} ${points[points.length - 1].split(",")[0]},${height}`;

  // All zeros — flat muted line
  const isFlat = max === 0 && min === 0;

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
      {isFlat ? (
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="var(--muted-foreground)"
          strokeWidth={1.5}
          opacity={0.3}
        />
      ) : (
        <>
          <polygon
            points={areaPoints}
            fill={color}
            opacity={fillOpacity}
          />
          <polyline
            points={polylinePoints}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  );
}
