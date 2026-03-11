"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, FolderPlus, Inbox, Activity } from "lucide-react";
import { SectionHeading } from "@/components/shared/section-heading";

export function QuickActions() {
  const router = useRouter();

  const actions = [
    {
      label: "New Task",
      description: "Create & queue an agent task",
      icon: Plus,
      onClick: () => router.push("/tasks/new"),
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
      <SectionHeading>Quick Actions</SectionHeading>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {actions.map((action) => (
          <Card
            key={action.label}
            tabIndex={0}
            className="cursor-pointer transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl"
            onClick={action.onClick}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); action.onClick(); } }}
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
    </div>
  );
}
