import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Command, CommandList } from "@/components/ui/command";
import { SkillRow } from "../skill-row";
import type { EnrichedSkill } from "@/lib/environment/skill-enrichment";

const base: EnrichedSkill = {
  id: "code-reviewer",
  name: "code-reviewer",
  tool: "claude-code",
  scope: "user",
  preview: "Review PRs for security",
  sizeBytes: 100,
  absPath: "/p",
  absPaths: ["/p"],
  healthScore: "healthy",
  syncStatus: "synced",
  linkedProfileId: "code-reviewer-profile",
};

// SkillRow uses CommandItem, which must live inside a cmdk Command/CommandList
function renderRow(skill: EnrichedSkill, recommended = false) {
  return render(
    <Command>
      <CommandList>
        <SkillRow skill={skill} recommended={recommended} onSelect={() => {}} />
      </CommandList>
    </Command>
  );
}

describe("SkillRow", () => {
  it("renders skill name and description", () => {
    renderRow(base);
    expect(screen.getByText("code-reviewer")).toBeInTheDocument();
    expect(screen.getByText(/Review PRs/)).toBeInTheDocument();
  });

  it("shows synced badge when syncStatus is synced", () => {
    renderRow(base);
    expect(screen.getByText(/synced/i)).toBeInTheDocument();
  });

  it("shows profile linkage badge", () => {
    renderRow(base);
    expect(screen.getByText(/code-reviewer-profile/)).toBeInTheDocument();
  });

  it("shows 'stale' badge for stale health", () => {
    renderRow({ ...base, healthScore: "stale" });
    expect(screen.getByText(/stale/i)).toBeInTheDocument();
  });

  it("shows a recommended indicator when recommended=true", () => {
    renderRow(base, true);
    expect(screen.getByLabelText(/recommended/i)).toBeInTheDocument();
  });
});
