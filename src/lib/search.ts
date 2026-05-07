import type { Entry, MonthDoc } from "./types";

export interface SearchFilter {
  keyword?: string;
  tagIds?: (string | null)[];
  from?: string;
  to?: string;
}

export interface SearchHit {
  date: string;
  entry: Entry;
}

export function searchEntries(months: MonthDoc[], filter: SearchFilter): SearchHit[] {
  const kw = filter.keyword?.trim().toLowerCase() ?? "";
  const tagSet = filter.tagIds ? new Set<string | null>(filter.tagIds) : null;
  const hits: SearchHit[] = [];

  for (const doc of months) {
    for (const [date, day] of Object.entries(doc.data.days)) {
      if (filter.from && date < filter.from) continue;
      if (filter.to && date > filter.to) continue;
      for (const e of day.entries) {
        if (kw && !e.text.toLowerCase().includes(kw)) continue;
        if (tagSet && !tagSet.has(e.tagId)) continue;
        hits.push({ date, entry: e });
      }
    }
  }

  hits.sort((a, b) =>
    a.date === b.date
      ? a.entry.start.localeCompare(b.entry.start)
      : b.date.localeCompare(a.date),
  );
  return hits;
}
