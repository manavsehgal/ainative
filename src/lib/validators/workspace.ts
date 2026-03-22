import { z } from "zod";

export const discoverWorkspaceSchema = z.object({
  parentDir: z
    .string()
    .min(1, "Parent directory is required")
    .max(500),
  maxDepth: z.coerce.number().int().min(1).max(3).default(2),
  markers: z
    .array(z.enum(["claude", "codex"]))
    .min(1, "At least one marker type is required")
    .default(["claude", "codex"]),
});

export const importWorkspaceSchema = z.object({
  projects: z
    .array(
      z.object({
        path: z.string().min(1, "Path is required"),
        name: z.string().min(1, "Name is required").max(100),
      })
    )
    .min(1, "At least one project is required"),
});

export type DiscoverWorkspaceInput = z.infer<typeof discoverWorkspaceSchema>;
export type ImportWorkspaceInput = z.infer<typeof importWorkspaceSchema>;
