"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, Shield, ArrowRight } from "lucide-react";
import { taskStatusVariant } from "@/lib/constants/status-colors";

export interface PriorityTask {
  id: string;
  title: string;
  status: string;
  priority: number;
  projectName?: string;
}

interface PriorityQueueProps {
  tasks: PriorityTask[];
}

const statusIcon: Record<string, typeof AlertTriangle> = {
  failed: AlertTriangle,
  running: Clock,
};

const priorityColors = ["text-red-500", "text-orange-500", "text-yellow-500", "text-muted-foreground"];

export function PriorityQueue({ tasks }: PriorityQueueProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Needs Attention
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No tasks need attention right now.
          </p>
        ) : (
          <div className="space-y-1">
            {tasks.map((task) => {
              const Icon = statusIcon[task.status] ?? Shield;
              return (
                <div
                  key={task.id}
                  className="flex items-center gap-3 py-2.5 border-b last:border-b-0"
                >
                  <Icon className={`h-4 w-4 flex-shrink-0 ${priorityColors[task.priority] ?? priorityColors[3]}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    {task.projectName && (
                      <p className="text-xs text-muted-foreground">{task.projectName}</p>
                    )}
                  </div>
                  <Badge variant={taskStatusVariant[task.status] ?? "secondary"} className="text-xs">
                    {task.status}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-3">
          <Link href="/dashboard">
            <Button variant="outline" size="sm" className="w-full">
              View all tasks <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
