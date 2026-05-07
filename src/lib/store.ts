import { reactive } from "vue";
import { GitHubClient } from "./github";
import { SyncEngine } from "./sync";
import { newId } from "./id";
import { formatYMD, monthOf } from "./date";
import * as idb from "./idb";
import type { AuthState, Entry, MonthDoc, RepoState, SyncStatus } from "./types";

const DATA_REPO = "dairybook-data";

interface StoreState {
  auth: AuthState;
  repo: RepoState;
  selectedDate: string;
  months: Record<string, MonthDoc>;
  syncStatus: SyncStatus;
}

let _instance: ReturnType<typeof createStore> | null = null;

function createStore() {
  const state = reactive<StoreState>({
    auth: { kind: "anonymous" },
    repo: { kind: "unknown" },
    selectedDate: formatYMD(new Date()),
    months: {},
    syncStatus: { kind: "idle" },
  });

  let client: GitHubClient | null = null;
  let sync: SyncEngine | null = null;

  function setClientFromAuth() {
    if (state.auth.kind !== "logged-in" || state.repo.kind !== "ready") {
      client = null;
      sync = null;
      return;
    }
    client = new GitHubClient({
      token: state.auth.token,
      owner: state.repo.owner,
      repo: state.repo.repo,
    });
    sync = new SyncEngine({
      debounceMs: 1500,
      getMonth: (m) => client!.getMonth(m),
      putMonth: (m, data, sha) => client!.putMonth(m, data, sha),
      onStatus: (s, err) => {
        if (s === "saving") state.syncStatus = { kind: "saving" };
        else if (s === "saved") state.syncStatus = { kind: "saved", at: Date.now() };
        else state.syncStatus = { kind: "error", message: err?.message ?? "save failed", retryable: true };
      },
    });
  }

  async function bootFromCache() {
    const token = idb.getToken();
    if (token) {
      try {
        const tmpClient = new GitHubClient({ token, owner: "_", repo: "_" });
        const user = await tmpClient.getViewer();
        state.auth = { kind: "logged-in", token, user };
        state.repo = await detectRepo(token, user.login);
        setClientFromAuth();
        if (state.repo.kind === "ready") await loadMonth(monthOf(state.selectedDate));
      } catch {
        idb.clearToken();
        state.auth = { kind: "anonymous" };
      }
    }
  }

  async function detectRepo(token: string, owner: string): Promise<RepoState> {
    const c = new GitHubClient({ token, owner, repo: DATA_REPO });
    const r = await c.checkRepo();
    return r === "ready" ? { kind: "ready", owner, repo: DATA_REPO } : { kind: "missing" };
  }

  async function setLoggedIn(token: string): Promise<void> {
    idb.setToken(token);
    const tmpClient = new GitHubClient({ token, owner: "_", repo: "_" });
    const user = await tmpClient.getViewer();
    state.auth = { kind: "logged-in", token, user };
    state.repo = await detectRepo(token, user.login);
    setClientFromAuth();
    if (state.repo.kind === "ready") await loadMonth(monthOf(state.selectedDate));
  }

  async function logout(): Promise<void> {
    idb.clearToken();
    state.auth = { kind: "anonymous" };
    state.repo = { kind: "unknown" };
    state.months = {};
    client = null;
    sync = null;
  }

  async function loadMonth(month: string): Promise<void> {
    if (!client) return;
    const cached = await idb.getCachedMonth(month);
    if (cached) state.months[month] = cached;
    const fresh = await client.getMonth(month);
    state.months[month] = fresh;
    await idb.cacheMonth(month, fresh);
  }

  async function selectDate(ymd: string): Promise<void> {
    state.selectedDate = ymd;
    const m = monthOf(ymd);
    if (!state.months[m] && client) await loadMonth(m);
  }

  function entriesForSelectedDate(): Entry[] {
    const m = monthOf(state.selectedDate);
    return state.months[m]?.data.days[state.selectedDate]?.entries ?? [];
  }

  function upsertEntry(entry: Entry): void {
    const m = monthOf(state.selectedDate);
    const doc = state.months[m] ?? { data: { version: 1, month: m, days: {} }, sha: null };
    const day = doc.data.days[state.selectedDate] ?? { entries: [] };
    const idx = day.entries.findIndex((e) => e.id === entry.id);
    if (idx >= 0) day.entries[idx] = entry;
    else day.entries.push(entry);
    day.entries.sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
    doc.data.days[state.selectedDate] = day;
    state.months[m] = doc;
    void idb.cacheMonth(m, doc);
    sync?.scheduleSave(m, doc);
  }

  function deleteEntry(id: string): void {
    const m = monthOf(state.selectedDate);
    const doc = state.months[m];
    if (!doc) return;
    const day = doc.data.days[state.selectedDate];
    if (!day) return;
    day.entries = day.entries.filter((e) => e.id !== id);
    state.months[m] = { ...doc };
    void idb.cacheMonth(m, doc);
    sync?.scheduleSave(m, doc);
  }

  function newEntry(start: string, end: string): Entry {
    const now = new Date().toISOString();
    return {
      id: newId(),
      start,
      end,
      text: "",
      tagId: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  return {
    state,
    bootFromCache,
    setLoggedIn,
    logout,
    selectDate,
    loadMonth,
    entriesForSelectedDate,
    upsertEntry,
    deleteEntry,
    newEntry,
  };
}

export function useStore() {
  if (!_instance) _instance = createStore();
  return _instance;
}

// for tests
export function _resetStore() {
  _instance = null;
}
