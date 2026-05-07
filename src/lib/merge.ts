import type { Entry, MonthData, Tag, TagsData } from "./types";

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

function indexTags(td: TagsData): Map<string, Tag> {
  const m = new Map<string, Tag>();
  for (const t of td.tags) m.set(t.id, t);
  return m;
}

function newerTag(a: Tag, b: Tag): Tag {
  return a.updatedAt >= b.updatedAt ? a : b;
}

export function mergeTagsData(base: TagsData, local: TagsData, remote: TagsData): TagsData {
  const bMap = indexTags(base);
  const lMap = indexTags(local);
  const rMap = indexTags(remote);
  const ids = new Set<string>([...bMap.keys(), ...lMap.keys(), ...rMap.keys()]);
  const out: Tag[] = [];

  for (const id of ids) {
    const b = bMap.get(id);
    const l = lMap.get(id);
    const r = rMap.get(id);

    if (!b && l && r) out.push(newerTag(l, r));
    else if (!b && l) out.push(l);
    else if (!b && r) out.push(r);
    else if (b && l && r) {
      const localChanged = l.updatedAt !== b.updatedAt;
      const remoteChanged = r.updatedAt !== b.updatedAt;
      if (localChanged && remoteChanged) out.push(newerTag(l, r));
      else if (localChanged) out.push(l);
      else out.push(r);
    } else if (b && l && !r) {
      out.push(l);
    } else if (b && !l && r) {
      out.push(r);
    }
  }

  out.sort((a, b) => a.id.localeCompare(b.id));
  return { version: 1, tags: out };
}
