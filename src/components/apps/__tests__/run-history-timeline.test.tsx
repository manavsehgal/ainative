import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RunHistoryTimeline } from "../run-history-timeline";
import type { TimelineRun } from "@/lib/apps/view-kits/types";

const runs: TimelineRun[] = [
  { id: "r1", status: "completed", startedAt: "2026-04-30T08:00:00Z", durationMs: 4_000 },
  { id: "r2", status: "failed", startedAt: "2026-04-29T08:00:00Z" },
  { id: "r3", status: "running", startedAt: "2026-04-28T08:00:00Z" },
];

describe("RunHistoryTimeline", () => {
  it("renders one entry per run with status icon and relative timestamp", () => {
    render(<RunHistoryTimeline runs={runs} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText(/4s/i)).toBeInTheDocument();
  });

  it("renders empty state when runs is empty", () => {
    render(<RunHistoryTimeline runs={[]} />);
    expect(screen.getByText(/no runs yet/i)).toBeInTheDocument();
  });

  it("uses emptyHint override when provided", () => {
    render(<RunHistoryTimeline runs={[]} emptyHint="Synthesis hasn't run yet" />);
    expect(screen.getByText(/synthesis hasn't run yet/i)).toBeInTheDocument();
  });

  it("invokes onSelect when a run is clicked", () => {
    const onSelect = vi.fn();
    render(<RunHistoryTimeline runs={runs} onSelect={onSelect} />);
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(onSelect).toHaveBeenCalledWith("r1");
  });

  it("does not render buttons when onSelect is absent", () => {
    render(<RunHistoryTimeline runs={runs} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
