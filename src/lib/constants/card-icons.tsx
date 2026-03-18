/**
 * Shared icon maps, color configs, and IconCircle component for card surfaces.
 * Used by profile cards, blueprint cards, workflow list cards, and their detail views.
 */

import {
  Sparkles,
  ShieldCheck,
  Search,
  KanbanSquare,
  BarChart3,
  FileText,
  Container,
  Sparkle,
  BookOpen,
  GraduationCap,
  Plane,
  Wallet,
  Heart,
  ShoppingBag,
  User,
  ArrowRightLeft,
  BrainCircuit,
  RefreshCw,
  GitFork,
  Network,
  Workflow,
  Code,
  Bug,
  Rocket,
  FlaskConical,
  PenTool,
  Briefcase,
  type LucideIcon,
} from "lucide-react";

// ── Profile icon map (by profile ID) ────────────────────────────────

const profileIconMap: Record<string, LucideIcon> = {
  general: Sparkles,
  "code-reviewer": ShieldCheck,
  researcher: Search,
  "project-manager": KanbanSquare,
  "data-analyst": BarChart3,
  "document-writer": FileText,
  "devops-engineer": Container,
  sweep: Sparkle,
  "technical-writer": BookOpen,
  "learning-coach": GraduationCap,
  "travel-planner": Plane,
  "wealth-manager": Wallet,
  "health-fitness-coach": Heart,
  "shopping-assistant": ShoppingBag,
};

export function getProfileIcon(profileId: string): LucideIcon {
  return profileIconMap[profileId] ?? User;
}

// ── Pattern icon map ────────────────────────────────────────────────

const patternIconMap: Record<string, LucideIcon> = {
  sequence: ArrowRightLeft,
  "planner-executor": BrainCircuit,
  checkpoint: ShieldCheck,
  loop: RefreshCw,
  parallel: GitFork,
  swarm: Network,
};

export function getPatternIcon(pattern: string): LucideIcon {
  return patternIconMap[pattern] ?? Workflow;
}

// ── Color configs ───────────────────────────────────────────────────

export interface CircleColors {
  icon: string;
  bgLight: string;
  bgDark: string;
}

const domainColors: Record<string, CircleColors> = {
  work: {
    icon: "oklch(0.50 0.20 260)",
    bgLight: "oklch(0.93 0.11 260)",
    bgDark: "oklch(0.25 0.10 260)",
  },
  personal: {
    icon: "oklch(0.50 0.20 330)",
    bgLight: "oklch(0.93 0.11 330)",
    bgDark: "oklch(0.25 0.10 330)",
  },
  custom: {
    icon: "oklch(0.60 0.18 75)",
    bgLight: "oklch(0.93 0.11 75)",
    bgDark: "oklch(0.30 0.10 75)",
  },
};

export function getDomainColors(
  domain: string,
  isBuiltin?: boolean
): CircleColors {
  // When isBuiltin is explicitly false AND domain doesn't match a known key, use custom
  if (isBuiltin === false && !domainColors[domain]) return domainColors.custom;
  return domainColors[domain] ?? domainColors.work;
}

const patternColors: Record<string, CircleColors> = {
  sequence: domainColors.work, // blue 260
  "planner-executor": domainColors.personal, // purple 300
  checkpoint: domainColors.custom, // amber 75
  loop: {
    icon: "oklch(0.55 0.15 190)",
    bgLight: "oklch(0.92 0.07 190)",
    bgDark: "oklch(0.25 0.08 190)",
  },
  parallel: {
    icon: "oklch(0.55 0.15 170)",
    bgLight: "oklch(0.92 0.07 170)",
    bgDark: "oklch(0.25 0.08 170)",
  },
  swarm: {
    icon: "oklch(0.55 0.18 350)",
    bgLight: "oklch(0.92 0.07 350)",
    bgDark: "oklch(0.25 0.08 350)",
  },
};

export function getPatternColors(pattern: string): CircleColors {
  return patternColors[pattern] ?? domainColors.work;
}

// ── Workflow domain inference from title ─────────────────────────────

interface DomainKeyword {
  keywords: string[];
  icon: LucideIcon;
  colors: CircleColors;
}

const workflowDomainKeywords: DomainKeyword[] = [
  { keywords: ["code", "review", "pr", "refactor", "lint"], icon: Code, colors: domainColors.work },
  { keywords: ["bug", "fix", "debug", "patch", "hotfix"], icon: Bug, colors: patternColors.swarm },
  { keywords: ["deploy", "release", "ship", "ci", "cd", "pipeline", "devops"], icon: Rocket, colors: patternColors.loop },
  { keywords: ["test", "qa", "quality", "coverage", "spec"], icon: FlaskConical, colors: patternColors.parallel },
  { keywords: ["research", "analyze", "analysis", "data", "report", "audit"], icon: Search, colors: domainColors.personal },
  { keywords: ["write", "document", "draft", "content", "blog", "article"], icon: PenTool, colors: domainColors.custom },
  { keywords: ["plan", "project", "sprint", "roadmap", "backlog", "manage"], icon: KanbanSquare, colors: domainColors.work },
  { keywords: ["travel", "trip", "itinerary", "booking", "flight"], icon: Plane, colors: patternColors.loop },
  { keywords: ["learn", "study", "course", "tutorial", "train"], icon: GraduationCap, colors: patternColors.parallel },
  { keywords: ["shop", "buy", "compare", "deal", "price"], icon: ShoppingBag, colors: domainColors.custom },
  { keywords: ["health", "fitness", "workout", "diet", "nutrition"], icon: Heart, colors: patternColors.swarm },
  { keywords: ["finance", "budget", "invest", "wealth", "tax"], icon: Wallet, colors: domainColors.personal },
  { keywords: ["build", "create", "generate", "scaffold"], icon: Briefcase, colors: domainColors.work },
];

/**
 * Infer icon + color from the workflow name by matching keywords.
 * Falls back to pattern-based icon + color when no keywords match.
 */
export function getWorkflowIconFromName(
  name: string,
  pattern: string
): { icon: LucideIcon; colors: CircleColors } {
  const lower = name.toLowerCase();
  for (const entry of workflowDomainKeywords) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return { icon: entry.icon, colors: entry.colors };
    }
  }
  return { icon: getPatternIcon(pattern), colors: getPatternColors(pattern) };
}

// ── IconCircle component ────────────────────────────────────────────

interface IconCircleProps {
  icon: LucideIcon;
  colors: CircleColors;
  size?: "sm" | "md";
}

export function IconCircle({ icon: Icon, colors, size = "md" }: IconCircleProps) {
  const sizeClasses = size === "sm"
    ? "h-8 w-8"
    : "h-10 w-10";
  const iconClasses = size === "sm"
    ? "h-4 w-4"
    : "h-5 w-5";

  return (
    <div
      className={`flex ${sizeClasses} shrink-0 items-center justify-center rounded-full`}
      style={{
        backgroundColor: `light-dark(${colors.bgLight}, ${colors.bgDark})`,
      }}
    >
      <Icon className={iconClasses} style={{ color: colors.icon }} />
    </div>
  );
}
