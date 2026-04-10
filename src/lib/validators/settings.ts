import { z } from "zod";
import { SUPPORTED_AGENT_RUNTIMES } from "@/lib/agents/runtime/catalog";

export const updateAuthSettingsSchema = z.object({
  method: z.enum(["api_key", "oauth"]),
  apiKey: z
    .string()
    .startsWith("sk-ant-", "API key must start with sk-ant-")
    .optional(),
});

export type UpdateAuthSettingsInput = z.infer<typeof updateAuthSettingsSchema>;

export const updateOpenAISettingsSchema = z.object({
  method: z.enum(["api_key", "oauth"]),
  apiKey: z
    .string()
    .startsWith("sk-", "API key must start with sk-")
    .optional(),
});

export type UpdateOpenAISettingsInput = z.infer<typeof updateOpenAISettingsSchema>;

const nullablePositiveNumber = z.preprocess((value) => {
  if (value === "" || value == null) return null;
  if (typeof value === "string") return Number(value);
  return value;
}, z.number().finite().positive().nullable());

export const claudeOAuthPlanSchema = z.enum(["pro", "max_5x", "max_20x"]);

export const runtimeBudgetPolicySchema = z.object({
  monthlySpendCapUsd: nullablePositiveNumber,
  claudeOAuthPlan: claudeOAuthPlanSchema.optional(),
});

export const budgetPolicySchema = z.object({
  overall: z.object({
    monthlySpendCapUsd: nullablePositiveNumber,
  }),
  runtimes: z.object(
    Object.fromEntries(
      SUPPORTED_AGENT_RUNTIMES.map((runtimeId) => [runtimeId, runtimeBudgetPolicySchema])
    ) as Record<(typeof SUPPORTED_AGENT_RUNTIMES)[number], typeof runtimeBudgetPolicySchema>
  ),
});

export const updateBudgetPolicySchema = budgetPolicySchema;

export type RuntimeBudgetPolicy = z.infer<typeof runtimeBudgetPolicySchema>;
export type BudgetPolicy = z.infer<typeof budgetPolicySchema>;
export type UpdateBudgetPolicyInput = z.infer<typeof updateBudgetPolicySchema>;
export type ClaudeOAuthPlan = z.infer<typeof claudeOAuthPlanSchema>;
