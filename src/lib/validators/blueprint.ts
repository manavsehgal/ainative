import { z } from "zod";
import { parseDuration } from "@/lib/workflows/delay";

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

/**
 * A blueprint step is either a task step (profileId + promptTemplate) OR a
 * delay step (delayDuration). The discriminator lives in the cross-field
 * refinement below — we can't use Zod's discriminatedUnion directly because
 * YAML blueprints don't carry an explicit `type` field, and we want validation
 * errors to point at the actual offending field, not a missing discriminator.
 *
 * See features/workflow-step-delays.md for the XOR rule rationale.
 */
export const BlueprintStepSchema = z
  .object({
    name: z.string(),
    profileId: z.string().optional(),
    promptTemplate: z.string().optional(),
    delayDuration: z.string().optional(),
    requiresApproval: z.boolean(),
    expectedOutput: z.string().optional(),
    condition: z.string().optional(),
  })
  .superRefine((step, ctx) => {
    const hasDelay = step.delayDuration != null;
    const hasProfile = step.profileId != null;
    const hasPrompt = step.promptTemplate != null;
    const hasAnyTaskField = hasProfile || hasPrompt;

    // XOR: exactly one of (delay step) or (task step) must be present.
    if (hasDelay && hasAnyTaskField) {
      ctx.addIssue({
        code: "custom",
        path: ["delayDuration"],
        message:
          "Step cannot be both a delay and a task: remove delayDuration, or remove profileId/promptTemplate.",
      });
      return;
    }

    if (hasDelay) {
      // Delay step: validate the duration string parses and is within bounds.
      try {
        parseDuration(step.delayDuration as string);
      } catch (err) {
        ctx.addIssue({
          code: "custom",
          path: ["delayDuration"],
          message: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }

    // Task step: profileId AND promptTemplate are both required.
    if (!hasProfile) {
      ctx.addIssue({
        code: "custom",
        path: ["profileId"],
        message:
          "Task step requires profileId. For a delay step, set delayDuration instead (e.g. '3d').",
      });
    }
    if (!hasPrompt) {
      ctx.addIssue({
        code: "custom",
        path: ["promptTemplate"],
        message:
          "Task step requires promptTemplate. For a delay step, set delayDuration instead (e.g. '3d').",
      });
    }
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
  source: z.url().optional(),
  estimatedDuration: z.string().optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
});

export type BlueprintConfig = z.infer<typeof BlueprintSchema>;
