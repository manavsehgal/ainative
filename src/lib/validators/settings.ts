import { z } from "zod";

export const updateAuthSettingsSchema = z.object({
  method: z.enum(["api_key", "oauth"]),
  apiKey: z
    .string()
    .startsWith("sk-ant-", "API key must start with sk-ant-")
    .optional(),
});

export type UpdateAuthSettingsInput = z.infer<typeof updateAuthSettingsSchema>;

export const updateOpenAISettingsSchema = z.object({
  apiKey: z
    .string()
    .startsWith("sk-", "API key must start with sk-"),
});

export type UpdateOpenAISettingsInput = z.infer<typeof updateOpenAISettingsSchema>;
