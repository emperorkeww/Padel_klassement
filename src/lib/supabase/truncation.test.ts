import { describe, it, expect, vi, afterEach } from "vitest";
import { MAX_ROWS, warnIfTruncated } from "./truncation";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("warnIfTruncated (#731)", () => {
  it("geeft de rijen ongewijzigd terug", () => {
    const rows = [{ id: "a" }, { id: "b" }];
    expect(warnIfTruncated(rows, "teams")).toBe(rows);
  });

  it("zwijgt onder de limiet", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    warnIfTruncated([1, 2, 3], "teams", 4);
    expect(warn).not.toHaveBeenCalled();
  });

  it("waarschuwt zodra een resultaat exact de limiet raakt", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    warnIfTruncated([1, 2, 3], "teams", 3);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("teams");
  });

  it("gebruikt max_rows als er geen expliciete limiet is", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    warnIfTruncated(new Array(MAX_ROWS - 1).fill(0), "profiles");
    expect(warn).not.toHaveBeenCalled();
    warnIfTruncated(new Array(MAX_ROWS).fill(0), "profiles");
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
