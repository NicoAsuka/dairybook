import { describe, expect, it } from "vitest";
import { searchEntries } from "@/lib/search";
import { makeEntry, makeMonth } from "../fixtures/month";

const may = makeMonth("2026-05", {
  "2026-05-07": { entries: [
    makeEntry({ id: "a", text: "晨读人间词话", tagId: "read", start: "09:00", end: "10:00" }),
    makeEntry({ id: "b", text: "写代码 dairybook", tagId: "work", start: "10:00", end: "12:00" }),
  ]},
  "2026-05-08": { entries: [
    makeEntry({ id: "c", text: "煮咖啡", tagId: "rest", start: "08:00", end: "08:30" }),
  ]},
});

const months = [{ data: may, sha: "x" }];

describe("searchEntries", () => {
  it("matches by keyword (case-insensitive substring on text)", () => {
    const hits = searchEntries(months, { keyword: "代码" });
    expect(hits.map((h) => h.entry.id)).toEqual(["b"]);
  });

  it("filters by tagId", () => {
    const hits = searchEntries(months, { tagIds: ["read"] });
    expect(hits.map((h) => h.entry.id)).toEqual(["a"]);
  });

  it("filters by tagId = null (untagged)", () => {
    const m2 = makeMonth("2026-05", {
      "2026-05-07": { entries: [makeEntry({ id: "u", tagId: null })] },
    });
    const hits = searchEntries([{ data: m2, sha: "y" }], { tagIds: [null] });
    expect(hits.map((h) => h.entry.id)).toEqual(["u"]);
  });

  it("filters by date range (inclusive)", () => {
    const hits = searchEntries(months, { from: "2026-05-08", to: "2026-05-08" });
    expect(hits.map((h) => h.entry.id)).toEqual(["c"]);
  });

  it("combines filters with AND", () => {
    const hits = searchEntries(months, { keyword: "咖啡", tagIds: ["rest"] });
    expect(hits).toHaveLength(1);
    expect(hits[0]!.entry.id).toBe("c");
  });

  it("returns hits sorted by date desc, then start asc", () => {
    const hits = searchEntries(months, {});
    expect(hits.map((h) => `${h.date} ${h.entry.start}`)).toEqual([
      "2026-05-08 08:00",
      "2026-05-07 09:00",
      "2026-05-07 10:00",
    ]);
  });
});
