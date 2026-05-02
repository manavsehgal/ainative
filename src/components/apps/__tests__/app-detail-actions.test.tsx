import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AppDetailActions } from "../app-detail-actions";

const pushSpy = vi.fn();
const refreshSpy = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushSpy, refresh: refreshSpy }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const fetchSpy = vi.fn();

beforeEach(() => {
  pushSpy.mockClear();
  refreshSpy.mockClear();
  toastSuccess.mockClear();
  toastError.mockClear();
  fetchSpy.mockReset();
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const baseProps = {
  appId: "wealth-tracker",
  appName: "Wealth Tracker",
  tableCount: 1,
  scheduleCount: 1,
  fileCount: 1,
};

describe("AppDetailActions — pluralization", () => {
  it("uses singular table copy when tableCount === 1", () => {
    render(<AppDetailActions {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Delete app/i }));
    expect(
      screen.getByText(/1 table \(and its rows, columns, triggers\)/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/their rows/i)).toBeNull();
  });

  it("uses plural table copy when tableCount > 1", () => {
    render(<AppDetailActions {...baseProps} tableCount={3} />);
    fireEvent.click(screen.getByRole("button", { name: /Delete app/i }));
    expect(
      screen.getByText(/3 tables \(and their rows, columns, triggers\)/i)
    ).toBeInTheDocument();
  });

  it("pluralizes schedules and manifest files independently", () => {
    render(
      <AppDetailActions
        {...baseProps}
        tableCount={0}
        scheduleCount={2}
        fileCount={2}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Delete app/i }));
    expect(screen.getByText(/2 schedules/)).toBeInTheDocument();
    expect(screen.getByText(/2 manifest files/)).toBeInTheDocument();
  });

  it("falls back to 'its manifest' when all counts are zero", () => {
    render(
      <AppDetailActions
        {...baseProps}
        tableCount={0}
        scheduleCount={0}
        fileCount={0}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Delete app/i }));
    expect(screen.getByText(/and its manifest\./)).toBeInTheDocument();
  });
});

describe("AppDetailActions — toast paths", () => {
  it("on success: shows toast, navigates to /apps, refreshes", async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({ success: true, filesRemoved: true, projectRemoved: true }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    render(<AppDetailActions {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Delete app/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /^Delete app$/, hidden: false })
    );

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("Deleted Wealth Tracker");
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/apps/wealth-tracker",
      expect.objectContaining({ method: "DELETE" })
    );
    expect(pushSpy).toHaveBeenCalledWith("/apps");
    expect(refreshSpy).toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("on server error: shows toast.error with the server message", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ error: "Failed to delete app" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    );

    render(<AppDetailActions {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Delete app/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /^Delete app$/, hidden: false })
    );

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Failed to delete app");
    });
    expect(pushSpy).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("on network error: shows toast.error with the thrown message", async () => {
    fetchSpy.mockRejectedValue(new Error("Network down"));

    render(<AppDetailActions {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Delete app/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /^Delete app$/, hidden: false })
    );

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Network down");
    });
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
