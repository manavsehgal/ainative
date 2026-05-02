import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RunNowButton } from "../run-now-button";
import type { BlueprintVariable } from "@/lib/workflows/blueprints/types";

describe("RunNowButton", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Suppress sonner toast wiring side effects in test env
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("renders nothing when blueprintId is missing", () => {
    const { container } = render(<RunNowButton blueprintId={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the trigger button when blueprintId is present", () => {
    render(<RunNowButton blueprintId="bp-1" />);
    expect(screen.getByRole("button", { name: /run now/i })).toBeInTheDocument();
  });

  it("posts to /api/blueprints/[id]/instantiate on click", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ workflowId: "wf-1" }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;
    render(<RunNowButton blueprintId="bp-1" />);
    fireEvent.click(screen.getByRole("button", { name: /run now/i }));
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/blueprints/bp-1/instantiate",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      );
    });
  });

  it("disables the button while a request is in flight", async () => {
    const mockFetch = vi.fn(
      () =>
        new Promise(() => {
          /* never resolves */
        })
    );
    global.fetch = mockFetch as unknown as typeof fetch;
    render(<RunNowButton blueprintId="bp-1" />);
    const button = screen.getByRole("button", { name: /run now/i });
    fireEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());
  });
});

describe("RunNowButton — conditional sheet (Phase 3)", () => {
  it("renders simple button when variables prop is null", () => {
    render(<RunNowButton blueprintId="bp1" variables={null} />);
    const buttons = screen.getAllByRole("button", { name: /run now/i });
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("renders RunNowSheet trigger when variables is non-empty array", () => {
    const vars: BlueprintVariable[] = [
      { id: "x", type: "text", label: "X", required: true },
    ];
    render(<RunNowButton blueprintId="bp1" variables={vars} />);
    fireEvent.click(screen.getByRole("button", { name: /run now/i }));
    // After click, RunNowSheet renders the form fields
    expect(screen.getByText(/x/i)).toBeInTheDocument();
  });

  it("renders simple button when variables is empty array", () => {
    render(<RunNowButton blueprintId="bp1" variables={[]} />);
    expect(screen.getByRole("button", { name: /run now/i })).toBeInTheDocument();
  });

  it("renders nothing when blueprintId is null", () => {
    const { container } = render(<RunNowButton blueprintId={null} variables={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
