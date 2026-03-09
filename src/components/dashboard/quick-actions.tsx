"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, FolderPlus, Inbox, Activity } from "lucide-react";
import { TaskCreatePanel } from "@/components/tasks/task-create-panel";

interface QuickActionsProps {
  projects: { id: string; name: string }[];
}

export function QuickActions({ projects }: QuickActionsProps) {
  const router = useRouter();
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);

  const actions = [
    {
      label: "New Task",
      description: "Create & queue an agent task",
      icon: Plus,
      onClick: () => setTaskDialogOpen(true),
    },
    {
      label: "New Project",
      description: "Organize tasks into a project",
      icon: FolderPlus,
      onClick: () => router.push("/projects"),
    },
    {
      label: "Open Inbox",
      description: "Review pending notifications",
      icon: Inbox,
      onClick: () => router.push("/inbox"),
    },
    {
      label: "Open Monitor",
      description: "Watch live agent logs",
      icon: Activity,
      onClick: () => router.push("/monitor"),
    },
  ];

  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
        Quick Actions
      </h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {actions.map((action) => (
          <Card
            key={action.label}
            className="cursor-pointer transition-colors hover:bg-accent/50"
            onClick={action.onClick}
          >
            <CardContent className="flex flex-col items-center justify-center py-5 gap-2">
              <action.icon className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium">{action.label}</span>
              <span className="text-xs text-muted-foreground text-center">
                {action.description}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
      <TaskCreatePanel
        projects={projects}
        onCreated={() => router.refresh()}
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
      />
    </div>
  );
}
