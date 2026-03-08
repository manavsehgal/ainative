import { Skeleton } from "@/components/ui/skeleton";

export default function InboxLoading() {
  return (
    <div className="p-6">
      <Skeleton className="h-8 w-24 mb-6" />
      <Skeleton className="h-10 w-80 mb-4 rounded-md" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
