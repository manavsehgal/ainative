"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FolderPlus } from "lucide-react";

export interface RecentProject {
  id: string;
  name: string;
  totalTasks: number;
  completedTasks: number;
}

interface RecentProjectsProps {
  projects: RecentProject[];
}

export function RecentProjects({ projects }: RecentProjectsProps) {
  if (projects.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Recent Projects
        </h3>
        <Card className="p-6 text-center">
          <FolderPlus className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-3">No active projects yet.</p>
          <Link href="/projects">
            <Button variant="outline" size="sm">Create your first project</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Recent Projects
        </h3>
        <Link href="/projects" className="text-xs text-muted-foreground underline hover:text-foreground">
          View all
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((project) => {
          const pct = project.totalTasks > 0
            ? Math.round((project.completedTasks / project.totalTasks) * 100)
            : 0;
          return (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="cursor-pointer transition-colors hover:bg-accent/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium">{project.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Progress value={pct} className="h-1.5 mb-2" />
                  <p className="text-xs text-muted-foreground">
                    {project.completedTasks}/{project.totalTasks} tasks completed
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
