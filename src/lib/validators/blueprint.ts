import { z } from "zod";

export const BlueprintVariableSchema = z.object({
  id: z.string(),
  type: z.enum(["text", "textarea", "select", "number", "boolean", "file"]),
  label: z.string(),
  description: z.string().optional(),
  required: z.boolean(),
  default: z.unknown().optional(),
  placeholder: z.string().optional(),
  options: z
    .array(z.object({ value: z.string(), label: z.string() }))
    .optional(),
  min: z.number().optional(),
  max: z.number().optional(),
});

export const BlueprintStepSchema = z.object({
  name: z.string(),
  profileId: z.string(),
  promptTemplate: z.string(),
  requiresApproval: z.boolean(),
  expectedOutput: z.string().optional(),
  condition: z.string().optional(),
});

export const BlueprintSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  domain: z.enum(["work", "personal"]),
  tags: z.array(z.string()),
  pattern: z.enum(["sequence", "planner-executor", "checkpoint"]),
  variables: z.array(BlueprintVariableSchema),
  steps: z.array(BlueprintStepSchema).min(1),
  author: z.string().optional(),
  source: z.string().url().optional(),
  estimatedDuration: z.string().optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
});

export type BlueprintConfig = z.infer<typeof BlueprintSchema>;
