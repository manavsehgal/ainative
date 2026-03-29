import { z } from "zod";
import { SUPPORTED_AGENT_RUNTIMES } from "@/lib/agents/runtime/catalog";

const runtimeIdSchema = z.enum(SUPPORTED_AGENT_RUNTIMES);

const profileTestsSchema = z.array(
  z.object({
    task: z.string(),
    expectedKeywords: z.array(z.string()),
  })
);

const canUseToolPolicySchema = z.object({
  autoApprove: z.array(z.string()).optional(),
  autoDeny: z.array(z.string()).optional(),
});

const profileRuntimeOverrideSchema = z.object({
  instructions: z.string().min(1).optional(),
  allowedTools: z.array(z.string()).optional(),
  mcpServers: z.record(z.string(), z.unknown()).optional(),
  canUseToolPolicy: canUseToolPolicySchema.optional(),
  tests: profileTestsSchema.optional(),
});

export const importMetaSchema = z.object({
  repoUrl: z.string().url(),
  repoOwner: z.string(),
  repoName: z.string(),
  branch: z.string(),
  filePath: z.string(),
  commitSha: z.string(),
  contentHash: z.string(),
  importedAt: z.string(),
  sourceFormat: z.enum(["stagent", "skillmd-only", "unknown"]),
});

export type ImportMeta = z.infer<typeof importMetaSchema>;

export const ProfileConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  domain: z.enum(["work", "personal"]),
  tags: z.array(z.string()),
  allowedTools: z.array(z.string()).optional(),
  mcpServers: z.record(z.string(), z.unknown()).optional(),
  canUseToolPolicy: canUseToolPolicySchema.optional(),
  hooks: z
    .object({
      preToolCall: z.array(z.string()).optional(),
      postToolCall: z.array(z.string()).optional(),
    })
    .optional(),
  maxTurns: z.number().positive().optional(),
  outputFormat: z.string().optional(),
  author: z.string().optional(),
  source: z.string().url().optional(),
  tests: profileTestsSchema.optional(),
  importMeta: importMetaSchema.optional(),
  supportedRuntimes: z.array(runtimeIdSchema).optional(),
  runtimeOverrides: z
    .object(
      Object.fromEntries(
        SUPPORTED_AGENT_RUNTIMES.map((runtimeId) => [
          runtimeId,
          profileRuntimeOverrideSchema.optional(),
        ])
      ) as Record<
        (typeof SUPPORTED_AGENT_RUNTIMES)[number],
        z.ZodOptional<typeof profileRuntimeOverrideSchema>
      >
    )
    .partial()
    .optional(),
});

export type ProfileConfig = z.infer<typeof ProfileConfigSchema>;
