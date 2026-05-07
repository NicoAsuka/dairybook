import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SyncEngine } from "@/lib/sync";
import { GitHubError } from "@/lib/github";
import type { MonthDoc } from "@/lib/types";
import { makeEntry, makeMonth } from "../fixtures/month";

function makeEngine(stubs: Partial<{
  getMonth: (m: string) => Promise<MonthDoc>;
  putMonth: (m: string, data: any, sha: string | null) => Promise<{ sha: string }>;
}> = {}) {
  const calls: { put: any[]; get: string[] } = { put: [], get: [] };
  const get = stubs.getMonth ?? (async (m: string) => {
    return { data: makeMonth(m), sha: "remote-sha" };
  });
  const put = stubs.putMonth ?? (async (_m: string, _data: any, _sha: string | null) => {
    return { sha: "new-sha" };
  });
  const engine = new SyncEngine({
    debounceMs: 20,
    retryDelayMs: 1,
    getMonth: (m) => { calls.get.push(m); return get(m); },
    putMonth: (m, data, sha) => { calls.put.push({ m, data, sha }); return put(m, data, sha); },
  });
  return { engine, calls };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("SyncEngine debounce", () => {
  it("collapses rapid edits into one PUT", async () => {
    const { engine, calls } = makeEngine();
    const doc: MonthDoc = { data: makeMonth("2026-05", { "2026-05-07": { entries: [makeEntry({ id: "a" })] } }), sha: "s0" };
    engine.scheduleSave("2026-05", doc);
    engine.scheduleSave("2026-05", doc);
    engine.scheduleSave("2026-05", doc);
    expect(calls.put).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(25);
    expect(calls.put).toHaveLength(1);
  });
});

describe("SyncEngine 409 conflict", () => {
  it("on 409 fetches remote, merges, and re-PUTs", async () => {
    const remoteDoc: MonthDoc = {
      data: makeMonth("2026-05", { "2026-05-07": { entries: [makeEntry({ id: "rem", text: "R" })] } }),
      sha: "remote-sha-2",
    };
    let putCount = 0;
    const { engine, calls } = makeEngine({
      getMonth: async () => remoteDoc,
      putMonth: async (_m, _data, sha) => {
        putCount++;
        if (putCount === 1) throw new GitHubError(409, "conflict");
        return { sha: "merged-sha" };
      },
    });
    const local: MonthDoc = {
      data: makeMonth("2026-05", { "2026-05-07": { entries: [makeEntry({ id: "loc", text: "L" })] } }),
      sha: "local-sha",
    };
    engine.scheduleSave("2026-05", local);
    await vi.advanceTimersByTimeAsync(25);
    await vi.runAllTimersAsync();
    expect(putCount).toBe(2);
    const finalPut = calls.put[1];
    const ids = finalPut.data.days["2026-05-07"].entries.map((e: any) => e.id).sort();
    expect(ids).toEqual(["loc", "rem"]);
  });
});

describe("SyncEngine retry on transient error", () => {
  it("retries 5xx then succeeds", async () => {
    let putCount = 0;
    const { engine } = makeEngine({
      putMonth: async () => {
        putCount++;
        if (putCount === 1) throw new GitHubError(503, "down");
        return { sha: "ok" };
      },
    });
    engine.scheduleSave("2026-05", { data: makeMonth("2026-05"), sha: "s0" });
    await vi.advanceTimersByTimeAsync(25);
    await vi.runAllTimersAsync();
    expect(putCount).toBeGreaterThanOrEqual(2);
  });
});
