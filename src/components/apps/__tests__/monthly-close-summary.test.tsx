import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MonthlyCloseSummary } from "../monthly-close-summary";

describe("MonthlyCloseSummary", () => {
  it("renders collapsed by default", () => {
    render(<MonthlyCloseSummary task={{
      id: "t1", title: "March close", status: "completed",
      createdAt: Date.now(), result: "Net: $5,000"
    }} />);
    expect(screen.queryByText(/net: \$5,000/i)).not.toBeInTheDocument();
    expect(screen.getByText(/march close/i)).toBeInTheDocument();
  });

  it("expands on click", () => {
    render(<MonthlyCloseSummary task={{
      id: "t1", title: "March close", status: "completed",
      createdAt: Date.now(), result: "Net: $5,000"
    }} />);
    fireEvent.click(screen.getByRole("button", { name: /march close/i }));
    expect(screen.getByText(/net: \$5,000/i)).toBeInTheDocument();
  });

  it("renders 'no monthly-close blueprint' when task is null", () => {
    render(<MonthlyCloseSummary task={null} />);
    expect(screen.getByText(/no monthly-close blueprint/i)).toBeInTheDocument();
  });
});
