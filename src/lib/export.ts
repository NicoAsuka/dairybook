import type { MonthDoc, TagsData } from "./types";

export function buildJsonExport(months: MonthDoc[], tags: TagsData): Blob {
  const payload = {
    exportedAt: new Date().toISOString(),
    tags,
    months: Object.fromEntries(months.map((m) => [m.data.month, m.data])),
  };
  return new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
}

export function buildMarkdownExport(months: MonthDoc[], tags: TagsData): string {
  const tagMap = new Map(tags.tags.filter((t) => t.deletedAt === null).map((t) => [t.id, t]));
  const sortedMonths = [...months].sort((a, b) => a.data.month.localeCompare(b.data.month));
  const out: string[] = [];
  for (const m of sortedMonths) {
    out.push(`# ${m.data.month}`, "");
    const sortedDays = Object.keys(m.data.days).sort();
    for (const date of sortedDays) {
      out.push(`## ${date}`, "");
      const entries = [...m.data.days[date]!.entries].sort((a, b) => a.start.localeCompare(b.start));
      for (const e of entries) {
        const tagPart = e.tagId ? `[${tagMap.get(e.tagId)?.name ?? e.tagId}] ` : "";
        out.push(`- **${e.start}–${e.end}** ${tagPart}${e.text}`);
      }
      out.push("");
    }
  }
  return out.join("\n");
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
