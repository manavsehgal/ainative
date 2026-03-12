"use client";

import { useState, useCallback, useRef } from "react";
import { FolderKanban } from "lucide-react";
import { ProjectCard } from "./project-card";
import { ProjectCreateDialog } from "./project-create-dialog";
import { ProjectEditDialog } from "./project-edit-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeading } from "@/components/shared/section-heading";

interface Project {
  id: string;
  name: string;
  description: string | null;
  workingDirectory: string | null;
  status: string;
  taskCount: number;
}

export function ProjectList({ initialProjects }: { initialProjects: Project[] }) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const activeProjects = projects.filter((project) => project.status === "active").length;
  const totalTasks = projects.reduce((sum, project) => sum + project.taskCount, 0);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/projects");
    if (res.ok) setProjects(await res.json());
  }, []);

  function handleEdit(id: string, trigger: HTMLElement | null) {
    const project = projects.find((p) => p.id === id);
    if (project) {
      restoreFocusRef.current = trigger;
      setEditProject(project);
      setEditOpen(true);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Keep agent work anchored to durable project spaces so tasks, files, and follow-up flows stay legible.
          </p>
        </div>
        <ProjectCreateDialog onCreated={refresh} />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="surface-control rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Total Projects
          </p>
          <p className="mt-3 text-3xl font-semibold">{projects.length}</p>
        </div>
        <div className="surface-control rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Active
          </p>
          <p className="mt-3 text-3xl font-semibold">{activeProjects}</p>
        </div>
        <div className="surface-control rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Linked Tasks
          </p>
          <p className="mt-3 text-3xl font-semibold">{totalTasks}</p>
        </div>
      </div>

      <section className="surface-panel rounded-[24px] p-4 sm:p-5">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <SectionHeading className="mb-0">All Projects</SectionHeading>
          <p className="text-xs text-muted-foreground">{projects.length} visible</p>
        </div>
        {projects.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            heading="No projects yet"
            description="Create your first project to organize your tasks."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onEdit={handleEdit}
              />
            ))}
          </div>
        )}
      </section>

      <ProjectEditDialog
        project={editProject}
        open={editOpen}
        onOpenChange={setEditOpen}
        onUpdated={refresh}
        restoreFocusElement={restoreFocusRef.current}
      />
    </div>
  );
}
