import type { ColumnDef, FilterSpec } from "@/lib/tables/types";
import type { WorkflowEnrichmentTargetContract } from "@/lib/workflows/types";

export type EnrichmentPromptMode = "auto" | "custom";
export type EnrichmentStrategy =
  | "single-pass-lookup"
  | "single-pass-classify"
  | "research-and-synthesize";

export interface EnrichmentRow {
  id: string;
  data: Record<string, unknown>;
}

export interface EnrichmentPlanStep {
  id: string;
  name: string;
  purpose: string;
  prompt: string;
  agentProfile?: string;
}

export interface EnrichmentPlan {
  promptMode: EnrichmentPromptMode;
  strategy: EnrichmentStrategy;
  agentProfile: string;
  reasoning: string;
  steps: EnrichmentPlanStep[];
  targetContract: WorkflowEnrichmentTargetContract;
  eligibleRowCount: number;
  sampleBindings: Array<Record<string, unknown>>;
}

export interface BuildEnrichmentPlanInput {
  targetColumn: ColumnDef;
  sampleRows: EnrichmentRow[];
  eligibleRowCount: number;
  promptMode: EnrichmentPromptMode;
  prompt?: string;
  agentProfileOverride?: string;
  filter?: FilterSpec;
}

const LOOKUP_TYPES = new Set(["url", "email", "number"]);
const CLASSIFY_TYPES = new Set(["select", "boolean"]);

// Plan preview ships only 2 sample rows so the LLM-rendered reasoning panel stays
// within budget for small models (Haiku, gpt-5.4-mini). Revisit if operators report
// under-prompted strategies on high-cardinality tables where 2 rows under-represent
// the value distribution.
const PREVIEW_SAMPLE_BINDING_COUNT = 2;
const SUPPORTED_TYPES = new Set([
  "text",
  "number",
  "boolean",
  "select",
  "url",
  "email",
]);

export function assertEnrichmentCompatibleColumn(column: ColumnDef): void {
  if (!SUPPORTED_TYPES.has(column.dataType)) {
    throw new Error(
      `Column "${column.displayName}" uses unsupported data type "${column.dataType}" for enrichment`
    );
  }
}

export function buildTargetContract(
  column: ColumnDef
): WorkflowEnrichmentTargetContract {
  assertEnrichmentCompatibleColumn(column);
  return {
    columnName: column.name,
    columnLabel: column.displayName,
    dataType: column.dataType as WorkflowEnrichmentTargetContract["dataType"],
    allowedOptions:
      column.dataType === "select"
        ? [...(column.config?.options ?? [])]
        : undefined,
  };
}

export function buildEnrichmentPlan(
  input: BuildEnrichmentPlanInput
): EnrichmentPlan {
  const targetContract = buildTargetContract(input.targetColumn);
  const strategy = selectStrategy(targetContract, input.promptMode, input.prompt);
  const agentProfile =
    input.agentProfileOverride?.trim() ||
    recommendAgentProfile(strategy, targetContract);
  const reasoning = buildReasoning({
    targetContract,
    strategy,
    filter: input.filter,
    hasPromptOverride: Boolean(input.prompt?.trim()),
  });

  if (input.promptMode === "custom") {
    const customPrompt = input.prompt?.trim();
    if (!customPrompt) {
      throw new Error("Custom enrichment requires a prompt");
    }
    return {
      promptMode: "custom",
      strategy,
      agentProfile,
      reasoning,
      steps: [
        {
          id: "final",
          name: "Write final value",
          purpose: "Generate the final typed value for the target column",
          prompt: wrapPromptWithOutputContract(customPrompt, targetContract),
          agentProfile,
        },
      ],
      targetContract,
      eligibleRowCount: input.eligibleRowCount,
      sampleBindings: input.sampleRows
        .slice(0, PREVIEW_SAMPLE_BINDING_COUNT)
        .map((row) => ({ id: row.id, ...row.data })),
    };
  }

  return {
    promptMode: "auto",
    strategy,
    agentProfile,
    reasoning,
    steps: buildAutoPlanSteps(strategy, targetContract, input.prompt, agentProfile),
    targetContract,
    eligibleRowCount: input.eligibleRowCount,
    sampleBindings: input.sampleRows.slice(0, 2).map((row) => ({
      id: row.id,
      ...row.data,
    })),
  };
}

