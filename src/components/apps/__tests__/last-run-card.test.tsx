import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LastRunCard } from "../last-run-card";

describe("LastRunCard", () => {
  it("renders blueprint label and 'never run' when lastRun is null", () => {
    render(
      <LastRunCard
        blueprintId="bp-1"
        blueprintLabel="Weekly review"
        lastRun={null}
        runCount30d={0}
      />
    );
    expect(screen.getByText(/Weekly review/i)).toBeInTheDocument();
    expect(screen.getByText(/never run/i)).toBeInTheDocument();
  });

  it("renders status badge and relative time when lastRun is present", () => {
    render(
      <LastRunCard
        blueprintId="bp-1"
        blueprintLabel="Weekly review"
        lastRun={{
          id: "t-1",
          status: "completed",
          createdAt: Date.now() - 2 * 3_600_000,
        }}
        runCount30d={5}
      />
    );
    expect(screen.getByText(/completed/i)).toBeInTheDocument();
    expect(screen.getByText(/5 runs/)).toBeInTheDocument();
  });

  it("renders failed-status with destructive intent", () => {
    render(
      <LastRunCard
        blueprintId="bp-1"
        blueprintLabel="Sync"
        lastRun={{
          id: "t-1",
          status: "failed",
          createdAt: Date.now() - 60_000,
        }}
        runCount30d={2}
      />
    );
    expect(screen.getByText(/failed/i)).toBeInTheDocument();
  });
});
