/**
 * Profile suggestion rules engine.
 * Maps artifact clusters to agent profile suggestions.
 *
 * Two-tier system:
 * - Tier 1 (Curated): 6 hardcoded rules with high confidence (0.65-1.0)
 * - Tier 2 (Discovered): Any unlinked skill artifact with valid SKILL.md
 *   frontmatter becomes a generic suggestion at confidence 0.5
 */

import type { EnvironmentArtifactRow } from "@/lib/db/schema";

export interface ArtifactMatcher {
  category: string;
  namePattern: string; // substring match against artifact name
}

export interface ProfileRule {
  id: string;
  name: string;
  description: string;
  requiredArtifacts: ArtifactMatcher[];
  optionalArtifacts: ArtifactMatcher[];
  suggestedTools: string[];
  systemPromptTemplate: string;
  baseConfidence: number;
  tags: string[];
}

export type SuggestionTier = "curated" | "discovered";

export interface ProfileSuggestion {
  ruleId: string;
  name: string;
  description: string;
  confidence: number;
  tier: SuggestionTier;
  matchedArtifacts: Array<{ id: string; name: string; category: string }>;
  suggestedTools: string[];
  systemPrompt: string;
  tags: string[];
}

/** Check if an artifact matches a matcher pattern. */
function matchesArtifact(
  artifact: EnvironmentArtifactRow,
  matcher: ArtifactMatcher
): boolean {
  return (
    artifact.category === matcher.category &&
    artifact.name.toLowerCase().includes(matcher.namePattern.toLowerCase())
  );
}

/** The 6 starter rules. */
export const PROFILE_RULES: ProfileRule[] = [
  {
    id: "security-reviewer",
    name: "Security Reviewer",
    description: "Code auditing focused on OWASP vulnerabilities, injection risks, and security best practices",
    requiredArtifacts: [
      { category: "skill", namePattern: "code-review" },
    ],
    optionalArtifacts: [
      { category: "skill", namePattern: "security-best-practices" },
      { category: "skill", namePattern: "security-threat-model" },
      { category: "skill", namePattern: "security-ownership-map" },
    ],
    suggestedTools: ["Read", "Grep", "Glob", "Bash"],
    systemPromptTemplate: "You are a security-focused code reviewer. Prioritize OWASP Top 10 vulnerabilities, injection risks, authentication flaws, and data exposure. Use structured findings with severity levels (CRITICAL, WARNING, SUGGESTION).",
    baseConfidence: 0.7,
    tags: ["security", "code-review", "owasp", "audit"],
  },
  {
    id: "qa-tester",
    name: "QA Tester",
    description: "Test creation, browser automation, and coverage analysis using Playwright and testing frameworks",
    requiredArtifacts: [
      { category: "skill", namePattern: "quality-manager" },
    ],
    optionalArtifacts: [
      { category: "mcp-server", namePattern: "playwright" },
      { category: "skill", namePattern: "qa-tester" },
    ],
    suggestedTools: ["Read", "Write", "Bash", "Glob", "Grep"],
    systemPromptTemplate: "You are a QA specialist focused on test creation, coverage analysis, and browser-based feature verification. Write tests using the project's testing framework and verify acceptance criteria.",
    baseConfidence: 0.7,
    tags: ["testing", "qa", "coverage", "automation"],
  },
  {
    id: "investigator",
    name: "Investigator",
    description: "Web research, source gathering, and citation tracking for deep analysis tasks",
    requiredArtifacts: [
      { category: "skill", namePattern: "capture" },
    ],
    optionalArtifacts: [
      { category: "skill", namePattern: "researcher" },
      { category: "skill", namePattern: "refer" },
    ],
    suggestedTools: ["Read", "WebSearch", "WebFetch", "Grep"],
    systemPromptTemplate: "You are a research investigator. Gather information from web sources, captured documentation, and reference libraries. Track citations and provide well-sourced analysis.",
    baseConfidence: 0.65,
    tags: ["research", "web", "citations", "analysis"],
  },
  {
    id: "document-specialist",
    name: "Document Specialist",
    description: "Document processing, format conversion, and content extraction across PDF, Word, and spreadsheets",
    requiredArtifacts: [
      { category: "skill", namePattern: "pdf" },
    ],
    optionalArtifacts: [
      { category: "skill", namePattern: "docx" },
      { category: "skill", namePattern: "xlsx" },
      { category: "skill", namePattern: "pptx" },
      { category: "skill", namePattern: "document-writer" },
    ],
    suggestedTools: ["Read", "Write", "Bash"],
    systemPromptTemplate: "You are a document processing specialist. Handle PDF extraction, Word document generation, spreadsheet analysis, and format conversion. Produce clean, well-structured outputs.",
    baseConfidence: 0.65,
    tags: ["documents", "pdf", "word", "spreadsheets"],
  },
  {
    id: "code-architect",
    name: "Code Architect",
    description: "Frontend design with design system awareness, component creation, and UI code review",
    requiredArtifacts: [
      { category: "skill", namePattern: "frontend-design" },
    ],
    optionalArtifacts: [
      { category: "skill", namePattern: "taste" },
      { category: "skill", namePattern: "frontend-designer" },
    ],
    suggestedTools: ["Read", "Write", "Edit", "Glob", "Grep"],
    systemPromptTemplate: "You are a code architect specializing in frontend design. Create production-grade components following design system conventions. Review code for design consistency and UI quality.",
    baseConfidence: 0.65,
    tags: ["frontend", "design", "components", "architecture"],
  },
  {
    id: "devops-engineer",
    name: "DevOps Engineer",
    description: "CI/CD pipelines, infrastructure configuration, and deployment automation",
    requiredArtifacts: [
      { category: "skill", namePattern: "devops-engineer" },
    ],
    optionalArtifacts: [
      { category: "permission", namePattern: "Bash" },
      { category: "skill", namePattern: "technical-writer" },
    ],
    suggestedTools: ["Bash", "Read", "Write", "Grep"],
    systemPromptTemplate: "You are a DevOps engineer focused on CI/CD pipelines, infrastructure automation, and deployment workflows. Analyze configs, suggest improvements, and automate operational tasks.",
    baseConfidence: 0.65,
    tags: ["devops", "ci-cd", "infrastructure", "deployment"],
  },
];

