/**
 * Environment health scoring engine.
 * 4 dimensions: Instructions, Safety, Capability, Maintenance.
 * Each scored 0-100, overall is weighted average.
 */

import type { EnvironmentArtifactRow, EnvironmentScanRow } from "@/lib/db/schema";

export interface HealthDimension {
  name: string;
  score: number;
  maxScore: number;
  details: string[];
}

export interface HealthScore {
  overall: number;
  dimensions: HealthDimension[];
  recommendations: string[];
}

/**
 * Calculate health score from scan artifacts.
 */
export function calculateHealthScore(
  scan: EnvironmentScanRow,
  artifacts: EnvironmentArtifactRow[]
): HealthScore {
  const instructions = scoreInstructions(artifacts);
  const safety = scoreSafety(artifacts);
  const capability = scoreCapability(artifacts);
  const maintenance = scoreMaintenance(scan, artifacts);

  const dimensions = [instructions, safety, capability, maintenance];
  const overall = Math.round(
    dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length
  );

  const recommendations: string[] = [];
  for (const dim of dimensions) {
    if (dim.score < 50) {
      recommendations.push(
        ...dim.details
          .filter((d) => d.startsWith("Missing") || d.startsWith("No "))
          .map((d) => `${dim.name}: ${d}`)
      );
    }
  }

  return { overall, dimensions, recommendations };
}

function scoreInstructions(artifacts: EnvironmentArtifactRow[]): HealthDimension {
  const details: string[] = [];
  let score = 0;
  const maxScore = 100;

  const hasClaudeMd = artifacts.some((a) => a.name === "CLAUDE.md" && a.category === "instruction");
  const hasAgentsMd = artifacts.some((a) => a.name === "AGENTS.md" && a.category === "instruction");
  const hasMemory = artifacts.some((a) => a.category === "memory");
  const instructionCount = artifacts.filter((a) => a.category === "instruction").length;

  if (hasClaudeMd) { score += 30; details.push("CLAUDE.md present"); }
  else details.push("Missing CLAUDE.md");

  if (hasAgentsMd) { score += 30; details.push("AGENTS.md present"); }
  else details.push("Missing AGENTS.md — shared instruction file for cross-tool setup");

  if (hasMemory) { score += 25; details.push("Memory files found"); }
  else details.push("No memory files — consider adding project memory");

  if (instructionCount >= 2) { score += 15; details.push(`${instructionCount} instruction files`); }
  else { score += 5; details.push("Few instruction files"); }

  return { name: "Instructions", score: Math.min(score, maxScore), maxScore, details };
}

function scoreSafety(artifacts: EnvironmentArtifactRow[]): HealthDimension {
  const details: string[] = [];
  let score = 0;
  const maxScore = 100;

  const hasPermissions = artifacts.some((a) => a.category === "permission");
  const hasHooks = artifacts.some((a) => a.category === "hook");
  const permissionCount = artifacts.filter((a) => a.category === "permission").length;

  if (hasPermissions) { score += 40; details.push(`${permissionCount} permission config(s)`); }
  else details.push("No permissions configured — consider setting allowed/denied tools");

  if (hasHooks) { score += 35; details.push("Hooks configured"); }
  else details.push("No hooks — hooks enforce safety guardrails automatically");

  // Base safety score for having any config at all
  if (artifacts.length > 0) { score += 25; details.push("Environment configured"); }

  return { name: "Safety", score: Math.min(score, maxScore), maxScore, details };
}

function scoreCapability(artifacts: EnvironmentArtifactRow[]): HealthDimension {
  const details: string[] = [];
  let score = 0;
  const maxScore = 100;

  const skillCount = artifacts.filter((a) => a.category === "skill").length;
  const mcpCount = artifacts.filter((a) => a.category === "mcp-server").length;
  const pluginCount = artifacts.filter((a) => a.category === "plugin").length;

  // Skills: 0-5 = low, 5-15 = medium, 15+ = high
  if (skillCount >= 15) { score += 40; details.push(`${skillCount} skills (rich)`); }
  else if (skillCount >= 5) { score += 25; details.push(`${skillCount} skills`); }
  else if (skillCount > 0) { score += 10; details.push(`${skillCount} skills (consider adding more)`); }
  else details.push("No skills — skills extend agent capabilities");

  // MCP servers
  if (mcpCount >= 2) { score += 30; details.push(`${mcpCount} MCP servers`); }
  else if (mcpCount === 1) { score += 15; details.push("1 MCP server"); }
  else details.push("No MCP servers — MCP extends tool access");

  // Plugins
  if (pluginCount > 0) { score += 15; details.push(`${pluginCount} plugin(s)`); }

  // Output styles, rules
  const hasStyles = artifacts.some((a) => a.category === "output-style");
  const hasRules = artifacts.some((a) => a.category === "rule");
  if (hasStyles) { score += 8; details.push("Output styles configured"); }
  if (hasRules) { score += 7; details.push("Rules configured"); }

  return { name: "Capability", score: Math.min(score, maxScore), maxScore, details };
}

function scoreMaintenance(
  scan: EnvironmentScanRow,
  artifacts: EnvironmentArtifactRow[]
): HealthDimension {
  const details: string[] = [];
  let score = 0;
  const maxScore = 100;

  // Scan recency
  const scanAge = Date.now() - scan.scannedAt.getTime();
  const scanAgeHours = scanAge / (1000 * 60 * 60);

  if (scanAgeHours < 1) { score += 30; details.push("Scanned recently"); }
  else if (scanAgeHours < 24) { score += 20; details.push("Scanned within 24h"); }
  else if (scanAgeHours < 168) { score += 10; details.push("Scanned within a week"); }
  else details.push("Scan is stale — rescan to ensure accuracy");

  // Artifact count as a proxy for configured environment
  if (artifacts.length >= 30) { score += 30; details.push(`${artifacts.length} artifacts`); }
  else if (artifacts.length >= 10) { score += 20; details.push(`${artifacts.length} artifacts`); }
  else { score += 5; details.push(`Only ${artifacts.length} artifacts`); }

  // Scan was successful
  if (scan.scanStatus === "completed") { score += 20; details.push("Last scan completed successfully"); }

  // No scan errors
  const errors = scan.errors ? JSON.parse(scan.errors) : [];
  if (errors.length === 0) { score += 20; details.push("No scan errors"); }
  else { score += 5; details.push(`${errors.length} scan error(s)`); }

  return { name: "Maintenance", score: Math.min(score, maxScore), maxScore, details };
}
