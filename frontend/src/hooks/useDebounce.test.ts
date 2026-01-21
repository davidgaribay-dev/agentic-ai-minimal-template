/**
 * Tests for useDebounce hook.
 *
 * Tests:
 * - Returns initial value immediately
 * - Debounces value changes by specified delay
 * - Uses default delay of 300ms
 * - Clears timeout on unmount (no memory leaks)
 * - Handles rapid value changes (only last value emitted)
 */

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useDebounce } from "./useDebounce";

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("initial", 300));

    expect(result.current).toBe("initial");
  });

  it("does not update value before delay", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: "first" } },
    );

    expect(result.current).toBe("first");

    rerender({ value: "second" });

    // Value should not change immediately
    expect(result.current).toBe("first");

    // Advance time but not enough
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Still should be the original value
    expect(result.current).toBe("first");
  });

  it("updates value after delay", async () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: "first" } },
    );

    rerender({ value: "second" });

    // Advance time past the delay
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe("second");
  });

  it("uses default delay of 300ms", () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value), {
      initialProps: { value: "first" },
    });

    rerender({ value: "second" });

    // 299ms should not be enough
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe("first");

    // 1 more ms should trigger the update
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("second");
  });

  it("handles rapid value changes (only last value emitted)", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: "first" } },
    );

    // Rapid changes
    rerender({ value: "second" });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    rerender({ value: "third" });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    rerender({ value: "fourth" });

    // Value should still be "first" as no delay has completed
    expect(result.current).toBe("first");

    // Complete the delay
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Only the last value should be used
    expect(result.current).toBe("fourth");
  });

  it("resets timer on each value change", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: "first" } },
    );

    rerender({ value: "second" });

    // Almost complete the delay
    act(() => {
      vi.advanceTimersByTime(250);
    });

    // Change value again - this should reset the timer
    rerender({ value: "third" });

    // Complete what would have been the first delay
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Should still be "first" because timer was reset
    expect(result.current).toBe("first");

    // Complete the second delay
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current).toBe("third");
  });

  it("works with different types", () => {
    // Test with number
    const { result: numberResult, rerender: rerenderNumber } = renderHook(
      ({ value }) => useDebounce(value, 100),
      { initialProps: { value: 1 } },
    );

    rerenderNumber({ value: 42 });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(numberResult.current).toBe(42);

    // Test with object
    const obj1 = { a: 1 };
    const obj2 = { a: 2 };
    const { result: objectResult, rerender: rerenderObject } = renderHook(
      ({ value }) => useDebounce(value, 100),
      { initialProps: { value: obj1 } },
    );

    rerenderObject({ value: obj2 });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(objectResult.current).toBe(obj2);
  });

  it("handles delay change", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "first", delay: 300 } },
    );

    // Change both value and delay
    rerender({ value: "second", delay: 100 });

    // New shorter delay should be used
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current).toBe("second");
  });

  it("cleans up timeout on unmount", () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

    const { unmount, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: "first" } },
    );

    // Trigger a timeout
    rerender({ value: "second" });

    // Unmount should clear the timeout
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();

    clearTimeoutSpy.mockRestore();
  });

  it("handles null and undefined values", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce<string | null | undefined>(value, 100),
      { initialProps: { value: "first" as string | null | undefined } },
    );

    rerender({ value: null });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBeNull();

    rerender({ value: undefined });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBeUndefined();
  });
});
