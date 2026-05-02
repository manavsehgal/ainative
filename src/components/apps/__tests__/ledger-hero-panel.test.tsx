import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LedgerHeroPanel } from "../ledger-hero-panel";

describe("LedgerHeroPanel", () => {
  it("renders TimeSeriesChart and category list when data present", () => {
    const series = [
      { date: "2026-04-01", value: 100 },
      { date: "2026-04-02", value: 200 },
    ];
    const categories = [
      { label: "Income", value: 5000 },
      { label: "Expenses", value: 3000 },
    ];
    const { container } = render(
      <LedgerHeroPanel series={series} categories={categories} period="mtd" />
    );
    // recharts container present
    expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
    // category labels visible
    expect(screen.getByText("Income")).toBeInTheDocument();
    expect(screen.getByText("Expenses")).toBeInTheDocument();
  });

  it("shows period label uppercase in headings", () => {
    render(<LedgerHeroPanel series={[]} categories={[{ label: "X", value: 1 }]} period="ytd" />);
    expect(screen.getAllByText(/YTD/i).length).toBeGreaterThan(0);
  });

  it("renders empty placeholder when both series and categories empty", () => {
    render(<LedgerHeroPanel series={[]} categories={[]} period="mtd" />);
    expect(screen.getByText(/no data yet/i)).toBeInTheDocument();
  });
});
