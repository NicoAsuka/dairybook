import { describe, expect, it } from "vitest";
import { buildJsonExport, buildMarkdownExport } from "@/lib/export";
import { makeEntry, makeMonth, makeTag, makeTagsData } from "../fixtures/month";

const months = [
  { data: makeMonth("2026-05", {
    "2026-05-07": { entries: [
      makeEntry({ id: "a", text: "晨读 **人间词话**", tagId: "read", start: "09:00", end: "10:00" }),
      makeEntry({ id: "b", text: "写代码", tagId: null,   start: "10:00", end: "11:00" }),
    ]},
  }), sha: "x" },
];
const tags = makeTagsData([makeTag({ id: "read", name: "阅读", color: "#ef9a3c" })]);

describe("buildJsonExport", () => {
  it("returns valid JSON blob", () => {
    const blob = buildJsonExport(months, tags);
    expect(blob.type).toBe("application/json");
  });
});

describe("buildMarkdownExport", () => {
  it("produces month/day headings + entries with time + tag", () => {
    const md = buildMarkdownExport(months, tags);
    expect(md).toContain("# 2026-05");
    expect(md).toContain("## 2026-05-07");
    expect(md).toContain("- **09:00–10:00** [阅读] 晨读 **人间词话**");
    expect(md).toContain("- **10:00–11:00** 写代码");
  });
});
