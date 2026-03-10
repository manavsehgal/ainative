"use client";

import { useState, useCallback } from "react";
import { FolderKanban } from "lucide-react";
import { ProjectCard } from "./project-card";
import { ProjectCreateDialog } from "./project-create-dialog";
import { ProjectEditDialog } from "./project-edit-dialog";
import { EmptyState } from "@/components/shared/empty-state";

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

  const refresh = useCallback(async () => {
    const res = await fetch("/api/projects");
    if (res.ok) setProjects(await res.json());
  }, []);

  function handleEdit(id: string) {
    const project = projects.find((p) => p.id === id);
    if (project) {
      setEditProject(project);
      setEditOpen(true);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <ProjectCreateDialog onCreated={refresh} />
      </div>
      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          heading="No projects yet"
          description="Create your first project to organize your tasks."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onEdit={handleEdit}
            />
          ))}
        </div>
      )}
      <ProjectEditDialog
        project={editProject}
        open={editOpen}
        onOpenChange={setEditOpen}
        onUpdated={refresh}
      />
    </div>
  );
}
