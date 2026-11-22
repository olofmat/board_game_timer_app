import { describe, expect, it } from "vitest";
import { formatTotalAndPart } from "./format";

describe("formatTotalAndPart", () => {
  it("steps the total and the part up on the same moment", () => {
    // 12.4 s from earlier turns: rounding the total alone would show 0:13 at a 0.6 s turn.
    expect(formatTotalAndPart(12_400 + 600, 600)).toEqual({ total: "0:12", part: "0:00" });
    expect(formatTotalAndPart(12_400 + 999, 999)).toEqual({ total: "0:12", part: "0:00" });
    expect(formatTotalAndPart(12_400 + 1_000, 1_000)).toEqual({ total: "0:13", part: "0:01" });
  });

  it("shows the plain total when nothing is running", () => {
    expect(formatTotalAndPart(65_900, 0)).toEqual({ total: "1:05", part: "0:00" });
  });
});
