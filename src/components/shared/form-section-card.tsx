import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormSectionCardProps {
  icon: LucideIcon;
  title: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

export function FormSectionCard({
  icon: Icon,
  title,
  hint,
  className,
  children,
}: FormSectionCardProps) {
  return (
    <section
      className={cn("surface-card-muted rounded-lg p-4 space-y-3", className)}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{title}</span>
      </div>
      {hint && (
        <p className="text-xs text-muted-foreground -mt-1">{hint}</p>
      )}
      {children}
    </section>
  );
}