export function validateEnrichmentPlan(
  plan: EnrichmentPlan,
  column: ColumnDef
): void {
  const targetContract = buildTargetContract(column);

  if (plan.steps.length === 0) {
    throw new Error("Enrichment plan must contain at least one step");
  }

  if (plan.targetContract.dataType !== targetContract.dataType) {
    throw new Error("Enrichment plan target contract does not match the table column");
  }

  if (plan.targetContract.columnName !== column.name) {
    throw new Error("Enrichment plan target column does not match the table column");
  }

  if ((plan.agentProfile ?? "").trim() === "") {
    throw new Error("Enrichment plan must specify an agent profile");
  }

  const lastStep = plan.steps[plan.steps.length - 1];
  if (!lastStep.prompt.includes("RESPONSE FORMAT")) {
    throw new Error("Enrichment plan final step is missing the typed response contract");
  }

  if (plan.targetContract.dataType === "select") {
    const expected = targetContract.allowedOptions ?? [];
    const actual = plan.targetContract.allowedOptions ?? [];
    if (
      expected.length !== actual.length ||
      expected.some((option, index) => actual[index] !== option)
    ) {
      throw new Error("Enrichment plan select options do not match the table column");
    }
  }

  if (plan.promptMode === "custom" && plan.steps.length !== 1) {
    throw new Error("Custom enrichment plans must be single-step");
  }
}

export function wrapPromptWithOutputContract(
  userPrompt: string,
  target:
    | WorkflowEnrichmentTargetContract
    | string
): string {
  const base = userPrompt.trim();
  const targetContract =
    typeof target === "string"
      ? {
          columnName: target,
          columnLabel: target,
          dataType: "text" as const,
        }
      : target;
  const instructions = contractInstructions(targetContract);
  return [base, "", "---", "RESPONSE FORMAT (strict):", ...instructions].join(
    "\n"
  );
}

export function normalizeEnrichmentOutput(
  raw: string | undefined | null,
  targetContract: WorkflowEnrichmentTargetContract
):
  | { kind: "skip"; reason: "empty" | "not_found" }
  | { kind: "invalid"; reason: string }
  | { kind: "valid"; value: string | number | boolean } {
  const value = (raw ?? "").trim();
  if (value === "") {
    return { kind: "skip", reason: "empty" };
  }
  if (value.toUpperCase() === "NOT_FOUND") {
    return { kind: "skip", reason: "not_found" };
  }

  switch (targetContract.dataType) {
    case "text":
      return { kind: "valid", value };
    case "url": {
      try {
        const url = new URL(value);
        return { kind: "valid", value: url.toString() };
      } catch {
        return { kind: "invalid", reason: "Expected a valid URL or NOT_FOUND" };
      }
    }
    case "email": {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(value)) {
        return {
          kind: "invalid",
          reason: "Expected a valid email address or NOT_FOUND",
        };
      }
      return { kind: "valid", value };
    }
    case "boolean": {
      const lower = value.toLowerCase();
      if (lower === "true") return { kind: "valid", value: true };
      if (lower === "false") return { kind: "valid", value: false };
      return {
        kind: "invalid",
        reason: "Expected exactly true, false, or NOT_FOUND",
      };
    }
    case "number": {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) {
        return {
          kind: "invalid",
          reason: "Expected a bare numeric value or NOT_FOUND",
        };
      }
      return { kind: "valid", value: numeric };
    }
    case "select": {
      const options = targetContract.allowedOptions ?? [];
      const match = options.find(
        (option) => option.toLowerCase() === value.toLowerCase()
      );
      if (!match) {
        return {
          kind: "invalid",
          reason: `Expected one of ${options.join(", ")} or NOT_FOUND`,
        };
      }
      return { kind: "valid", value: match };
    }
  }
}

function selectStrategy(
  contract: WorkflowEnrichmentTargetContract,
  promptMode: EnrichmentPromptMode,
  prompt?: string
): EnrichmentStrategy {
  if (promptMode === "custom") {
    if (CLASSIFY_TYPES.has(contract.dataType)) return "single-pass-classify";
    return "single-pass-lookup";
  }

  if (CLASSIFY_TYPES.has(contract.dataType)) {
    return "single-pass-classify";
  }
  if (LOOKUP_TYPES.has(contract.dataType)) {
    return "single-pass-lookup";
  }

  const hint = (prompt ?? "").toLowerCase();
  if (
    hint.includes("research") ||
    hint.includes("synthesize") ||
    hint.includes("score") ||
    hint.includes("summary") ||
    hint.includes("why ")
  ) {
    return "research-and-synthesize";
  }

  return "single-pass-lookup";
}

function recommendAgentProfile(
  strategy: EnrichmentStrategy,
  contract: WorkflowEnrichmentTargetContract
): string {
  if (strategy === "research-and-synthesize") {
    return "data-analyst";
  }
  if (contract.dataType === "url" || contract.dataType === "email") {
    return "sales-researcher";
  }
  if (contract.dataType === "text") {
    return "general";
  }
  return "data-analyst";
}

