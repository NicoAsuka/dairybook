import { describe, expect, it } from "vitest";
import {
  addDays,
  compareTimes,
  formatYM,
  formatYMD,
  isValidTime,
  monthOf,
  parseYMD,
} from "@/lib/date";

describe("formatYM", () => {
  it("formats Date to YYYY-MM", () => {
    expect(formatYM(new Date(Date.UTC(2026, 4, 7)))).toBe("2026-05");
  });
});

describe("formatYMD / parseYMD", () => {
  it("roundtrips", () => {
    const d = parseYMD("2026-05-07");
    expect(formatYMD(d)).toBe("2026-05-07");
  });
});

describe("addDays", () => {
  it("crosses month boundary", () => {
    expect(formatYMD(addDays(parseYMD("2026-05-31"), 1))).toBe("2026-06-01");
  });
  it("subtracts negative", () => {
    expect(formatYMD(addDays(parseYMD("2026-05-01"), -1))).toBe("2026-04-30");
  });
});

describe("monthOf", () => {
  it("derives YYYY-MM from YYYY-MM-DD", () => {
    expect(monthOf("2026-05-07")).toBe("2026-05");
  });
});

describe("isValidTime", () => {
  it("accepts HH:MM 24h", () => {
    expect(isValidTime("00:00")).toBe(true);
    expect(isValidTime("23:59")).toBe(true);
  });
  it("rejects bad input", () => {
    expect(isValidTime("24:00")).toBe(false);
    expect(isValidTime("9:00")).toBe(false);
    expect(isValidTime("ab:cd")).toBe(false);
  });
});

describe("compareTimes", () => {
  it("returns negative / 0 / positive", () => {
    expect(compareTimes("09:00", "10:00")).toBeLessThan(0);
    expect(compareTimes("09:00", "09:00")).toBe(0);
    expect(compareTimes("10:00", "09:00")).toBeGreaterThan(0);
  });
});
