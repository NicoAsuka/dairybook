import type { MonthDoc } from "./types";
import { addDays, formatYMD, parseYMD } from "./date";

function minutesBetween(start: string, end: string): number {
  const parts1 = start.split(":").map(Number);
  const parts2 = end.split(":").map(Number);
  return parts2[0]! * 60 + parts2[1]! - (parts1[0]! * 60 + parts1[1]!);
}

export interface TagTotal { tagId: string | null; minutes: number }
export interface DailyTotals { date: string; byTag: TagTotal[] }

export function aggregateByTag(months: MonthDoc[], from: string, to: string): TagTotal[] {
  const totals = new Map<string | null, number>();
  for (const doc of months) {
    for (const [date, day] of Object.entries(doc.data.days)) {
      if (date < from || date > to) continue;
      for (const e of day.entries) {
        totals.set(e.tagId, (totals.get(e.tagId) ?? 0) + minutesBetween(e.start, e.end));
      }
    }
  }
  return [...totals.entries()]
    .map(([tagId, minutes]) => ({ tagId, minutes }))
    .sort((a, b) => b.minutes - a.minutes);
}

export function aggregateDailyByTag(months: MonthDoc[], from: string, to: string): DailyTotals[] {
  const start = parseYMD(from);
  const end = parseYMD(to);
  const result: DailyTotals[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const date = formatYMD(d);
    result.push({ date, byTag: aggregateByTag(months, date, date) });
  }
  return result;
}
