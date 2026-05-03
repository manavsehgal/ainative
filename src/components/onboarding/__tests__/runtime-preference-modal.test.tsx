import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RuntimePreferenceModal } from "@/components/onboarding/runtime-preference-modal";

function setup({
  fetchOllamaModels = vi.fn(async () => []),
  persistChoice = vi.fn(async () => undefined),
  onClose = vi.fn(),
}: {
  fetchOllamaModels?: () => Promise<{ name: string }[]>;
  persistChoice?: (input: {
    preference: "quality" | "cost" | "privacy" | "balanced" | null;
    defaultModel: string;
  }) => Promise<void>;
  onClose?: () => void;
} = {}) {
  render(
    <RuntimePreferenceModal
      open
      onClose={onClose}
      fetchOllamaModels={fetchOllamaModels}
      persistChoice={persistChoice}
    />
  );
  return { fetchOllamaModels, persistChoice, onClose };
}

describe("RuntimePreferenceModal", () => {
  it("renders the four preference options with capability notes", () => {
    setup();
    expect(screen.getByText("Best quality")).toBeTruthy();
    expect(screen.getByText("Balanced (recommended)")).toBeTruthy();
    expect(screen.getByText("Lowest cost")).toBeTruthy();
    expect(screen.getByText("Best privacy (local only)")).toBeTruthy();
    expect(
      screen.getByText(/Top-tier model \(Opus\)/i)
    ).toBeTruthy();
    expect(
      screen.getByText(/Runs entirely on your machine via Ollama/i)
    ).toBeTruthy();
  });

  it("defaults to balanced and confirms with sonnet model id", async () => {
    const persistChoice = vi.fn(async () => undefined);
    const onClose = vi.fn();
    setup({ persistChoice, onClose });

    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(persistChoice).toHaveBeenCalledWith({
        preference: "balanced",
        defaultModel: "sonnet",
      });
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("persists quality preference with opus model id", async () => {
    const persistChoice = vi.fn(async () => undefined);
    setup({ persistChoice });

    fireEvent.click(screen.getByLabelText(/Best quality/i));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(persistChoice).toHaveBeenCalledWith({
        preference: "quality",
        defaultModel: "opus",
      });
    });
  });

  it("persists cost preference with haiku model id", async () => {
    const persistChoice = vi.fn(async () => undefined);
    setup({ persistChoice });

    fireEvent.click(screen.getByLabelText(/Lowest cost/i));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(persistChoice).toHaveBeenCalledWith({
        preference: "cost",
        defaultModel: "haiku",
      });
    });
  });

  it("Skip writes balanced default with null preference and closes", async () => {
    const persistChoice = vi.fn(async () => undefined);
    const onClose = vi.fn();
    setup({ persistChoice, onClose });

    fireEvent.click(screen.getByRole("button", { name: /skip/i }));

    await waitFor(() => {
      expect(persistChoice).toHaveBeenCalledWith({
        preference: null,
        defaultModel: "sonnet",
      });
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("privacy with discovered ollama model persists ollama: prefix", async () => {
    const persistChoice = vi.fn(async () => undefined);
    const fetchOllamaModels = vi.fn(async () => [
      { name: "llama3.1:latest" },
      { name: "qwen2.5" },
    ]);
    setup({ persistChoice, fetchOllamaModels });

    fireEvent.click(screen.getByLabelText(/Best privacy/i));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(persistChoice).toHaveBeenCalledWith({
        preference: "privacy",
        defaultModel: "ollama:llama3.1:latest",
      });
    });
  });

  it("privacy with empty ollama list shows fallback note + balanced default + does NOT close until dismissed", async () => {
    const persistChoice = vi.fn(async () => undefined);
    const fetchOllamaModels = vi.fn(async () => []);
    const onClose = vi.fn();
    setup({ persistChoice, fetchOllamaModels, onClose });

    fireEvent.click(screen.getByLabelText(/Best privacy/i));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    // Persists user's stated privacy preference paired with the balanced
    // fallback model so chat still works. The mismatch is intentional —
    // it surfaces the gap in Settings so the user knows to install Ollama.
    await waitFor(() => {
      expect(persistChoice).toHaveBeenCalledWith({
        preference: "privacy",
        defaultModel: "sonnet",
      });
    });

    expect(
      await screen.findByText(/No local models found/i)
    ).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();

    // Dismissal closes the modal.
    fireEvent.click(screen.getByRole("button", { name: /got it/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
