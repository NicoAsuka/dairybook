import { GitHubError } from "./github";
import { mergeMonths } from "./merge";
import type { MonthData, MonthDoc } from "./types";

export interface SyncDeps {
  debounceMs: number;
  retryDelayMs?: number;
  getMonth: (m: string) => Promise<MonthDoc>;
  putMonth: (m: string, data: MonthData, sha: string | null) => Promise<{ sha: string }>;
  onStatus?: (status: "saving" | "saved" | "error", err?: Error) => void;
  onSynced?: (month: string, doc: MonthDoc) => void;
}

interface Pending {
  doc: MonthDoc;
  base: MonthData;
  timer: ReturnType<typeof setTimeout> | null;
}

export class SyncEngine {
  private pending = new Map<string, Pending>();
  private retryDelayMs: number;

  constructor(private deps: SyncDeps) {
    this.retryDelayMs = deps.retryDelayMs ?? 1000;
  }

  scheduleSave(month: string, doc: MonthDoc): void {
    const existing = this.pending.get(month);
    const base = existing?.base ?? { version: 1, month, days: {} };
    if (existing?.timer) clearTimeout(existing.timer);
    const timer = setTimeout(() => void this.flush(month), this.deps.debounceMs);
    this.pending.set(month, { doc, base, timer });
  }

  private async flush(month: string, attempt = 0, conflicts = 0): Promise<void> {
    const p = this.pending.get(month);
    if (!p) return;
    p.timer = null;
    this.deps.onStatus?.("saving");
    try {
      const result = await this.deps.putMonth(month, p.doc.data, p.doc.sha);
      const current = this.pending.get(month);
      if (current && current !== p && current.timer) {
        // New edit arrived during flush; preserve it but update sync base
        current.base = p.doc.data;
        // Update sha so next flush uses the correct sha
        // Don't touch current.doc or current.timer - the pending edit is still valid
      } else {
        this.pending.set(month, { doc: { data: p.doc.data, sha: result.sha }, base: p.doc.data, timer: null });
      }
      this.deps.onSynced?.(month, { data: p.doc.data, sha: result.sha });
      this.deps.onStatus?.("saved");
    } catch (err) {
      if (err instanceof GitHubError && err.status === 409) {
        if (conflicts >= 3) {
          this.deps.onStatus?.("error", new Error("too many conflicts"));
          return;
        }
        const remote = await this.deps.getMonth(month);
        const merged = mergeMonths(p.base, p.doc.data, remote.data);
        const current = this.pending.get(month);
        if (current && current !== p && current.timer) {
          // New edit arrived during 409 handling; preserve it but update sync base
          current.base = remote.data;
        } else {
          this.pending.set(month, { doc: { data: merged, sha: remote.sha }, base: remote.data, timer: null });
        }
        return this.flush(month, attempt, conflicts + 1);
      }
      if (err instanceof GitHubError && err.status >= 500 && attempt < 3) {
        await new Promise((r) => setTimeout(r, this.retryDelayMs * 2 ** attempt));
        return this.flush(month, attempt + 1);
      }
      this.deps.onStatus?.("error", err as Error);
    }
  }

  async drain(): Promise<void> {
    for (const month of [...this.pending.keys()]) {
      await this.flush(month);
    }
  }

  getPending(month: string): MonthDoc | undefined {
    return this.pending.get(month)?.doc;
  }
}