function buildReasoning(input: {
  targetContract: WorkflowEnrichmentTargetContract;
  strategy: EnrichmentStrategy;
  filter?: FilterSpec;
  hasPromptOverride: boolean;
}): string {
  const reasons: string[] = [];
  if (input.targetContract.dataType === "select") {
    reasons.push("Target column is categorical, so the plan uses a classification path.");
  } else if (input.targetContract.dataType === "boolean") {
    reasons.push("Target column expects a boolean, so the plan enforces a strict true/false contract.");
  } else if (input.targetContract.dataType === "text") {
    reasons.push(
      input.strategy === "research-and-synthesize"
        ? "Target column is free-form text and the prompt hints at synthesis, so the plan separates research from final writeback."
        : "Target column is free-form text, so the plan keeps the row flow lightweight unless the prompt asks for deeper synthesis."
    );
  } else {
    reasons.push("Target column expects a concrete factual value, so the plan keeps the row flow single-pass.");
  }

  if (input.filter) {
    reasons.push(`Preview applies the current filter on "${input.filter.column}" before fan-out.`);
  }
  if (input.hasPromptOverride) {
    reasons.push("Planner includes the operator's extra instructions when generating prompts.");
  }

  return reasons.join(" ");
}

function buildAutoPlanSteps(
  strategy: EnrichmentStrategy,
  targetContract: WorkflowEnrichmentTargetContract,
  prompt: string | undefined,
  agentProfile: string
): EnrichmentPlanStep[] {
  const extraGuidance = prompt?.trim()
    ? `\n\nAdditional operator guidance:\n${prompt.trim()}`
    : "";

  if (strategy === "research-and-synthesize") {
    return [
      {
        id: "research",
        name: "Research row context",
        purpose: "Gather concise evidence about the current row before final synthesis",
        prompt:
          `Research the current row and capture only the evidence needed to determine a value for the "${targetContract.columnLabel}" column.` +
          "\nFocus on facts, cite the specific row fields that shaped the search, and keep the output concise enough for a second agent step to consume." +
          extraGuidance,
        agentProfile,
      },
      {
        id: "final",
        name: "Write final value",
        purpose: "Convert the research output into the final typed value",
        prompt: wrapPromptWithOutputContract(
          `Using the research summary below, produce the final value for the "${targetContract.columnLabel}" column.\n\nResearch summary:\n{{previous}}`,
          targetContract
        ),
        agentProfile,
      },
    ];
  }

  if (strategy === "single-pass-classify") {
    return [
      {
        id: "final",
        name: "Classify row",
        purpose: "Determine the final typed category for this row",
        prompt: wrapPromptWithOutputContract(
          `Classify the current row into the correct value for the "${targetContract.columnLabel}" column.${extraGuidance}`,
          targetContract
        ),
        agentProfile,
      },
    ];
  }

  return [
    {
      id: "final",
      name: "Lookup value",
      purpose: "Determine the final typed value for this row",
      prompt: wrapPromptWithOutputContract(
        `Determine the best value for the "${targetContract.columnLabel}" column for the current row.${extraGuidance}`,
        targetContract
      ),
      agentProfile,
    },
  ];
}

function contractInstructions(
  targetContract: WorkflowEnrichmentTargetContract
): string[] {
  const intro = [
    `- Return ONLY the value to write into the "${targetContract.columnLabel}" column.`,
    "- No explanations, no markdown, no preamble, and no source citations.",
    '- Do NOT return prose like "Not found" or "Insufficient data" — use NOT_FOUND instead.',
  ];

  switch (targetContract.dataType) {
    case "text":
      return [
        ...intro,
        "- Return a plain text value, or the literal string NOT_FOUND.",
      ];
    case "url":
      return [
        ...intro,
        "- Return one valid absolute URL, or the literal string NOT_FOUND.",
      ];
    case "email":
      return [
        ...intro,
        "- Return one valid email address, or the literal string NOT_FOUND.",
      ];
    case "boolean":
      return [
        ...intro,
        "- Return exactly one of: true, false, NOT_FOUND.",
      ];
    case "number":
      return [
        ...intro,
        "- Return one bare numeric value with no units or prose, or the literal string NOT_FOUND.",
      ];
    case "select":
      return [
        ...intro,
        `- Return exactly one of: ${(targetContract.allowedOptions ?? []).join(", ")}, NOT_FOUND.`,
      ];
  }
}
