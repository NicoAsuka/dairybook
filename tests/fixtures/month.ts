import type { Entry, MonthData } from "@/lib/types";

export function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: "01TEST00000000000000000001",
    start: "09:00",
    end: "10:00",
    text: "default",
    tagId: null,
    createdAt: "2026-05-07T09:00:00Z",
    updatedAt: "2026-05-07T09:00:00Z",
    ...overrides,
  };
}

export function makeMonth(month = "2026-05", days: MonthData["days"] = {}): MonthData {
  return { version: 1, month, days };
}
