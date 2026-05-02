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

describe("LastRunCard variant=hero", () => {
  const baseTask = {
    id: "t1",
    title: "Weekly digest",
    status: "completed" as const,
    createdAt: Date.now(),
    result:
      "## Portfolio Summary\n\n- Allocation: 60% stocks, 40% bonds\n\n```\nNVDA: +12%\n```",
  };

  it("renders the result as full markdown (with code fence)", () => {
    render(<LastRunCard variant="hero" task={baseTask} previousRuns={[]} />);
    expect(screen.getByText(/portfolio summary/i)).toBeInTheDocument();
    expect(screen.getByText(/NVDA: \+12%/i)).toBeInTheDocument();
  });

  it("renders metadata footer (status badge)", () => {
    render(<LastRunCard variant="hero" task={baseTask} previousRuns={[]} />);
    expect(screen.getByText(/completed/i)).toBeInTheDocument();
  });

  it("renders 'Previous runs' disclosure when previousRuns is non-empty", () => {
    const previousRuns = [
      {
        id: "p1",
        title: "Last week",
        status: "completed" as const,
        createdAt: Date.now() - 86_400_000,
        result: "old",
      },
    ];
    render(
      <LastRunCard variant="hero" task={baseTask} previousRuns={previousRuns} />
    );
    expect(
      screen.getByRole("button", { name: /previous runs/i })
    ).toBeInTheDocument();
  });

  it("renders empty-state when task is null", () => {
    render(<LastRunCard variant="hero" task={null} previousRuns={[]} />);
    expect(screen.getByText(/no digest yet/i)).toBeInTheDocument();
  });

  it("renders failed-task rescue when task.status='failed'", () => {
    const failedTask = {
      ...baseTask,
      status: "failed" as const,
      result: "Error: API limit",
    };
    render(<LastRunCard variant="hero" task={failedTask} previousRuns={[]} />);
    expect(screen.getByText(/last run failed/i)).toBeInTheDocument();
  });

  it("compact variant unchanged (existing shape still works)", () => {
    render(
      <LastRunCard
        blueprintId="bp-1"
        blueprintLabel="Weekly review"
        lastRun={{ id: "t1", status: "completed", createdAt: Date.now() }}
        runCount30d={5}
      />
    );
    expect(screen.getByText(/weekly review/i)).toBeInTheDocument();
  });
});
