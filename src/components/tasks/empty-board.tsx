import { ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

export function EmptyBoard() {
  return (
    <EmptyState
      icon={ClipboardList}
      heading="No tasks yet"
      description="Create your first task to get started with the kanban board."
    />
  );
}
