import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BranchesTreeDialog } from "../branches-tree-dialog";
import type { ConversationRow } from "@/lib/db/schema";

function makeConv(
  id: string,
  parentId: string | null = null,
  title?: string
): ConversationRow {
  return {
    id,
    title: title ?? `Conv ${id}`,
    projectId: null,
    runtimeId: "claude-code",
    modelId: null,
    status: "active",
    sessionId: null,
    contextScope: null,
    parentConversationId: parentId,
    branchedFromMessageId: parentId ? `msg-${parentId}` : null,
    activeSkillId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as ConversationRow;
}

describe("BranchesTreeDialog", () => {
  it("fetches family on open and renders nodes", async () => {
    const family = [makeConv("root"), makeConv("child", "root", "Branch A")];
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ family }), { status: 200 })
    ) as typeof fetch;

    render(
      <BranchesTreeDialog
        open
        onOpenChange={vi.fn()}
        conversationId="child"
        onSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Conv root")).toBeInTheDocument();
      expect(screen.getByText("Branch A")).toBeInTheDocument();
    });
  });

  it("clicking a node calls onSelect with the id", async () => {
    const family = [makeConv("root"), makeConv("child", "root", "Branch A")];
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ family }), { status: 200 })
    ) as typeof fetch;

    const onSelect = vi.fn();
    render(
      <BranchesTreeDialog
        open
        onOpenChange={vi.fn()}
        conversationId="child"
        onSelect={onSelect}
      />
    );

    const rootNode = await screen.findByText("Conv root");
    fireEvent.click(rootNode);
    expect(onSelect).toHaveBeenCalledWith("root");
  });

  it("renders empty-state for a single-node family", async () => {
    const family = [makeConv("solo", null, "Solo")];
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ family }), { status: 200 })
    ) as typeof fetch;

    render(
      <BranchesTreeDialog
        open
        onOpenChange={vi.fn()}
        conversationId="solo"
        onSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/no branches/i)).toBeInTheDocument();
    });
  });

  it("marks the active conversation as (current)", async () => {
    const family = [makeConv("root", null, "Root"), makeConv("child", "root", "Branch A")];
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ family }), { status: 200 })
    ) as typeof fetch;

    render(
      <BranchesTreeDialog
        open
        onOpenChange={vi.fn()}
        conversationId="child"
        onSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/\(current\)/i)).toBeInTheDocument();
    });
  });
});
