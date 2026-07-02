import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRefetchOnFocus } from "./useRefetchOnFocus";

afterEach(() => {
  vi.useRealTimers();
});

describe("useRefetchOnFocus", () => {
  it("roept onFocus aan bij window-focus, met cooldown tegen dubbele events", () => {
    const onFocus = vi.fn();
    renderHook(() => useRefetchOnFocus(onFocus, 2000));

    window.dispatchEvent(new Event("focus"));
    expect(onFocus).toHaveBeenCalledTimes(1);

    // visibilitychange direct erna valt binnen de cooldown → geen tweede call.
    document.dispatchEvent(new Event("visibilitychange"));
    expect(onFocus).toHaveBeenCalledTimes(1);
  });

  it("triggert opnieuw na de cooldown", () => {
    vi.useFakeTimers();
    const onFocus = vi.fn();
    renderHook(() => useRefetchOnFocus(onFocus, 1000));

    window.dispatchEvent(new Event("focus"));
    vi.advanceTimersByTime(1500);
    window.dispatchEvent(new Event("focus"));
    expect(onFocus).toHaveBeenCalledTimes(2);
  });

  it("ruimt de listeners op bij unmount", () => {
    const onFocus = vi.fn();
    const { unmount } = renderHook(() => useRefetchOnFocus(onFocus));
    unmount();
    window.dispatchEvent(new Event("focus"));
    expect(onFocus).not.toHaveBeenCalled();
  });
});
