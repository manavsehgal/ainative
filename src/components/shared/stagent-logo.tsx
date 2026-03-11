interface StagentLogoProps {
  size?: number;
  className?: string;
}

export function StagentLogo({ size = 24, className }: StagentLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* S-shaped path: two arcs forming the letterform */}
      <path
        d="M16.5 3.5C16.5 3.5 13 3.5 10 5.5C7 7.5 7 11 10 12C13 13 13 13 13 13C16 14 16.5 17.5 13.5 19.5C10.5 21.5 7.5 20.5 7.5 20.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Top agent node */}
      <circle cx="16.5" cy="3.5" r="2" fill="currentColor" />
      {/* Bottom agent node */}
      <circle cx="7.5" cy="20.5" r="2" fill="currentColor" />
    </svg>
  );
}
