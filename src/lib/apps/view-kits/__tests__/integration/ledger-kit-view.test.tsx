import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderKitView } from "../render-kit-view";
import { ledgerKit } from "../../kits/ledger";

// PeriodSelectorChip uses next/navigation hooks — mock for jsdom env
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: () => {}, push: () => {} }),
  usePathname: () => "/",
}));

const manifest = {
  id: "fin",
  name: "Finance",
  description: "Net/Inflow/Outflow",
  profiles: [],
  blueprints: [{ id: "monthly-close", name: "Monthly close" }],
  schedules: [],
  tables: [{
    id: "transactions",
    name: "transactions",
    columns: [
      { name: "date", type: "date" },
      { name: "amount", type: "number", semantic: "currency" },
      { name: "category", type: "string" },
    ],
  }],
} as any;

const columns = [{
  tableId: "transactions",
  columns: [
    { name: "date", type: "date" },
    { name: "amount", type: "number", semantic: "currency" },
    { name: "category", type: "string" },
  ],
}];

describe("Ledger kit — KitView integration", () => {
  it("renders period chip in header (mtd default)", () => {
    renderKitView({
      kit: ledgerKit,
      manifest,
      columns,
      period: "mtd",
      runtime: {
        ledgerSeries: [],
        ledgerCategories: [],
        ledgerTransactions: [],
        ledgerMonthlyClose: null,
        evaluatedKpis: [],
      },
    });
    expect(screen.getByRole("button", { name: /mtd/i })).toBeInTheDocument();
  });

  it("renders Recent transactions secondary card with seeded rows", () => {
    const { container } = renderKitView({
      kit: ledgerKit,
      manifest,
      columns,
      period: "mtd",
      runtime: {
        ledgerSeries: [],
        ledgerCategories: [],
        ledgerTransactions: [
          { id: "tx1", date: "2026-04-15", label: "Salary", amount: 5000, category: "income" },
        ],
        ledgerMonthlyClose: null,
        evaluatedKpis: [],
      },
    });
    expect(container.querySelector('[data-kit-slot="secondary"]')).toBeInTheDocument();
    expect(screen.getByText(/recent transactions/i)).toBeInTheDocument();
    expect(screen.getByText(/salary/i)).toBeInTheDocument();
  });

  it("renders monthly-close summary in activity slot when populated", () => {
    const { container } = renderKitView({
      kit: ledgerKit,
      manifest,
      columns,
      period: "mtd",
      runtime: {
        ledgerSeries: [],
        ledgerCategories: [],
        ledgerTransactions: [],
        ledgerMonthlyClose: {
          id: "mc-1",
          title: "Monthly close — April",
          status: "completed",
          createdAt: Date.now(),
          result: "## Summary\n\nNet positive month",
        },
        evaluatedKpis: [],
      },
    });
    expect(container.querySelector('[data-kit-slot="activity"]')).toBeInTheDocument();
    expect(screen.getByText(/monthly close — april/i)).toBeInTheDocument();
  });
});
