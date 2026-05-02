import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderKitView } from "../render-kit-view";
import { researchKit } from "../../kits/research";

// Defensive mock — guard against any transitive next/navigation dependency
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: () => {}, push: () => {} }),
  usePathname: () => "/",
}));

const manifest = {
  id: "rd",
  name: "Research digest",
  profiles: [],
  blueprints: [{ id: "weekly-digest", name: "Weekly digest" }],
  schedules: [{ id: "fri-5pm", cron: "0 17 * * 5", runs: "weekly-digest" }],
  tables: [{
    id: "sources",
    name: "sources",
    columns: [{ name: "name" }, { name: "url" }],
  }],
} as any;

describe("Research kit — KitView integration", () => {
  it("renders cadence chip + sources count KPI + run-history-timeline", () => {
    const { container } = renderKitView({
      kit: researchKit,
      manifest,
      columns: [{
        tableId: "sources",
        columns: [{ name: "name" }, { name: "url" }],
      }],
      runtime: {
        cadence: { humanLabel: "Fridays at 5pm", nextFireMs: null },
        researchSources: [{ id: "src-1", values: { name: "HN", url: "https://hn" } }],
        researchSourcesCount: 1,
        researchLastSynthAge: "2h ago",
        researchSynthesisContent: "## Digest\nbody",
        researchCitations: [],
        researchRecentRuns: [
          { id: "r1", status: "completed", startedAt: "2026-04-30T08:00:00Z" },
        ],
      },
    });
    expect(screen.getByText(/fridays at 5pm/i)).toBeInTheDocument();
    expect(screen.getByText(/sources/i)).toBeInTheDocument();
    expect(container.querySelector('[data-kit-pane="sources"]')).toBeInTheDocument();
    expect(container.querySelector('[data-kit-pane="synthesis"]')).toBeInTheDocument();
  });
});
