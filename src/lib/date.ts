const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function formatYM(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function formatYMD(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseYMD(s: string): Date {
  const parts = s.split("-").map(Number);
  return new Date(Date.UTC(parts[0]!, parts[1]! - 1, parts[2]!));
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d.getTime());
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

export function monthOf(ymd: string): string {
  return ymd.slice(0, 7);
}

export function isValidTime(s: string): boolean {
  return TIME_RE.test(s);
}

export function compareTimes(a: string, b: string): number {
  return a.localeCompare(b);
}
