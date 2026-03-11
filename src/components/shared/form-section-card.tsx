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
      className={`surface-card-muted rounded-lg p-4 space-y-3 ${className ?? ""}`}
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
