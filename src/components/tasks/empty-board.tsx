import { Card, CardContent } from "@/components/ui/card";
import { ClipboardList } from "lucide-react";

export function EmptyBoard() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-1">No tasks yet</h3>
        <p className="text-sm text-muted-foreground">
          Create your first task to get started with the kanban board.
        </p>
      </CardContent>
    </Card>
  );
}
