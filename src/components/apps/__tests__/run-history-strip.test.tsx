import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RunHistoryStrip } from "../run-history-strip";

const runs = [
  { id: "r1", title: "Apr 28 digest", status: "completed" as const, createdAt: Date.now() - 86_400_000, result: "..." },
  { id: "r2", title: "Apr 21 digest", status: "completed" as const, createdAt: Date.now() - 7 * 86_400_000, result: "..." },
];

describe("RunHistoryStrip", () => {
  it("renders one card per run", () => {
    render(<RunHistoryStrip runs={runs} />);
    expect(screen.getByText("Apr 28 digest")).toBeInTheDocument();
    expect(screen.getByText("Apr 21 digest")).toBeInTheDocument();
  });

  it("calls onSelect when a card is clicked", () => {
    const onSelect = vi.fn();
    render(<RunHistoryStrip runs={runs} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("Apr 28 digest"));
    expect(onSelect).toHaveBeenCalledWith(runs[0]);
  });

  it("renders empty state when runs is empty", () => {
    render(<RunHistoryStrip runs={[]} />);
    expect(screen.getByText(/no runs yet/i)).toBeInTheDocument();
  });
});
