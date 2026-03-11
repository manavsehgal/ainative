import { z } from "zod";

export const ProfileConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  domain: z.enum(["work", "personal"]),
  tags: z.array(z.string()),
  allowedTools: z.array(z.string()).optional(),
  mcpServers: z.record(z.string(), z.unknown()).optional(),
  canUseToolPolicy: z
    .object({
      autoApprove: z.array(z.string()).optional(),
      autoDeny: z.array(z.string()).optional(),
    })
    .optional(),
  hooks: z
    .object({
      preToolCall: z.array(z.string()).optional(),
      postToolCall: z.array(z.string()).optional(),
    })
    .optional(),
  temperature: z.number().min(0).max(1).optional(),
  maxTurns: z.number().positive().optional(),
  outputFormat: z.string().optional(),
  author: z.string().optional(),
  source: z.string().url().optional(),
  tests: z
    .array(
      z.object({
        task: z.string(),
        expectedKeywords: z.array(z.string()),
      })
    )
    .optional(),
});

export type ProfileConfig = z.infer<typeof ProfileConfigSchema>;
