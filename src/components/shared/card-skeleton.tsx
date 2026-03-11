import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface CardSkeletonProps {
  /** Width class for the title skeleton (default: "w-24") */
  titleWidth?: string;
  /** Number of body skeleton lines (default: 2) */
  lines?: number;
  /** Additional className on the Card */
  className?: string;
  /** Show a subtitle skeleton below the title */
  subtitle?: boolean;
  /** Custom skeleton content instead of default lines */
  children?: React.ReactNode;
}

export function CardSkeleton({
  titleWidth = "w-24",
  lines = 2,
  className,
  subtitle,
  children,
}: CardSkeletonProps) {
  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-2">
        <Skeleton className={cn("h-4", titleWidth)} />
        {subtitle && <Skeleton className="h-3 w-32 mt-1" />}
      </CardHeader>
      <CardContent className="space-y-2">
        {children ??
          Array.from({ length: lines }, (_, i) => (
            <Skeleton
              key={i}
              className={cn("h-3", i === lines - 1 ? "w-3/4" : "w-full")}
            />
          ))}
      </CardContent>
    </Card>
  );
}
