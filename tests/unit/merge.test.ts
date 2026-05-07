import { describe, expect, it } from "vitest";
import { mergeMonths } from "@/lib/merge";
import { makeEntry, makeMonth } from "../fixtures/month";

describe("mergeMonths", () => {
  it("returns local when remote equals base (nothing to merge)", () => {
    const base = makeMonth("2026-05", {
      "2026-05-07": { entries: [makeEntry({ id: "a" })] },
    });
    const local = makeMonth("2026-05", {
      "2026-05-07": { entries: [makeEntry({ id: "a", text: "edited locally", updatedAt: "2026-05-07T10:00:00Z" })] },
    });
    const merged = mergeMonths(base, local, base);
    expect(merged.days["2026-05-07"]?.entries[0]?.text).toBe("edited locally");
  });

  it("keeps both sides' new entries", () => {
    const base = makeMonth("2026-05", { "2026-05-07": { entries: [] } });
    const local = makeMonth("2026-05", {
      "2026-05-07": { entries: [makeEntry({ id: "loc", text: "L" })] },
    });
    const remote = makeMonth("2026-05", {
      "2026-05-07": { entries: [makeEntry({ id: "rem", text: "R" })] },
    });
    const merged = mergeMonths(base, local, remote);
    const ids = (merged.days["2026-05-07"]?.entries ?? []).map((e) => e.id).sort();
    expect(ids).toEqual(["loc", "rem"]);
  });

  it("on same-id concurrent edit, keeps the newer updatedAt", () => {
    const base = makeMonth("2026-05", {
      "2026-05-07": { entries: [makeEntry({ id: "a", text: "base", updatedAt: "2026-05-07T09:00:00Z" })] },
    });
    const local = makeMonth("2026-05", {
      "2026-05-07": { entries: [makeEntry({ id: "a", text: "local", updatedAt: "2026-05-07T10:00:00Z" })] },
    });
    const remote = makeMonth("2026-05", {
      "2026-05-07": { entries: [makeEntry({ id: "a", text: "remote", updatedAt: "2026-05-07T11:00:00Z" })] },
    });
    const merged = mergeMonths(base, local, remote);
    expect(merged.days["2026-05-07"]?.entries[0]?.text).toBe("remote");
  });

  it("preserves the edited side when one deletes and one edits", () => {
    const base = makeMonth("2026-05", {
      "2026-05-07": { entries: [makeEntry({ id: "a", text: "base" })] },
    });
    const local = makeMonth("2026-05", {
      "2026-05-07": { entries: [] },  // local deleted
    });
    const remote = makeMonth("2026-05", {
      "2026-05-07": { entries: [makeEntry({ id: "a", text: "edited", updatedAt: "2026-05-07T11:00:00Z" })] },
    });
    const merged = mergeMonths(base, local, remote);
    expect(merged.days["2026-05-07"]?.entries.map((e) => e.text)).toEqual(["edited"]);
  });

  it("removes when both sides delete the same entry", () => {
    const base = makeMonth("2026-05", {
      "2026-05-07": { entries: [makeEntry({ id: "a" })] },
    });
    const local = makeMonth("2026-05", { "2026-05-07": { entries: [] } });
    const remote = makeMonth("2026-05", { "2026-05-07": { entries: [] } });
    const merged = mergeMonths(base, local, remote);
    expect(merged.days["2026-05-07"]?.entries).toEqual([]);
  });

  it("merges across different days", () => {
    const base = makeMonth("2026-05", {});
    const local = makeMonth("2026-05", {
      "2026-05-07": { entries: [makeEntry({ id: "a" })] },
    });
    const remote = makeMonth("2026-05", {
      "2026-05-08": { entries: [makeEntry({ id: "b" })] },
    });
    const merged = mergeMonths(base, local, remote);
    expect(Object.keys(merged.days).sort()).toEqual(["2026-05-07", "2026-05-08"]);
  });

  it("orders merged entries by start time then id", () => {
    const base = makeMonth("2026-05", { "2026-05-07": { entries: [] } });
    const local = makeMonth("2026-05", {
      "2026-05-07": { entries: [makeEntry({ id: "x", start: "11:00", end: "12:00" })] },
    });
    const remote = makeMonth("2026-05", {
      "2026-05-07": { entries: [makeEntry({ id: "y", start: "09:00", end: "10:00" })] },
    });
    const merged = mergeMonths(base, local, remote);
    expect(merged.days["2026-05-07"]?.entries.map((e) => e.id)).toEqual(["y", "x"]);
  });
});
