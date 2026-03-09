import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  children: React.ReactNode;
  className?: string;
}

export function SectionHeading({ children, className }: SectionHeadingProps) {
  return (
    <h3 className={cn("text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3", className)}>
      {children}
    </h3>
  );
}
