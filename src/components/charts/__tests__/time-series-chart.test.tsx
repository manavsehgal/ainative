import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TimeSeriesChart } from "../time-series-chart";

describe("TimeSeriesChart", () => {
  it("renders the chart with data", () => {
    const data = [
      { date: "2026-04-01", value: 100 },
      { date: "2026-04-02", value: 150 },
    ];
    render(<TimeSeriesChart data={data} format="currency" range="30d" />);
    expect(document.querySelector(".recharts-responsive-container")).toBeInTheDocument();
  });

  it("renders empty-state placeholder when data is empty", () => {
    render(<TimeSeriesChart data={[]} format="int" />);
    expect(screen.getByText(/no data yet/i)).toBeInTheDocument();
  });

  it("respects the height prop", () => {
    const data = [{ date: "2026-04-01", value: 1 }];
    const { container } = render(<TimeSeriesChart data={data} format="int" height={300} />);
    const chartWrapper = container.querySelector("[data-chart-height]");
    expect(chartWrapper?.getAttribute("data-chart-height")).toBe("300");
  });

  it("renders with default range='90d' when not specified", () => {
    const data = [{ date: "2026-04-01", value: 1 }];
    render(<TimeSeriesChart data={data} format="int" />);
    expect(document.querySelector(".recharts-responsive-container")).toBeInTheDocument();
  });
});
