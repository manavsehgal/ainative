export interface TaskAssistResponse {
  improvedDescription: string;
  breakdown: { title: string; description: string }[];
  recommendedPattern: "single" | "sequence" | "planner-executor" | "checkpoint";
  complexity: "simple" | "moderate" | "complex";
  needsCheckpoint: boolean;
  reasoning: string;
}
