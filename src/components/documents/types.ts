import type { DocumentRow } from "@/lib/db/schema";

export type DocumentWithRelations = DocumentRow & {
  taskTitle: string | null;
  projectName: string | null;
  workflowId?: string | null;
  workflowName?: string | null;
  workflowRunNumber?: number | null;
};
