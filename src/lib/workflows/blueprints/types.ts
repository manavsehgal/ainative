export interface BlueprintVariable {
  id: string;
  type: "text" | "textarea" | "select" | "number" | "boolean" | "file";
  label: string;
  description?: string;
  required: boolean;
  default?: unknown;
  placeholder?: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
}

/**
 * A blueprint step is either a task step (profileId + promptTemplate) OR a
 * delay step (delayDuration only). The XOR is enforced at validation time
 * by BlueprintStepSchema in src/lib/validators/blueprint.ts — at the type
 * level, all three fields are optional so either shape is assignable.
 */
export interface BlueprintStep {
  name: string;
  profileId?: string;
  promptTemplate?: string;
  /** If set, this step is a pure time delay. Format: Nm|Nh|Nd|Nw. */
  delayDuration?: string;
  requiresApproval: boolean;
  expectedOutput?: string;
  condition?: string;
}

export interface WorkflowBlueprint {
  id: string;
  name: string;
  description: string;
  version: string;
  domain: "work" | "personal";
  tags: string[];
  pattern: "sequence" | "planner-executor" | "checkpoint";
  variables: BlueprintVariable[];
  steps: BlueprintStep[];
  author?: string;
  source?: string;
  estimatedDuration?: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
  isBuiltin?: boolean;
}