/**
 * Evaluate all rules against a set of artifacts.
 * Returns suggestions sorted by confidence (highest first).
 */
export function evaluateRules(
  artifacts: EnvironmentArtifactRow[]
): ProfileSuggestion[] {
  const suggestions: ProfileSuggestion[] = [];

  for (const rule of PROFILE_RULES) {
    const matched: ProfileSuggestion["matchedArtifacts"] = [];
    let allRequired = true;

    // Check required artifacts
    for (const req of rule.requiredArtifacts) {
      const match = artifacts.find((a) => matchesArtifact(a, req));
      if (match) {
        matched.push({ id: match.id, name: match.name, category: match.category });
      } else {
        allRequired = false;
        break;
      }
    }

    if (!allRequired) continue;

    // Check optional artifacts (boost confidence)
    let confidenceBoost = 0;
    for (const opt of rule.optionalArtifacts) {
      const match = artifacts.find((a) => matchesArtifact(a, opt));
      if (match) {
        matched.push({ id: match.id, name: match.name, category: match.category });
        confidenceBoost += 0.1;
      }
    }

    const confidence = Math.min(rule.baseConfidence + confidenceBoost, 1.0);

    suggestions.push({
      ruleId: rule.id,
      name: rule.name,
      description: rule.description,
      confidence,
      tier: "curated",
      matchedArtifacts: matched,
      suggestedTools: rule.suggestedTools,
      systemPrompt: rule.systemPromptTemplate,
      tags: rule.tags,
    });
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

// ---------------------------------------------------------------------------
// Tier 2: Auto-discovered suggestions from unlinked skill artifacts
// ---------------------------------------------------------------------------

const TIER2_CONFIDENCE = 0.5;

/** Parse YAML frontmatter from SKILL.md preview content. */
function parseFrontmatter(preview: string | null): { name?: string; description?: string } {
  if (!preview) return {};
  const match = preview.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};

  const result: { name?: string; description?: string } = {};
  const lines = match[1].split("\n");
  for (const line of lines) {
    const nameMatch = line.match(/^name:\s*(.+)/);
    if (nameMatch) result.name = nameMatch[1].trim();
    const descMatch = line.match(/^description:\s*(.+)/);
    if (descMatch) result.description = descMatch[1].trim();
  }
  return result;
}

/**
 * Generate Tier 2 (discovered) suggestions from unlinked skill artifacts.
 *
 * Any skill artifact that:
 * 1. Has no linked profile (linkedProfileId is null)
 * 2. Has parseable SKILL.md frontmatter with at least a name
 *
 * becomes a suggestion with confidence 0.5 (below the Tier 1 minimum of 0.6).
 */
export function generateTier2Suggestions(
  unlinkedArtifacts: EnvironmentArtifactRow[]
): ProfileSuggestion[] {
  const suggestions: ProfileSuggestion[] = [];

  for (const artifact of unlinkedArtifacts) {
    if (artifact.category !== "skill") continue;

    // Try to extract metadata from the artifact's preview or metadata field
    let name: string | undefined;
    let description: string | undefined;

    // Parse from metadata (JSON) if available
    if (artifact.metadata) {
      try {
        const meta = JSON.parse(artifact.metadata);
        name = meta.name;
        description = meta.description;
      } catch {
        // Fall through to preview parsing
      }
    }

    // Fall back to preview (first 200 chars of SKILL.md) frontmatter parsing
    if (!name) {
      const fm = parseFrontmatter(artifact.preview);
      name = fm.name;
      description = fm.description;
    }

    // If we still don't have a name, use the artifact name (directory basename)
    if (!name) {
      name = artifact.name
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }

    suggestions.push({
      ruleId: `discovered-${artifact.name}`,
      name,
      description: description ?? `Discovered skill: ${artifact.name}`,
      confidence: TIER2_CONFIDENCE,
      tier: "discovered",
      matchedArtifacts: [
        { id: artifact.id, name: artifact.name, category: artifact.category },
      ],
      suggestedTools: ["Read", "Grep", "Glob", "Bash"],
      systemPrompt: description ?? `You are a ${name} specialist.`,
      tags: artifact.name.split("-").filter((t) => t.length > 2),
    });
  }

  return suggestions.sort((a, b) => a.name.localeCompare(b.name));
}
