import { describe, expect, it } from "vitest";
import { aggregateByTag, aggregateDailyByTag } from "@/lib/stats";
import { makeEntry, makeMonth } from "../fixtures/month";

const month = makeMonth("2026-05", {
  "2026-05-07": { entries: [
    makeEntry({ id: "a", tagId: "work", start: "09:00", end: "10:30" }),
    makeEntry({ id: "b", tagId: "read", start: "10:30", end: "11:00" }),
  ]},
  "2026-05-08": { entries: [
    makeEntry({ id: "c", tagId: "work", start: "13:00", end: "15:00" }),
    makeEntry({ id: "d", tagId: null,   start: "20:00", end: "20:15" }),
  ]},
});

describe("aggregateByTag", () => {
  it("sums minutes by tagId across range", () => {
    const result = aggregateByTag([{ data: month, sha: "x" }], "2026-05-07", "2026-05-08");
    expect(result).toEqual([
      { tagId: "work", minutes: 210 },
      { tagId: "read", minutes: 30 },
      { tagId: null,   minutes: 15 },
    ]);
  });

  it("respects the date range", () => {
    const result = aggregateByTag([{ data: month, sha: "x" }], "2026-05-08", "2026-05-08");
    expect(result.find((r) => r.tagId === "work")?.minutes).toBe(120);
    expect(result.find((r) => r.tagId === "read")).toBeUndefined();
  });
});

describe("aggregateDailyByTag", () => {
  it("returns 7-day series for a week", () => {
    const days = aggregateDailyByTag([{ data: month, sha: "x" }], "2026-05-04", "2026-05-10");
    expect(days).toHaveLength(7);
    expect(days[0].date).toBe("2026-05-04");
    expect(days[3].byTag.find((t) => t.tagId === "work")?.minutes).toBe(90);
    expect(days[4].byTag.find((t) => t.tagId === "work")?.minutes).toBe(120);
  });
});
