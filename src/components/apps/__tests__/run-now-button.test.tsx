import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RunNowButton } from "../run-now-button";

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
