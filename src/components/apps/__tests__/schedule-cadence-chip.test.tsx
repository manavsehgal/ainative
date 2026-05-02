import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScheduleCadenceChip } from "../schedule-cadence-chip";

describe("ScheduleCadenceChip", () => {
  it("renders nothing when humanLabel is null", () => {
    const { container } = render(
      <ScheduleCadenceChip humanLabel={null} nextFireMs={null} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders just the human label when nextFireMs is null", () => {
    render(<ScheduleCadenceChip humanLabel="daily 8pm" nextFireMs={null} />);
    expect(screen.getByText(/daily 8pm/i)).toBeInTheDocument();
  });

  it("renders human label + relative time when nextFireMs is in future", () => {
    const future = Date.now() + 2 * 86_400_000 + 4 * 3_600_000;
    render(<ScheduleCadenceChip humanLabel="daily 8pm" nextFireMs={future} />);
    expect(screen.getByText(/daily 8pm/i)).toBeInTheDocument();
    expect(screen.getByText(/in 2d/i)).toBeInTheDocument();
  });

  it("renders 'overdue' when nextFireMs is in past", () => {
    const past = Date.now() - 60_000;
    render(<ScheduleCadenceChip humanLabel="daily 8pm" nextFireMs={past} />);
    expect(screen.getByText(/overdue/i)).toBeInTheDocument();
  });
});
