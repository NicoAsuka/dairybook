import { describe, expect, it } from "vitest";
import { newId } from "@/lib/id";

describe("newId", () => {
  it("returns 26-char ULID", () => {
    const id = newId();
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });
  it("is monotonically sortable across rapid calls", () => {
    const ids = Array.from({ length: 50 }, () => newId());
    const sorted = [...ids].sort();
    expect(sorted).toEqual(ids);
  });
});
