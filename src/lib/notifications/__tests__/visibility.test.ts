import { describe, expect, it } from "vitest";

import {
  filterDefaultVisibleNotifications,
  isResolvedLearningNotification,
} from "@/lib/notifications/visibility";

describe("notification visibility", () => {
  it("treats responded learning notifications as resolved", () => {
    expect(
      isResolvedLearningNotification({
        type: "context_proposal",
        response: JSON.stringify({ action: "approved" }),
        respondedAt: "2026-04-10T00:00:00.000Z",
      })
    ).toBe(true);

    expect(
      isResolvedLearningNotification({
        type: "context_proposal_batch",
        response: null,
        respondedAt: null,
      })
    ).toBe(false);
  });

  it("filters resolved learning notifications but keeps other notification types", () => {
    const visible = filterDefaultVisibleNotifications([
      {
        id: "n1",
        type: "context_proposal",
        response: JSON.stringify({ action: "approved" }),
        respondedAt: "2026-04-10T00:00:00.000Z",
      },
      {
        id: "n2",
        type: "context_proposal_batch",
        response: null,
        respondedAt: null,
      },
      {
        id: "n3",
        type: "permission_required",
        response: JSON.stringify({ behavior: "allow" }),
        respondedAt: "2026-04-10T00:00:00.000Z",
      },
    ]);

    expect(visible.map((item) => item.id)).toEqual(["n2", "n3"]);
  });
});
