import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CapabilityBanner } from "../capability-banner";

describe("CapabilityBanner", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("is hidden on claude-code runtime", () => {
    render(<CapabilityBanner runtimeId="claude-code" />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("is hidden on openai-codex-app-server runtime", () => {
    render(<CapabilityBanner runtimeId="openai-codex-app-server" />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("is visible on ollama runtime with capability message", () => {
    render(<CapabilityBanner runtimeId="ollama" />);
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("file read/write");
  });

  it("hides on dismiss and persists to sessionStorage", () => {
    render(<CapabilityBanner runtimeId="ollama" />);
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(screen.queryByRole("status")).toBeNull();
    expect(sessionStorage.getItem("ainative.capability-banner.dismissed.ollama")).toBe("1");
  });

  it("stays dismissed on remount if sessionStorage flag set", () => {
    sessionStorage.setItem("ainative.capability-banner.dismissed.ollama", "1");
    render(<CapabilityBanner runtimeId="ollama" />);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
