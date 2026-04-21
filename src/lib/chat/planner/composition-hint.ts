import type { ComposePlan } from "./types";

export function buildCompositionHint(plan: ComposePlan): string {
  const parts: string[] = [
    "",
    "## App Composition Hint (M4.5 planner, 2026-04-21)",
    "",
    "The user's message appears to be an app-creation request.",
    "Recommended composition:",
    "",
    `- Profile: \`${plan.profileId}\` (existing builtin — list_profiles to confirm)`,
    `- Blueprint: \`${plan.blueprintId}\` (existing builtin — list_blueprints to confirm)`,
  ];

  if (plan.tables && plan.tables.length > 0) {
    parts.push("");
    parts.push("Tables:");
    for (const table of plan.tables) {
      const colDesc = table.columns
        .map((c) => `${c.name} (${c.type})`)
        .join(", ");
      parts.push(`- \`${table.name}\` with columns: ${colDesc}`);
    }
  }

  if (plan.schedule) {
    parts.push("");
    parts.push(
      `Schedule: \`${plan.schedule.cron}\` — ${plan.schedule.description}`
    );
  }

  parts.push("");
  parts.push(`Rationale: ${plan.rationale}.`);
  parts.push("");
  parts.push("Your next actions should be:");
  parts.push("1. Call `create_profile` with a namespaced artifact id.");
  parts.push("2. Call `create_blueprint` with a namespaced artifact id.");
  if (plan.tables && plan.tables.length > 0) {
    parts.push("3. Call `create_table` for each proposed table.");
    parts.push("4. Respond to the user summarizing what was composed.");
  } else {
    parts.push("3. Respond to the user summarizing what was composed.");
  }
  parts.push("");
  parts.push(
    "If the user's actual need differs from this hint, prefer their stated intent over this hint."
  );
  parts.push("");

  return parts.join("\n");
}
