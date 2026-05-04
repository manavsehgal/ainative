import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatMessage } from "../chat-message";
import type { ChatMessageRow } from "@/lib/db/schema";

vi.mock("../chat-session-provider", () => ({
  useChatSession: () => ({
    branchingEnabled: true,
    branchConversation: vi.fn(),
    conversations: [
      {
        id: "c1",
        title: "Original",
        projectId: null,
        runtimeId: "claude-code",
        modelId: null,
        status: "active",
        sessionId: null,
        contextScope: null,
        parentConversationId: null,
        branchedFromMessageId: null,
        activeSkillId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    activeId: "c1",
  }),
}));

function makeAssistant(
  id = "a1",
  overrides: Partial<ChatMessageRow> = {}
): ChatMessageRow {
  return {
    id,
    conversationId: "c1",
    role: "assistant",
    content: "Hello",
    metadata: null,
    status: "complete",
    rewoundAt: null,
    createdAt: new Date(),
    ...overrides,
  } as ChatMessageRow;
}

describe("ChatMessage — branching", () => {
  it("renders branch button on assistant messages when flag is on", () => {
    render(
      <ChatMessage
        message={makeAssistant()}
        isStreaming={false}
        conversationId="c1"
      />
    );
    expect(
      screen.getByRole("button", { name: /branch from here/i })
    ).toBeInTheDocument();
  });

  it("does not render branch button on user messages", () => {
    render(
      <ChatMessage
        message={
          { ...makeAssistant("u1"), role: "user", content: "hi" } as ChatMessageRow
        }
        isStreaming={false}
        conversationId="c1"
      />
    );
    expect(
      screen.queryByRole("button", { name: /branch from here/i })
    ).toBeNull();
  });

  it("renders rewound assistant message as collapsed gray placeholder", () => {
    render(
      <ChatMessage
        message={makeAssistant("a2", { rewoundAt: new Date() })}
        isStreaming={false}
        conversationId="c1"
      />
    );
    expect(screen.queryByText("Hello")).toBeNull();
    expect(screen.getByText(/rewound/i)).toBeInTheDocument();
  });

  it("does not render branch button while streaming", () => {
    render(
      <ChatMessage
        message={makeAssistant("a3", { status: "streaming" })}
        isStreaming={true}
        conversationId="c1"
      />
    );
    expect(
      screen.queryByRole("button", { name: /branch from here/i })
    ).toBeNull();
  });
});
