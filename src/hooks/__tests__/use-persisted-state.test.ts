import { renderHook, act } from "@testing-library/react";
import { usePersistedState } from "@/hooks/use-persisted-state";

describe("usePersistedState", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns default value when localStorage is empty", () => {
    const { result } = renderHook(() => usePersistedState("test-key", "default"));
    expect(result.current[0]).toBe("default");
  });

  it("reads stored value from localStorage on mount", () => {
    localStorage.setItem("test-key", "stored-value");
    const { result } = renderHook(() => usePersistedState("test-key", "default"));
    // After effect runs, value should be the stored one
    expect(result.current[0]).toBe("stored-value");
  });

  it("writes to localStorage when setter is called", () => {
    const { result } = renderHook(() => usePersistedState("test-key", "default"));

    act(() => {
      result.current[1]("new-value");
    });

    expect(result.current[0]).toBe("new-value");
    expect(localStorage.getItem("test-key")).toBe("new-value");
  });

  it("handles localStorage errors gracefully", () => {
    const origGetItem = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error("Quota exceeded");
    };

    const { result } = renderHook(() => usePersistedState("test-key", "fallback"));
    expect(result.current[0]).toBe("fallback");

    Storage.prototype.getItem = origGetItem;
  });

  it("maintains independent values for different keys", () => {
    const { result: hookA } = renderHook(() => usePersistedState("key-a", "a-default"));
    const { result: hookB } = renderHook(() => usePersistedState("key-b", "b-default"));

    act(() => {
      hookA.current[1]("a-updated");
    });

    expect(hookA.current[0]).toBe("a-updated");
    expect(hookB.current[0]).toBe("b-default");
    expect(localStorage.getItem("key-a")).toBe("a-updated");
    expect(localStorage.getItem("key-b")).toBeNull();
  });
});
