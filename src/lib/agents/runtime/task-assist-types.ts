export interface TaskAssistBreakdownStep {
  title: string;
  description: string;
  suggestedProfile?: string;
  requiresApproval?: boolean;
  dependsOn?: number[];
}

export interface TaskAssistResponse {
  improvedDescription: string;
  breakdown: TaskAssistBreakdownStep[];
  recommendedPattern: "single" | "sequence" | "planner-executor" | "checkpoint" | "parallel" | "loop" | "swarm";
  complexity: "simple" | "moderate" | "complex";
  needsCheckpoint: boolean;
  reasoning: string;
  suggestedLoopConfig?: { maxIterations: number; timeBudgetMs?: number };
  suggestedSwarmConfig?: { workerConcurrencyLimit?: number };
}
