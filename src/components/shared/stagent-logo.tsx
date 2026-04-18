import Image from "next/image";

interface AinativeLogoProps {
  size?: number;
  className?: string;
  variant?: "icon" | "symbol";
}

export function StagentLogo({ size = 24, className, variant = "icon" }: AinativeLogoProps) {
  return (
    <span className={`inline-flex items-center justify-center shrink-0 ${className ?? ""}`}>
      <Image
        src="/stagent-s-64.png"
        alt=""
        width={size}
        height={size}
        aria-hidden="true"
      />
    </span>
  );
}
