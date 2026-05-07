import { describe, expect, it } from "vitest";
import { mergeMonths, mergeTagsData } from "@/lib/merge";
import { makeEntry, makeMonth, makeTag, makeTagsData } from "../fixtures/month";

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

  it("preserves the edited side when local edits and remote deletes", () => {
    const base = makeMonth("2026-05", {
      "2026-05-07": { entries: [makeEntry({ id: "a", text: "base" })] },
    });
    const local = makeMonth("2026-05", {
      "2026-05-07": { entries: [makeEntry({ id: "a", text: "edited", updatedAt: "2026-05-07T10:00:00Z" })] },
    });
    const remote = makeMonth("2026-05", {
      "2026-05-07": { entries: [] },  // remote deleted
    });
    const merged = mergeMonths(base, local, remote);
    expect(merged.days["2026-05-07"]?.entries.map((e) => e.text)).toEqual(["edited"]);
  });

  it("keeps newer when both sides add entry with same id", () => {
    const base = makeMonth("2026-05", { "2026-05-07": { entries: [] } });
    const local = makeMonth("2026-05", {
      "2026-05-07": { entries: [makeEntry({ id: "same", text: "local", updatedAt: "2026-05-07T10:00:00Z" })] },
    });
    const remote = makeMonth("2026-05", {
      "2026-05-07": { entries: [makeEntry({ id: "same", text: "remote", updatedAt: "2026-05-07T11:00:00Z" })] },
    });
    const merged = mergeMonths(base, local, remote);
    expect(merged.days["2026-05-07"]?.entries[0]?.text).toBe("remote");
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

describe("mergeTagsData", () => {
  it("returns local-only when nothing remote/base diverges", () => {
    const base = makeTagsData([makeTag({ id: "a", name: "old", updatedAt: "T0" })]);
    const local = makeTagsData([makeTag({ id: "a", name: "local", updatedAt: "T1" })]);
    const merged = mergeTagsData(base, local, base);
    expect(merged.tags[0]?.name).toBe("local");
  });

  it("keeps both sides' new tags", () => {
    const base = makeTagsData([]);
    const local = makeTagsData([makeTag({ id: "L", name: "L", updatedAt: "T1" })]);
    const remote = makeTagsData([makeTag({ id: "R", name: "R", updatedAt: "T1" })]);
    const merged = mergeTagsData(base, local, remote);
    const ids = merged.tags.map((t) => t.id).sort();
    expect(ids).toEqual(["L", "R"]);
  });

  it("on same id concurrent edit, newer updatedAt wins", () => {
    const base = makeTagsData([makeTag({ id: "a", name: "base", updatedAt: "T0" })]);
    const local = makeTagsData([makeTag({ id: "a", name: "local", updatedAt: "T1" })]);
    const remote = makeTagsData([makeTag({ id: "a", name: "remote", updatedAt: "T2" })]);
    const merged = mergeTagsData(base, local, remote);
    expect(merged.tags[0]?.name).toBe("remote");
  });

  it("soft-deleted tag stays as deleted (deletedAt preserved by max updatedAt)", () => {
    const base = makeTagsData([makeTag({ id: "a", updatedAt: "T0" })]);
    const local = makeTagsData([makeTag({ id: "a", updatedAt: "T1", deletedAt: "T1" })]);
    const remote = makeTagsData([makeTag({ id: "a", name: "renamed", updatedAt: "T0" })]);
    const merged = mergeTagsData(base, local, remote);
    expect(merged.tags[0]?.deletedAt).toBe("T1");
  });
});
