import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useChatAutocomplete } from "../use-chat-autocomplete";

const TAB_KEY = "ainative.command-tab";

describe("useChatAutocomplete — activeTab persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to 'actions' when localStorage empty", () => {
    const { result } = renderHook(() => useChatAutocomplete({ projectId: null }));
    expect(result.current.activeTab).toBe("actions");
  });

  it("reads persisted tab from localStorage on mount", () => {
    localStorage.setItem(TAB_KEY, "skills");
    const { result } = renderHook(() => useChatAutocomplete({ projectId: null }));
    expect(result.current.activeTab).toBe("skills");
  });

  it("ignores corrupt localStorage values", () => {
    localStorage.setItem(TAB_KEY, "bogus");
    const { result } = renderHook(() => useChatAutocomplete({ projectId: null }));
    expect(result.current.activeTab).toBe("actions");
  });

  it("persists tab on setActiveTab", () => {
    const { result } = renderHook(() => useChatAutocomplete({ projectId: null }));
    act(() => result.current.setActiveTab("tools"));
    expect(result.current.activeTab).toBe("tools");
    expect(localStorage.getItem(TAB_KEY)).toBe("tools");
  });

  it("survives localStorage throwing on write", () => {
    const setSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceeded");
    });
    const { result } = renderHook(() => useChatAutocomplete({ projectId: null }));
    expect(() => {
      act(() => result.current.setActiveTab("tools"));
    }).not.toThrow();
    expect(result.current.activeTab).toBe("tools");
    setSpy.mockRestore();
  });
});
