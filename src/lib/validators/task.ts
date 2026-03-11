import { z } from "zod";
import { SUPPORTED_AGENT_RUNTIMES } from "@/lib/agents/runtime/catalog";

const assignedAgentSchema = z.enum(SUPPORTED_AGENT_RUNTIMES);

export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional(),
  projectId: z.string().optional(),
  priority: z.number().min(0).max(3).default(2),
  assignedAgent: assignedAgentSchema.optional(),
  agentProfile: z.string().optional(),
  fileIds: z.array(z.string()).optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: z
    .enum(["planned", "queued", "running", "completed", "failed", "cancelled"])
    .optional(),
  priority: z.number().min(0).max(3).optional(),
  assignedAgent: assignedAgentSchema.optional(),
  agentProfile: z.string().optional(),
  result: z.string().optional(),
  sessionId: z.string().optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
