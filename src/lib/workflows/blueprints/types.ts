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

export interface BlueprintStep {
  name: string;
  profileId: string;
  promptTemplate: string;
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
