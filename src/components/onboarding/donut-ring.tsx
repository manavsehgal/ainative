"use client";

interface DonutRingProps {
  completed: number;
  total: number;
  size?: number;
}

/**
 * SVG donut ring chart showing completion progress.
 * Uses OKLCH accent color with CSS transition for animation.
 */
export function DonutRing({ completed, total, size = 64 }: DonutRingProps) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = total > 0 ? completed / total : 0;
  const offset = circumference * (1 - ratio);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/20"
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="oklch(0.6 0.2 250)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <span className="absolute text-xs font-medium">
        {completed}/{total}
      </span>
    </div>
  );
}
