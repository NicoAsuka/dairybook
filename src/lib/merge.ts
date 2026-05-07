import type { Entry, MonthData } from "./types";

type EntryMap = Map<string, Entry>;

function indexEntries(month: MonthData, day: string): EntryMap {
  const m = new Map<string, Entry>();
  for (const e of month.days[day]?.entries ?? []) m.set(e.id, e);
  return m;
}

function newer(a: Entry, b: Entry): Entry {
  return a.updatedAt >= b.updatedAt ? a : b;
}

function mergeDayEntries(base: EntryMap, local: EntryMap, remote: EntryMap): Entry[] {
  const ids = new Set<string>([...base.keys(), ...local.keys(), ...remote.keys()]);
  const out: Entry[] = [];

  for (const id of ids) {
    const b = base.get(id);
    const l = local.get(id);
    const r = remote.get(id);

    if (!b && l && r) {
      out.push(newer(l, r));
    } else if (!b && l) {
      out.push(l);
    } else if (!b && r) {
      out.push(r);
    } else if (b && l && r) {
      const localChanged = l.updatedAt !== b.updatedAt;
      const remoteChanged = r.updatedAt !== b.updatedAt;
      if (localChanged && remoteChanged) out.push(newer(l, r));
      else if (localChanged) out.push(l);
      else out.push(r);
    } else if (b && l && !r) {
      if (l.updatedAt === b.updatedAt) {
        // both effectively unchanged from base on local → accept remote delete
      } else {
        out.push(l);
      }
    } else if (b && !l && r) {
      if (r.updatedAt === b.updatedAt) {
        // accept delete
      } else {
        out.push(r);
      }
    }
    // both deleted → drop (no push)
  }

  out.sort((a, b) => (a.start === b.start ? a.id.localeCompare(b.id) : a.start.localeCompare(b.start)));
  return out;
}

export function mergeMonths(base: MonthData, local: MonthData, remote: MonthData): MonthData {
  const days: MonthData["days"] = {};
  const allDays = new Set<string>([
    ...Object.keys(base.days),
    ...Object.keys(local.days),
    ...Object.keys(remote.days),
  ]);
  for (const day of allDays) {
    const merged = mergeDayEntries(
      indexEntries(base, day),
      indexEntries(local, day),
      indexEntries(remote, day),
    );
    days[day] = { entries: merged };
  }
  return { version: 1, month: local.month, days };
}
