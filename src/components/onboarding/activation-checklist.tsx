"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DonutRing } from "./donut-ring";

interface Milestone {
  id: string;
  label: string;
  completed: boolean;
}

interface ProgressData {
  milestones: Milestone[];
  completedCount: number;
  totalCount: number;
}

/**
 * Activation checklist showing 6 milestones for new users.
 * Disappears when all milestones are complete.
 */
export function ActivationChecklist() {
  const [data, setData] = useState<ProgressData | null>(null);

  useEffect(() => {
    fetch("/api/onboarding/progress")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => {});
  }, []);

  if (!data || data.completedCount >= data.totalCount) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Getting Started</CardTitle>
          <DonutRing completed={data.completedCount} total={data.totalCount} size={40} />
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {data.milestones.map((m) => (
            <li key={m.id} className="flex items-center gap-2">
              {m.completed ? (
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <span
                className={`text-xs ${m.completed ? "text-muted-foreground line-through" : ""}`}
              >
                {m.label}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
