import type { LucideIcon } from "lucide-react";

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
    <fieldset
      className={`rounded-lg border border-border/40 bg-card/30 backdrop-blur-sm p-4 space-y-3 ${className ?? ""}`}
    >
      <legend className="flex items-center gap-2 px-1">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{title}</span>
      </legend>
      {hint && (
        <p className="text-xs text-muted-foreground -mt-1">{hint}</p>
      )}
      {children}
    </fieldset>
  );
}
