import { Skeleton } from "@/components/ui/skeleton";

export function SkeletonBoard() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {Array.from({ length: 5 }).map((_, colIdx) => (
        <div key={colIdx} className="w-64 shrink-0">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-6 rounded-full" />
          </div>
          <div className="space-y-2 p-2">
            {Array.from({ length: colIdx < 3 ? 3 : 2 }).map((_, cardIdx) => (
              <Skeleton key={cardIdx} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
