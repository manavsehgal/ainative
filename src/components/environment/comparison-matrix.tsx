"use client";

import Link from "next/link";
import { Globe, ArrowRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ArtifactPresenceCell } from "./artifact-presence-cell";
import { CATEGORY_META } from "./summary-cards-row";
import type { ComparisonMatrix as MatrixData } from "@/lib/environment/comparison";

interface ComparisonMatrixProps {
  matrix: MatrixData;
}

export function ComparisonMatrix({ matrix }: ComparisonMatrixProps) {
  if (matrix.projects.length === 0) {
    return (
      <EmptyState
        icon={Globe}
        heading="No projects to compare"
        description="Create projects with working directories and scan their environments to see a comparison matrix."
      />
    );
  }

  const scannedProjects = matrix.projects.filter((p) => p.scanId);

  if (scannedProjects.length === 0) {
    return (
      <EmptyState
        icon={Globe}
        heading="No scanned projects"
        description="Scan at least one project's environment to see the comparison matrix."
      />
    );
  }

  // Build a lookup: projectId → category → count
  const lookup = new Map<string, Map<string, number>>();
  for (const cell of matrix.cells) {
    if (!lookup.has(cell.projectId)) {
      lookup.set(cell.projectId, new Map());
    }
    lookup.get(cell.projectId)!.set(cell.category, cell.count);
  }

  // Calculate medians per category for color coding
  const medians = new Map<string, number>();
  for (const cat of matrix.categories) {
    const values = scannedProjects
      .map((p) => lookup.get(p.id)?.get(cat) || 0)
      .sort((a, b) => a - b);
    const mid = Math.floor(values.length / 2);
    medians.set(cat, values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2);
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-background z-10 min-w-[180px]">
              Project
            </TableHead>
            {matrix.categories.map((cat) => {
              const meta = CATEGORY_META[cat];
              return (
                <TableHead key={cat} className="text-center min-w-[90px]">
                  <span className="text-xs">{meta?.label || cat}</span>
                </TableHead>
              );
            })}
            <TableHead className="text-center min-w-[70px]">
              <span className="text-xs">Total</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {matrix.projects.map((project) => {
            const projectCounts = lookup.get(project.id);
            const total = projectCounts
              ? Array.from(projectCounts.values()).reduce((a, b) => a + b, 0)
              : 0;

            return (
              <TableRow key={project.id}>
                <TableCell className="sticky left-0 bg-background z-10 font-medium">
                  <Link
                    href={`/projects/${project.id}`}
                    className="hover:underline text-sm"
                  >
                    {project.name}
                  </Link>
                  {!project.scanId && (
                    <Badge variant="secondary" className="ml-2 text-[10px]">
                      not scanned
                    </Badge>
                  )}
                </TableCell>
                {matrix.categories.map((cat) => {
                  const count = projectCounts?.get(cat) || 0;
                  const median = medians.get(cat) || 0;

                  return (
                    <TableCell key={cat} className="text-center p-1">
                      <ArtifactPresenceCell
                        count={count}
                        median={median}
                        hasData={!!project.scanId}
                      />
                    </TableCell>
                  );
                })}
                <TableCell className="text-center">
                  <span className="text-sm font-semibold">{total}</span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
