import { reactive } from "vue";
import { GitHubClient } from "./github";
import { SyncEngine } from "./sync";
import { newId } from "./id";
import { formatYMD, monthOf } from "./date";
import * as idb from "./idb";
import type { AuthState, Entry, MonthDoc, RepoState, SyncStatus, Tag, TagsData, TagsDoc } from "./types";
import { mergeTagsData } from "./merge";
import { onReconnect } from "./network";

const DATA_REPO = "dairybook-data";

interface StoreState {
  auth: AuthState;
  repo: RepoState;
  selectedDate: string;
  months: Record<string, MonthDoc>;
  syncStatus: SyncStatus;
  tags: TagsDoc;
  tagsSyncStatus: SyncStatus;
}

let _instance: ReturnType<typeof createStore> | null = null;

function createStore() {
  const state = reactive<StoreState>({
    auth: { kind: "anonymous" },
    repo: { kind: "unknown" },
    selectedDate: formatYMD(new Date()),
    months: {},
    syncStatus: { kind: "idle" },
    tags: { data: { version: 1, tags: [] }, sha: null },
    tagsSyncStatus: { kind: "idle" },
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
      onSynced: (month, doc) => {
        state.months[month] = doc;
        void idb.cacheMonth(month, doc);
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
        if (state.repo.kind === "ready") {
          await Promise.all([
            loadMonth(monthOf(state.selectedDate)),
            loadTags(),
          ]);
        }
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
    if (state.repo.kind === "ready") {
      await Promise.all([
        loadMonth(monthOf(state.selectedDate)),
        loadTags(),
      ]);
    }
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

  let tagsBase: TagsData = state.tags.data;
  let tagsTimer: ReturnType<typeof setTimeout> | null = null;

  async function loadTags(): Promise<void> {
    if (!client) return;
    const fresh = await client.getTags();
    state.tags = fresh;
    tagsBase = fresh.data;
  }

  function flushTags(): void {
    if (!client) return;
    state.tagsSyncStatus = { kind: "saving" };
    const snapshot = JSON.parse(JSON.stringify(state.tags.data)) as TagsData;
    const sha = state.tags.sha;
    void (async () => {
      try {
        const r = await client!.putTags(snapshot, sha);
        state.tags.sha = r.sha;
        tagsBase = snapshot;
        state.tagsSyncStatus = { kind: "saved", at: Date.now() };
      } catch (err) {
        const e = err as Error & { status?: number };
        if (e.status === 409) {
          const remote = await client!.getTags();
          const merged = mergeTagsData(tagsBase, snapshot, remote.data);
          state.tags = { data: merged, sha: remote.sha };
          scheduleTagsSave();
        } else {
          state.tagsSyncStatus = { kind: "error", message: e.message, retryable: true };
        }
      }
    })();
  }

  function scheduleTagsSave(): void {
    if (tagsTimer) clearTimeout(tagsTimer);
    tagsTimer = setTimeout(() => { tagsTimer = null; flushTags(); }, 1000);
  }

  function upsertTag(tag: Tag): void {
    const idx = state.tags.data.tags.findIndex((t) => t.id === tag.id);
    if (idx >= 0) state.tags.data.tags[idx] = tag;
    else state.tags.data.tags.push(tag);
    scheduleTagsSave();
  }

  function deleteTag(id: string): void {
    const t = state.tags.data.tags.find((t) => t.id === id);
    if (!t) return;
    const now = new Date().toISOString();
    t.deletedAt = now;
    t.updatedAt = now;
    scheduleTagsSave();
  }

  function activeTags(): Tag[] {
    return state.tags.data.tags.filter((t) => t.deletedAt === null);
  }

  function getTagById(id: string | null): Tag | null {
    if (!id) return null;
    const t = state.tags.data.tags.find((t) => t.id === id);
    return t && t.deletedAt === null ? t : null;
  }

  function retryFailed(): void {
    if (sync) {
      const m = monthOf(state.selectedDate);
      const doc = state.months[m];
      if (doc) sync.scheduleSave(m, doc);
    }
    if (state.tagsSyncStatus.kind === "error") {
      scheduleTagsSave();
    }
  }

  onReconnect(() => {
    if (state.syncStatus.kind === "error" || state.tagsSyncStatus.kind === "error") {
      retryFailed();
    }
  });

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
    loadTags, upsertTag, deleteTag, activeTags, getTagById,
    retryFailed,
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
