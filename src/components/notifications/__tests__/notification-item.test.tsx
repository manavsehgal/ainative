import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NotificationItem } from "@/components/notifications/notification-item";

const { push, contextReviewSpy, batchReviewSpy } = vi.hoisted(() => ({
  push: vi.fn(),
  contextReviewSpy: vi.fn(),
  batchReviewSpy: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/components/profiles/context-proposal-review", () => ({
  ContextProposalReview: (props: {
    notificationId: string;
    profileId: string;
    proposedAdditions: string;
    onResponded: () => void;
  }) => {
    contextReviewSpy(props);
    return <div>Context proposal review</div>;
  },
}));

vi.mock("@/components/notifications/batch-proposal-review", () => ({
  BatchProposalReview: (props: {
    proposalIds: string[];
    profileIds: string[];
    body: string;
    onResponded?: () => void;
  }) => {
    batchReviewSpy(props);
    return <div>Batch proposal review</div>;
  },
}));

describe("notification item", () => {
  it("renders context proposal review actions using the full additions payload", () => {
    render(
      <NotificationItem
        notification={{
          id: "notif-1",
          taskId: null,
          type: "context_proposal",
          title: "Context proposal",
          body: "truncated body",
          read: false,
          toolName: "general",
          toolInput: JSON.stringify({
            profileId: "general",
            additions: "Full learned additions",
          }),
          response: null,
          respondedAt: null,
          createdAt: "2026-04-10T00:00:00.000Z",
        }}
        onUpdated={vi.fn()}
      />
    );

    expect(screen.getByText("Context proposal review")).toBeInTheDocument();
    expect(contextReviewSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationId: "notif-1",
        profileId: "general",
        proposedAdditions: "Full learned additions",
      })
    );
  });

  it("renders batch proposal review actions for workflow learning notifications", () => {
    render(
      <NotificationItem
        notification={{
          id: "notif-2",
          taskId: null,
          type: "context_proposal_batch",
          title: "Workflow learning batch",
          body: "Batch summary",
          read: false,
          toolName: "workflow-context-batch",
          toolInput: JSON.stringify({
            proposalIds: ["p1", "p2"],
            profileIds: ["general", "researcher"],
          }),
          response: null,
          respondedAt: null,
          createdAt: "2026-04-10T00:00:00.000Z",
        }}
        onUpdated={vi.fn()}
      />
    );

    expect(screen.getByText("Batch proposal review")).toBeInTheDocument();
    expect(batchReviewSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        proposalIds: ["p1", "p2"],
        profileIds: ["general", "researcher"],
        body: "Batch summary",
      })
    );
  });
});
