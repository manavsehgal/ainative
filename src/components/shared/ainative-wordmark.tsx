import Image from "next/image";

interface AinativeWordmarkProps {
  className?: string;
}

export function AinativeWordmark({ className }: AinativeWordmarkProps) {
  return (
    <span
      className={`group inline-flex items-center gap-0.5 ${className ?? ""}`}
    >
      <span className="inline-flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-[1.03]">
        <Image
          src="/ainative-s-128.png"
          alt=""
          width={34}
          height={34}
          aria-hidden="true"
          priority
        />
      </span>
      <span className="text-2xl font-semibold tracking-tight leading-none">
        <span className="text-primary transition-colors duration-300">ai</span>
        <span className="text-foreground transition-colors duration-300 group-hover:text-primary">
          native
        </span>
        <span className="text-muted-foreground transition-colors duration-300 group-hover:text-primary">
          .business
        </span>
      </span>
    </span>
  );
}
