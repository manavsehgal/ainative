import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { LearnedContextPanel } from "@/components/profiles/learned-context-panel";
import type { LearnedContextRow } from "@/lib/db/schema";

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/utils/format-timestamp", () => ({
  formatTimestamp: () => "just now",
}));

function makeRow(
  overrides: Partial<LearnedContextRow> & {
    id: string;
    version: number;
    changeType: LearnedContextRow["changeType"];
  }
): LearnedContextRow {
  return {
    id: overrides.id,
    profileId: overrides.profileId ?? "general",
    version: overrides.version,
    content: overrides.content ?? null,
    diff: overrides.diff ?? null,
    changeType: overrides.changeType,
    sourceTaskId: overrides.sourceTaskId ?? null,
    proposalNotificationId: overrides.proposalNotificationId ?? null,
    proposedAdditions: overrides.proposedAdditions ?? null,
    approvedBy: overrides.approvedBy ?? null,
    createdAt: overrides.createdAt ?? new Date("2026-03-17T12:00:00.000Z"),
  };
}

describe("LearnedContextPanel", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("shows singular and plural version labels", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        history: [
          makeRow({
            id: "v1",
            version: 1,
            changeType: "approved",
            content: "Validate inputs",
            diff: "Validate inputs",
          }),
        ],
        currentSize: 15,
        limit: 8000,
        needsSummarization: false,
      }),
    } as Response);

    const { rerender } = render(<LearnedContextPanel profileId="general" />);

    expect(await screen.findByText("1 version")).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        history: [
          makeRow({
            id: "v2",
            version: 2,
            changeType: "approved",
            content: "Validate inputs\n\nUse retries",
            diff: "Use retries",
          }),
          makeRow({
            id: "v1",
            version: 1,
            changeType: "approved",
            content: "Validate inputs",
            diff: "Validate inputs",
          }),
        ],
        currentSize: 28,
        limit: 8000,
        needsSummarization: false,
      }),
    } as Response);

    rerender(<LearnedContextPanel profileId="general-v2" />);

    expect(await screen.findByText("2 versions")).toBeInTheDocument();
  });

  it("renders badges, rollback content preview, and a unified diff toggle", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        history: [
          makeRow({
            id: "v4",
            version: 4,
            changeType: "rollback",
            content: "Validate inputs",
            diff: "Rolled back to version 1",
          }),
          makeRow({
            id: "v3",
            version: 3,
            changeType: "summarization",
            content: "Validate inputs\nUse retries",
            diff: "Summarized from 80 to 42 chars",
          }),
          makeRow({
            id: "v2",
            version: 2,
            changeType: "proposal",
            diff: "Always include retry guidance",
          }),
          makeRow({
            id: "v1",
            version: 1,
            changeType: "approved",
            content: "Validate inputs",
            diff: "Validate inputs",
          }),
        ],
        currentSize: 32,
        limit: 8000,
        needsSummarization: false,
      }),
    } as Response);

    render(<LearnedContextPanel profileId="general" />);

    expect((await screen.findAllByText("Rollback")).length).toBeGreaterThan(0);
    expect(screen.getByText("Summarized")).toBeInTheDocument();
    expect(screen.getByText("Proposed")).toBeInTheDocument();
    expect(screen.getAllByText("Approved")).not.toHaveLength(0);

    const rollbackCard = screen.getByText("v4").closest(".surface-card-muted");
    expect(rollbackCard).not.toBeNull();
    expect(
      within(rollbackCard as HTMLElement).getByText("Restored Context")
    ).toBeInTheDocument();
    expect(
      within(rollbackCard as HTMLElement).getByText("Validate inputs")
    ).toBeInTheDocument();

    const showDiffButtons = screen.getAllByRole("button", { name: /Show Diff/i });
    fireEvent.click(showDiffButtons[0]);

    const diffPanel = await screen.findByText("Unified Diff");
    expect(diffPanel).toBeInTheDocument();
    expect(screen.getByText("vs v3")).toBeInTheDocument();
    expect(
      screen.getByText((content, element) => {
        return content === "-" && element?.getAttribute("aria-hidden") === "true";
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hide Diff/i })).toBeInTheDocument();
  });
});
