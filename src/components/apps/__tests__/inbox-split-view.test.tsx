import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InboxSplitView } from "../inbox-split-view";

const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("row=r2"),
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/apps/inbox-app",
}));

const queue = [
  { id: "r1", title: "Reply to Acme", subtitle: "neutral · 2h ago" },
  { id: "r2", title: "Reply to Beta", subtitle: "positive · 30m ago" },
];

describe("InboxSplitView", () => {
  it("renders queue rows on the left", () => {
    render(
      <InboxSplitView
        queue={queue}
        selectedRowId="r2"
        draft={{ id: "d2", filename: "draft.md", content: "Hi Beta!", taskId: "t1" }}
      />
    );
    expect(screen.getByText(/reply to acme/i)).toBeInTheDocument();
    expect(screen.getByText(/reply to beta/i)).toBeInTheDocument();
  });

  it("renders the draft on the right when present", () => {
    render(
      <InboxSplitView
        queue={queue}
        selectedRowId="r2"
        draft={{ id: "d2", filename: "draft.md", content: "Hi Beta!", taskId: "t1" }}
      />
    );
    expect(screen.getByText(/hi beta/i)).toBeInTheDocument();
  });

  it("renders empty-draft placeholder when draft is null", () => {
    render(
      <InboxSplitView queue={queue} selectedRowId="r2" draft={null} />
    );
    expect(screen.getByText(/no draft yet/i)).toBeInTheDocument();
  });

  it("calls router.replace with ?row=<id> on row click", () => {
    replaceMock.mockClear();
    render(
      <InboxSplitView queue={queue} selectedRowId="r2" draft={null} />
    );
    fireEvent.click(screen.getByText(/reply to acme/i));
    expect(replaceMock).toHaveBeenCalledWith(
      expect.stringContaining("row=r1")
    );
  });
});
