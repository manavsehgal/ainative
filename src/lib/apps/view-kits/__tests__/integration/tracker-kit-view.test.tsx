import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderKitView } from "../render-kit-view";
import { trackerKit } from "../../kits/tracker";

// PeriodSelectorChip and ScheduleCadenceChip may pull next/navigation in some
// code paths; guard with a passthrough mock so the jsdom env doesn't error.
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: () => {}, push: () => {} }),
  usePathname: () => "/",
}));

const manifest = {
  id: "habits",
  name: "Habit tracker",
  description: "Daily habits",
  profiles: [],
  blueprints: [{ id: "weekly-review", name: "Weekly review" }],
  schedules: [{ id: "daily", cron: "0 9 * * *", runs: "weekly-review" }],
  tables: [{
    id: "habits",
    name: "habits",
    columns: [
      { name: "habit" },
      { name: "completed", type: "boolean" },
      { name: "date", type: "date" },
    ],
  }],
} as any;

describe("Tracker kit — KitView integration", () => {
  it("renders header + KPIs + hero", () => {
    const { container } = renderKitView({
      kit: trackerKit,
      manifest,
      columns: [{
        tableId: "habits",
        columns: [
          { name: "habit" },
          { name: "completed", type: "boolean" },
          { name: "date", type: "date" },
        ],
      }],
      runtime: {
        cadence: { humanLabel: "Daily 9am", nextFireMs: null },
        evaluatedKpis: [{ id: "k1", label: "Streak", value: "5d" }],
        heroTable: {
          tableId: "habits",
          columns: [],
          rows: [],
        } as any,
      },
    });
    expect(container.querySelector('[data-kit-slot="hero"]')).toBeInTheDocument();
  });

  it("includes the cadence chip in header", () => {
    renderKitView({
      kit: trackerKit,
      manifest,
      columns: [],
      runtime: {
        cadence: { humanLabel: "Daily 9am", nextFireMs: null },
      },
    });
    expect(screen.getByText(/daily 9am/i)).toBeInTheDocument();
  });
});
