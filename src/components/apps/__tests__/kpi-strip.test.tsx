import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { KPIStrip } from "../kpi-strip";
import type { KpiTile } from "@/lib/apps/view-kits/types";

describe("KPIStrip", () => {
  const tile = (id: string, label: string, value: string): KpiTile => ({
    id,
    label,
    value,
  });

  it("renders nothing when tiles is empty", () => {
    const { container } = render(<KPIStrip tiles={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders one tile with label and value", () => {
    render(<KPIStrip tiles={[tile("a", "Active", "5")]} />);
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("renders 6 tiles in a responsive grid", () => {
    const tiles = Array.from({ length: 6 }, (_, i) =>
      tile(`k${i}`, `Label ${i}`, `${i * 10}`)
    );
    render(<KPIStrip tiles={tiles} />);
    expect(screen.getByText("Label 0")).toBeInTheDocument();
    expect(screen.getByText("Label 5")).toBeInTheDocument();
  });

  it("renders the optional hint when present", () => {
    render(
      <KPIStrip
        tiles={[{ id: "a", label: "Active", value: "5", hint: "in last 7d" }]}
      />
    );
    expect(screen.getByText("in last 7d")).toBeInTheDocument();
  });

  it("clips at 6 tiles when more are passed", () => {
    const tiles = Array.from({ length: 8 }, (_, i) =>
      tile(`k${i}`, `Label ${i}`, `${i}`)
    );
    render(<KPIStrip tiles={tiles} />);
    expect(screen.queryByText("Label 6")).toBeNull();
    expect(screen.queryByText("Label 7")).toBeNull();
  });
});
