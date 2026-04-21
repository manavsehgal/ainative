import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ExtensionFallbackCard } from "@/components/chat/extension-fallback-card";

const baseProps = {
  explanation:
    "Needs external HTTP access, which composition can't express.",
  composeAltPrompt:
    "Build a weekly reading list that tracks books I'm reading",
  pluginSlug: "github-mine",
  pluginInputs: {
    id: "github-mine",
    name: "GitHub Mine",
    description: "Pulls GitHub issues assigned to me.",
    capabilities: [],
    transport: "stdio" as const,
    language: "python" as const,
    tools: [{ name: "list_my_issues", description: "List issues." }],
  },
};

describe("ExtensionFallbackCard", () => {
  it("renders in prompt state with both paths visible", () => {
    render(
      <ExtensionFallbackCard
        {...baseProps}
        onTryAlt={vi.fn()}
        onScaffold={vi.fn()}
      />
    );
    expect(
      screen.getByText(/I can't build this with composition alone/)
    ).toBeInTheDocument();
    expect(screen.getByText(baseProps.composeAltPrompt)).toBeInTheDocument();
    expect(
      screen.getByText(/~\/\.ainative\/plugins\/github-mine\//)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /try this/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /scaffold/i })
    ).toBeInTheDocument();
  });

  it("calls onTryAlt with the compose-alt prompt when 'Try this' is clicked", () => {
    const onTryAlt = vi.fn();
    render(
      <ExtensionFallbackCard
        {...baseProps}
        onTryAlt={onTryAlt}
        onScaffold={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /try this/i }));
    expect(onTryAlt).toHaveBeenCalledWith(baseProps.composeAltPrompt);
  });

  it("calls onScaffold with plugin inputs and transitions to scaffolded state", async () => {
    const onScaffold = vi.fn(async () => ({
      ok: true as const,
      id: "github-mine",
      pluginDir: "/home/u/.ainative/plugins/github-mine",
      tools: ["list_my_issues"],
    }));
    render(
      <ExtensionFallbackCard
        {...baseProps}
        onTryAlt={vi.fn()}
        onScaffold={onScaffold}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /scaffold/i }));
    expect(onScaffold).toHaveBeenCalledWith(baseProps.pluginInputs);
    await waitFor(() =>
      expect(screen.getByText(/Scaffolded/)).toBeInTheDocument()
    );
    expect(screen.getByText(/server\.py/)).toBeInTheDocument();
  });

  it("transitions to failed state on scaffold error and shows retry", async () => {
    const onScaffold = vi.fn(async () => {
      throw new Error("disk full");
    });
    render(
      <ExtensionFallbackCard
        {...baseProps}
        onTryAlt={vi.fn()}
        onScaffold={onScaffold}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /scaffold/i }));
    await waitFor(() =>
      expect(screen.getByText(/Scaffold failed/)).toBeInTheDocument()
    );
    expect(screen.getByText(/disk full/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /retry/i })
    ).toBeInTheDocument();
  });

  it("retry returns to prompt state", async () => {
    const onScaffold = vi.fn(async () => {
      throw new Error("boom");
    });
    render(
      <ExtensionFallbackCard
        {...baseProps}
        onTryAlt={vi.fn()}
        onScaffold={onScaffold}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /scaffold/i }));
    await waitFor(() =>
      screen.getByRole("button", { name: /retry/i })
    );
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(
      screen.getByText(/I can't build this with composition alone/)
    ).toBeInTheDocument();
  });

  it("honors initialState='scaffolded'", () => {
    render(
      <ExtensionFallbackCard
        {...baseProps}
        onTryAlt={vi.fn()}
        onScaffold={vi.fn()}
        initialState="scaffolded"
      />
    );
    expect(screen.getByText(/Scaffolded/)).toBeInTheDocument();
  });

  // Verifies the re-entrancy guard in handleScaffold (extension-fallback-card.tsx).
  // The `scaffolding` state is checked before setScaffolding(true), so a second
  // click fired before the first promise settles is a no-op. Without this guard,
  // double-clicks would fire onScaffold twice, creating a concurrent-write hazard
  // in the scaffolder.
  it("does not call onScaffold twice on rapid double-click (re-entrancy guard)", () => {
    // onScaffold returns a never-resolving promise so the component stays in
    // the pending-scaffolding state between clicks.
    const onScaffold = vi.fn(
      () =>
        new Promise<never>(() => {}) as unknown as Promise<{
          ok: true;
          id: string;
          pluginDir: string;
          tools: string[];
        }>
    );
    render(
      <ExtensionFallbackCard
        {...baseProps}
        onTryAlt={vi.fn()}
        onScaffold={onScaffold}
      />
    );
    const btn = screen.getByRole("button", { name: /scaffold/i });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(onScaffold).toHaveBeenCalledTimes(1);
  });
});
