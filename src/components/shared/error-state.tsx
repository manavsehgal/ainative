import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface ErrorStateProps {
  heading?: string;
  description: string;
  onRetry?: () => void;
}

export function ErrorState({
  heading = "Something went wrong",
  description,
  onRetry,
}: ErrorStateProps) {
  return (
    <Card className="border-l-4 border-l-destructive">
      <CardContent className="flex items-start gap-4 py-6">
        <AlertTriangle className="h-8 w-8 text-destructive shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold mb-1">{heading}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
          {onRetry && (
            <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
