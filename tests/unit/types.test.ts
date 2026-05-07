import { describe, expect, it } from "vitest";
import type { Entry } from "@/lib/types";

describe("types", () => {
  it("Entry shape compiles", () => {
    const e: Entry = {
      id: "01H",
      start: "09:00",
      end: "10:00",
      text: "x",
      tagId: null,
      createdAt: "2026-05-07T09:00:00Z",
      updatedAt: "2026-05-07T09:00:00Z",
    };
    expect(e.id).toBe("01H");
  });
});
