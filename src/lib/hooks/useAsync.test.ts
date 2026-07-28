import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useAsync } from "@/lib/hooks/useAsync";

describe("useAsync", () => {
  it("levert data en zet loading op false na succes", async () => {
    const { result } = renderHook(() => useAsync(() => Promise.resolve(42), []));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe(42);
    expect(result.current.error).toBeNull();
  });

  it("vangt een fout op en zet de foutmelding", async () => {
    const { result } = renderHook(() =>
      useAsync(() => Promise.reject(new Error("boem")), []),
    );
    await waitFor(() => expect(result.current.error).toBe("boem"));
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("toont de message van een Supabase-foutobject", async () => {
    const { result } = renderHook(() =>
      useAsync(() => Promise.reject({ message: "relation profiles does not exist" }), []),
    );
    await waitFor(() =>
      expect(result.current.error).toBe("relation profiles does not exist"),
    );
  });

  it("draait de functie opnieuw bij reload()", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const { result } = renderHook(() => useAsync(fn, []));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fn).toHaveBeenCalledTimes(1);

    act(() => result.current.reload());
    await waitFor(() => expect(fn).toHaveBeenCalledTimes(2));
  });
});
