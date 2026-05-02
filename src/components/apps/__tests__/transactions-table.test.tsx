import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TransactionsTable } from "../transactions-table";

const rows = [
  { id: "r1", date: "2026-04-01", label: "Salary", amount: 5000, category: "income" },
  { id: "r2", date: "2026-04-02", label: "Rent", amount: -1200, category: "housing" },
];

describe("TransactionsTable", () => {
  it("renders all rows with date, label, amount", () => {
    render(<TransactionsTable rows={rows} format="currency" />);
    expect(screen.getByText(/salary/i)).toBeInTheDocument();
    expect(screen.getByText(/rent/i)).toBeInTheDocument();
    expect(screen.getByText(/\$5,000/)).toBeInTheDocument();
    expect(screen.getByText(/\$1,200/)).toBeInTheDocument();
  });

  it("colors negative amounts as outflow via data-amount-sign='negative'", () => {
    render(<TransactionsTable rows={rows} format="currency" />);
    const rentRow = screen.getByText(/rent/i).closest("tr");
    expect(rentRow?.querySelector('[data-amount-sign="negative"]')).toBeInTheDocument();
  });

  it("renders empty state when rows is empty", () => {
    render(<TransactionsTable rows={[]} format="currency" />);
    expect(screen.getByText(/no transactions/i)).toBeInTheDocument();
  });
});
