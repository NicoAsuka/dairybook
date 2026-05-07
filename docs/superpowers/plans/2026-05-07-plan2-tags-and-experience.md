# dairybook Plan 2：标签 & 体验 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**前置：** Plan 1 全部完成且能用（登录、写 entry、跨设备同步）。

**Goal:** 在 MVP 内核上加上标签系统、颜色编码、Markdown 渲染、错误恢复 UI、离线指示，以及 QuickAdd 优化，让 dairybook 达到日常使用顺手的水平。

**Architecture:** 不改架构。新增一个 `tags.json` 顶级文件（与 `data/YYYY-MM.json` 平级），扩展 `merge.ts` 增加 tag 三向合并，扩展 `store.ts` 增加 tag 状态和 CRUD，新增/扩展若干 UI 组件。Markdown 渲染走 `markdown-it` 关闭 raw HTML。

**Tech Stack:** 沿用 Plan 1，新增依赖：`markdown-it` + `@types/markdown-it`。

**Plan 2 范围（明确不在内）:**
- ❌ 全局搜索（Plan 3）
- ❌ 统计柱图（Plan 3）
- ❌ 导出 md/json（Plan 3）

---

## 文件结构变化

```
dairybook/
├── src/
│   ├── lib/
│   │   ├── types.ts             # ➕ Tag, TagsData, TagsDoc
│   │   ├── merge.ts             # ➕ mergeTags
│   │   ├── github.ts            # ➕ getTags, putTags
│   │   ├── store.ts             # ➕ tags state + CRUD
│   │   ├── markdown.ts          # ✨ 新：safe markdown 渲染
│   │   └── network.ts           # ✨ 新：online/offline 监听
│   ├── components/
│   │   ├── TagSelect.vue        # ✨ 新：标签下拉
│   │   ├── TagBadge.vue         # ✨ 新：单个标签徽章
│   │   ├── TagSummary.vue       # ✨ 新：当日标签时长
│   │   ├── SettingsPanel.vue    # ✨ 新：标签管理 + token
│   │   ├── SyncStatusPill.vue   # ✨ 新：保存/重试/离线
│   │   ├── EntryCard.vue        # 🔧 用 tag 颜色，渲染 markdown
│   │   ├── EntryEditor.vue      # 🔧 加 TagSelect + 实时预览
│   │   ├── QuickAdd.vue         # 🔧 右键 / 长按可自定义时段
│   │   ├── TopBar.vue           # 🔧 嵌入 SyncStatusPill
│   │   └── App.vue              # 🔧 sidebar 加 TagSummary，齿轮入口
└── tests/...                    # 新增 tag 测试 + e2e
```

---

## Task 1：tag 类型与 fixture

**Files:**
- Modify: `src/lib/types.ts`, `tests/fixtures/month.ts`

- [ ] **Step 1：扩展 types.ts**

把整个文件替换为（保留 Plan 1 现有内容，追加 Tag 相关）：

```ts
// === 已有：保留 ===
export interface Entry {
  id: string;
  start: string;
  end: string;
  text: string;
  tagId: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface DayData { entries: Entry[]; }
export interface MonthData {
  version: 1;
  month: string;
  days: Record<string, DayData>;
}
export interface MonthDoc { data: MonthData; sha: string | null; }
export type AuthState =
  | { kind: "anonymous" }
  | { kind: "logged-in"; token: string; user: { login: string } };
export type RepoState =
  | { kind: "unknown" }
  | { kind: "missing" }
  | { kind: "ready"; owner: string; repo: string };
export type SyncStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: number }
  | { kind: "error"; message: string; retryable: boolean };

// === 新增 Plan 2 ===
export interface Tag {
  id: string;                 // 短英文 slug，不可改
  name: string;
  color: string;              // CSS hex "#RRGGBB"
  updatedAt: string;          // ISO 8601 UTC
  deletedAt: string | null;   // 软删除
}
export interface TagsData {
  version: 1;
  tags: Tag[];
}
export interface TagsDoc { data: TagsData; sha: string | null; }
```

- [ ] **Step 2：扩展 fixture**

在 `tests/fixtures/month.ts` 文件末尾追加：

```ts
import type { Tag, TagsData } from "@/lib/types";

export function makeTag(o: Partial<Tag> = {}): Tag {
  return {
    id: "work",
    name: "工作",
    color: "#5a8dee",
    updatedAt: "2026-05-07T08:00:00Z",
    deletedAt: null,
    ...o,
  };
}

export function makeTagsData(tags: Tag[] = []): TagsData {
  return { version: 1, tags };
}
```

- [ ] **Step 3：跑全套确认无破坏**

```bash
pnpm test
```

预期：所有现有测试 PASS。

- [ ] **Step 4：commit**

```bash
git add src/lib/types.ts tests/fixtures/month.ts
git commit -m "feat(types): add Tag + TagsData types"
```

---

## Task 2：tag 三向合并（merge.ts 扩展）

**Files:**
- Modify: `src/lib/merge.ts`
- Create: 在 `tests/unit/merge.test.ts` 中追加 describe 块

- [ ] **Step 1：先写测试**

在 `tests/unit/merge.test.ts` 顶部加 import：

```ts
import { mergeTagsData } from "@/lib/merge";
import { makeTag, makeTagsData } from "../fixtures/month";
```

文件末尾追加：

```ts
describe("mergeTagsData", () => {
  it("returns local-only when nothing remote/base diverges", () => {
    const base = makeTagsData([makeTag({ id: "a", name: "old", updatedAt: "T0" })]);
    const local = makeTagsData([makeTag({ id: "a", name: "local", updatedAt: "T1" })]);
    const merged = mergeTagsData(base, local, base);
    expect(merged.tags[0]?.name).toBe("local");
  });

  it("keeps both sides' new tags", () => {
    const base = makeTagsData([]);
    const local = makeTagsData([makeTag({ id: "L", name: "L", updatedAt: "T1" })]);
    const remote = makeTagsData([makeTag({ id: "R", name: "R", updatedAt: "T1" })]);
    const merged = mergeTagsData(base, local, remote);
    const ids = merged.tags.map((t) => t.id).sort();
    expect(ids).toEqual(["L", "R"]);
  });

  it("on same id concurrent edit, newer updatedAt wins", () => {
    const base = makeTagsData([makeTag({ id: "a", name: "base", updatedAt: "T0" })]);
    const local = makeTagsData([makeTag({ id: "a", name: "local", updatedAt: "T1" })]);
    const remote = makeTagsData([makeTag({ id: "a", name: "remote", updatedAt: "T2" })]);
    const merged = mergeTagsData(base, local, remote);
    expect(merged.tags[0]?.name).toBe("remote");
  });

  it("soft-deleted tag stays as deleted (deletedAt preserved by max updatedAt)", () => {
    const base = makeTagsData([makeTag({ id: "a", updatedAt: "T0" })]);
    const local = makeTagsData([makeTag({ id: "a", updatedAt: "T1", deletedAt: "T1" })]);
    const remote = makeTagsData([makeTag({ id: "a", name: "renamed", updatedAt: "T0" })]);
    // local strictly newer → wins → deletedAt sticks
    const merged = mergeTagsData(base, local, remote);
    expect(merged.tags[0]?.deletedAt).toBe("T1");
  });
});
```

- [ ] **Step 2：FAIL → 实现**

在 `src/lib/merge.ts` 顶部 import 加上 `Tag`、`TagsData`，文件末尾追加：

```ts
import type { Tag, TagsData } from "./types";

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
      // 远端"丢失"——但因为我们是软删除，远端不存在 ≈ 没听说过这条；保留本地
      out.push(l);
    } else if (b && !l && r) {
      out.push(r);
    }
    // both missing post-base → drop
  }

  // 稳定排序：按 id
  out.sort((a, b) => a.id.localeCompare(b.id));
  return { version: 1, tags: out };
}
```

- [ ] **Step 3：跑测试**

```bash
pnpm test tests/unit/merge.test.ts
```

预期：原 7 个 + 新 4 个 = 11 个 PASS。

- [ ] **Step 4：commit**

```bash
git add src/lib/merge.ts tests/unit/merge.test.ts
git commit -m "feat(merge): three-way merge for tags with soft delete"
```

---

## Task 3：GitHub client 增加 tags 端点

**Files:**
- Modify: `src/lib/github.ts`, `tests/unit/github.test.ts`

- [ ] **Step 1：写测试**

在 `tests/unit/github.test.ts` 末尾追加：

```ts
import type { TagsData } from "@/lib/types";

describe("GitHubClient.getTags", () => {
  it("returns parsed JSON + sha when 200", async () => {
    mswServer.use(
      http.get(`https://api.github.com/repos/${owner}/${repo}/contents/tags.json`, () =>
        HttpResponse.json({
          sha: "tag-sha",
          encoding: "base64",
          content: btoa(JSON.stringify({ version: 1, tags: [] })),
        }),
      ),
    );
    const client = new GitHubClient({ token, owner, repo });
    const doc = await client.getTags();
    expect(doc.sha).toBe("tag-sha");
    expect(doc.data.tags).toEqual([]);
  });

  it("returns null sha + empty tags when 404", async () => {
    mswServer.use(
      http.get(`https://api.github.com/repos/${owner}/${repo}/contents/tags.json`, () =>
        HttpResponse.json({ message: "Not Found" }, { status: 404 }),
      ),
    );
    const client = new GitHubClient({ token, owner, repo });
    const doc = await client.getTags();
    expect(doc.sha).toBeNull();
    expect(doc.data.tags).toEqual([]);
  });
});

describe("GitHubClient.putTags", () => {
  it("PUT with sha", async () => {
    let received: unknown;
    mswServer.use(
      http.put(`https://api.github.com/repos/${owner}/${repo}/contents/tags.json`, async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ content: { sha: "newtag" } });
      }),
    );
    const client = new GitHubClient({ token, owner, repo });
    const data: TagsData = { version: 1, tags: [] };
    const r = await client.putTags(data, "oldtag");
    expect(r.sha).toBe("newtag");
    expect((received as any).sha).toBe("oldtag");
  });
});
```

- [ ] **Step 2：FAIL → 实现**

在 `src/lib/github.ts` 顶部 import 类型：

```ts
import type { MonthData, MonthDoc, TagsData, TagsDoc } from "./types";
```

在类内（`checkRepo` 之后）加方法：

```ts
private tagsPath(): string {
  return `${API}/repos/${this.cfg.owner}/${this.cfg.repo}/contents/tags.json`;
}

async getTags(): Promise<TagsDoc> {
  const res = await fetch(this.tagsPath(), { headers: this.headers() });
  if (res.status === 404) {
    return { data: { version: 1, tags: [] }, sha: null };
  }
  if (!res.ok) throw new GitHubError(res.status, await res.text());
  const body = await res.json() as { sha: string; content: string };
  return {
    data: JSON.parse(base64ToUtf8(body.content.replace(/\n/g, ""))) as TagsData,
    sha: body.sha,
  };
}

async putTags(data: TagsData, sha: string | null): Promise<{ sha: string }> {
  const res = await fetch(this.tagsPath(), {
    method: "PUT",
    headers: { ...this.headers(), "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "tags: update",
      content: utf8ToBase64(JSON.stringify(data, null, 2)),
      ...(sha ? { sha } : {}),
    }),
  });
  if (!res.ok) throw new GitHubError(res.status, await res.text());
  const body = await res.json() as { content: { sha: string } };
  return { sha: body.content.sha };
}
```

- [ ] **Step 3：跑测试**

```bash
pnpm test tests/unit/github.test.ts
```

预期：原 5 + 新 3 = 8 个 PASS。

- [ ] **Step 4：commit**

```bash
git add src/lib/github.ts tests/unit/github.test.ts
git commit -m "feat(github): getTags + putTags endpoints"
```

---

## Task 4：store 增加 tags 状态与 CRUD

为简化，**tags 同步不复用 SyncEngine**——直接在 store 里写一个小防抖即可，因为 tags 写入频率比 entries 低得多，3-way merge 的 base 维护更简单（base = 上次拉的 data）。

**Files:**
- Modify: `src/lib/store.ts`

- [ ] **Step 1：扩展 store.ts**

在 `StoreState` 接口里加字段：

```ts
interface StoreState {
  auth: AuthState;
  repo: RepoState;
  selectedDate: string;
  months: Record<string, MonthDoc>;
  syncStatus: SyncStatus;
  // 新增：
  tags: TagsDoc;
  tagsSyncStatus: SyncStatus;
}
```

初始化里加：

```ts
const state = reactive<StoreState>({
  auth: { kind: "anonymous" },
  repo: { kind: "unknown" },
  selectedDate: formatYMD(new Date()),
  months: {},
  syncStatus: { kind: "idle" },
  tags: { data: { version: 1, tags: [] }, sha: null },
  tagsSyncStatus: { kind: "idle" },
});
```

import 顶部追加 `mergeTagsData`：

```ts
import { mergeTagsData } from "./merge";
import type { Tag } from "./types";
```

- [ ] **Step 2：在 createStore 内加 tags 相关函数**

```ts
let tagsBase: TagsData = state.tags.data;   // 上次 sync 完的版本
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
        // 冲突：拉远端 → 三向合并 → 重 PUT
        const remote = await client!.getTags();
        const merged = mergeTagsData(tagsBase, snapshot, remote.data);
        state.tags = { data: merged, sha: remote.sha };
        scheduleTagsSave();   // 触发新一轮 PUT 用合并后版本
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
```

- [ ] **Step 3：把这些方法加进 return 块**

```ts
return {
  state,
  bootFromCache, setLoggedIn, logout,
  selectDate, loadMonth,
  entriesForSelectedDate, upsertEntry, deleteEntry, newEntry,
  // 新增：
  loadTags, upsertTag, deleteTag, activeTags, getTagById,
};
```

- [ ] **Step 4：在 setLoggedIn / bootFromCache 成功路径里调用 loadTags**

`setLoggedIn` 末尾改成：

```ts
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
      loadTags(),                                  // ← 新增
    ]);
  }
}
```

`bootFromCache` 同理：

```ts
if (state.repo.kind === "ready") {
  await Promise.all([
    loadMonth(monthOf(state.selectedDate)),
    loadTags(),                                    // ← 新增
  ]);
}
```

- [ ] **Step 5：跑全套测试**

```bash
pnpm test
```

预期：所有现有测试 PASS（store 没单测，但其他东西不能被打破）。

- [ ] **Step 6：commit**

```bash
git add src/lib/store.ts
git commit -m "feat(store): tags state with debounced save + 409 merge"
```

---

## Task 5：TagBadge + TagSelect 组件

**Files:**
- Create: `src/components/TagBadge.vue`, `src/components/TagSelect.vue`

- [ ] **Step 1：TagBadge.vue**

```vue
<script setup lang="ts">
import type { Tag } from "@/lib/types";
defineProps<{ tag: Tag | null }>();
</script>

<template>
  <span v-if="tag" class="badge" :style="{ background: tag.color + '20', color: tag.color, borderColor: tag.color + '40' }">
    {{ tag.name }}
  </span>
  <span v-else class="badge muted">未分类</span>
</template>

<style scoped>
.badge {
  display: inline-block; font-size: 11px;
  padding: 1px 8px; border-radius: 10px;
  border: 1px solid var(--border);
  line-height: 1.6;
}
.muted { color: var(--text-faint); background: var(--bg); }
</style>
```

- [ ] **Step 2：TagSelect.vue**

```vue
<script setup lang="ts">
import { useStore } from "@/lib/store";
import TagBadge from "./TagBadge.vue";

const props = defineProps<{ modelValue: string | null }>();
const emit = defineEmits<{ "update:modelValue": [string | null] }>();

const store = useStore();

function pick(id: string | null) { emit("update:modelValue", id); }
</script>

<template>
  <div class="select">
    <button :class="{ active: modelValue === null }" @click="pick(null)">
      <TagBadge :tag="null" />
    </button>
    <button
      v-for="t in store.activeTags()"
      :key="t.id"
      :class="{ active: modelValue === t.id }"
      @click="pick(t.id)"
    >
      <TagBadge :tag="t" />
    </button>
  </div>
</template>

<style scoped>
.select { display: flex; flex-wrap: wrap; gap: 4px; }
.select button {
  padding: 2px; background: transparent; border: 1px solid transparent;
  border-radius: 12px;
}
.select button.active { border-color: var(--accent); background: var(--bg); }
</style>
```

- [ ] **Step 3：commit**

```bash
git add src/components/TagBadge.vue src/components/TagSelect.vue
git commit -m "feat(ui): TagBadge + TagSelect"
```

---

## Task 6：EntryCard 用 tag 颜色

**Files:**
- Modify: `src/components/EntryCard.vue`

- [ ] **Step 1：替换 EntryCard.vue**

```vue
<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "@/lib/store";
import { renderMarkdown } from "@/lib/markdown";
import type { Entry } from "@/lib/types";

const props = defineProps<{ entry: Entry }>();
defineEmits<{ click: [Entry] }>();

const store = useStore();
const tag = computed(() => store.getTagById(props.entry.tagId));
const barColor = computed(() => tag.value?.color ?? "var(--color-default)");
const html = computed(() => renderMarkdown(props.entry.text));
</script>

<template>
  <button class="card" @click="$emit('click', entry)">
    <span class="bar" :style="{ background: barColor }" />
    <span class="time">{{ entry.start }}–{{ entry.end }}</span>
    <span class="text" v-if="entry.text" v-html="html" />
    <span class="text empty" v-else>（空）</span>
  </button>
</template>

<style scoped>
.card {
  display: flex; align-items: stretch; gap: 8px; width: 100%;
  border: 1px solid var(--border); background: var(--bg-elevated);
  border-radius: var(--radius); padding: 6px 10px; text-align: left;
  font: inherit; color: var(--text);
}
.card:hover { border-color: var(--accent); }
.bar { width: 4px; flex-shrink: 0; border-radius: 2px; }
.time { color: var(--text-muted); font-variant-numeric: tabular-nums; min-width: 92px; flex-shrink: 0; }
.text { color: var(--text); flex: 1; overflow: hidden; }
.text :deep(p) { margin: 0; }
.text :deep(a) { color: var(--accent); }
.text.empty { color: var(--text-faint); }
</style>
```

- [ ] **Step 2：commit**（markdown.ts 下个 task 就建，先把 import 写好让下个 task 接上）

```bash
git add src/components/EntryCard.vue
git commit -m "feat(ui): EntryCard uses tag color + markdown render placeholder"
```

> 此时 build 会因 `@/lib/markdown` 不存在而失败——这是预期，下个 task 修。

---

## Task 7：Markdown 渲染（markdown.ts）

**Files:**
- Create: `src/lib/markdown.ts`, `tests/unit/markdown.test.ts`

- [ ] **Step 1：装依赖**

```bash
pnpm add markdown-it
pnpm add -D @types/markdown-it
```

- [ ] **Step 2：写测试**

`tests/unit/markdown.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { renderMarkdown } from "@/lib/markdown";

describe("renderMarkdown", () => {
  it("renders basic markdown", () => {
    expect(renderMarkdown("**bold**")).toContain("<strong>bold</strong>");
  });

  it("renders links", () => {
    const html = renderMarkdown("[x](https://example.com)");
    expect(html).toContain('href="https://example.com"');
  });

  it("strips raw HTML", () => {
    const html = renderMarkdown('<script>alert(1)</script>hello');
    expect(html).not.toContain("<script");
    expect(html).toContain("hello");
  });

  it("escapes javascript: links", () => {
    const html = renderMarkdown("[x](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
  });

  it("returns empty string on empty input", () => {
    expect(renderMarkdown("")).toBe("");
  });
});
```

- [ ] **Step 3：FAIL → 实现 markdown.ts**

```ts
import MarkdownIt from "markdown-it";

const md = new MarkdownIt({
  html: false,        // 禁 raw HTML
  linkify: true,
  breaks: true,
  typographer: false,
});

// 强制外链 target=_blank rel=noopener；阻止 javascript: 协议
const defaultLinkOpen = md.renderer.rules.link_open ??
  ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts));
md.renderer.rules.link_open = (tokens, idx, opts, env, self) => {
  const t = tokens[idx];
  const hrefIdx = t.attrIndex("href");
  if (hrefIdx >= 0) {
    const href = t.attrs![hrefIdx]![1].toLowerCase().trim();
    if (href.startsWith("javascript:") || href.startsWith("data:") || href.startsWith("vbscript:")) {
      t.attrs![hrefIdx]![1] = "#";
    }
  }
  t.attrSet("target", "_blank");
  t.attrSet("rel", "noopener noreferrer");
  return defaultLinkOpen(tokens, idx, opts, env, self);
};

export function renderMarkdown(text: string): string {
  if (!text) return "";
  return md.render(text);
}
```

- [ ] **Step 4：跑测试**

```bash
pnpm test tests/unit/markdown.test.ts
pnpm build         # 现在应能编过
```

预期：5 个 PASS；build 成功。

- [ ] **Step 5：commit**

```bash
git add src/lib/markdown.ts tests/unit/markdown.test.ts package.json pnpm-lock.yaml
git commit -m "feat(lib): safe markdown rendering with markdown-it"
```

---

## Task 8：EntryEditor 加 TagSelect + 实时预览

**Files:**
- Modify: `src/components/EntryEditor.vue`, `tests/component/EntryEditor.test.ts`

- [ ] **Step 1：扩展 EntryEditor.vue**

```vue
<script setup lang="ts">
import { ref, computed, watch } from "vue";
import type { Entry } from "@/lib/types";
import { isValidTime, compareTimes } from "@/lib/date";
import { renderMarkdown } from "@/lib/markdown";
import TagSelect from "./TagSelect.vue";

const props = defineProps<{ entry: Entry }>();
const emit = defineEmits<{ save: [Entry]; delete: []; cancel: [] }>();

const start = ref(props.entry.start);
const end = ref(props.entry.end);
const text = ref(props.entry.text);
const tagId = ref<string | null>(props.entry.tagId);
const showPreview = ref(false);

watch(() => props.entry, (e) => {
  start.value = e.start; end.value = e.end; text.value = e.text; tagId.value = e.tagId;
});

const valid = computed(() =>
  isValidTime(start.value) && isValidTime(end.value) && compareTimes(start.value, end.value) <= 0,
);

const previewHtml = computed(() => renderMarkdown(text.value));

function save() {
  if (!valid.value) return;
  emit("save", {
    ...props.entry,
    start: start.value, end: end.value, text: text.value, tagId: tagId.value,
    updatedAt: new Date().toISOString(),
  });
}
</script>

<template>
  <div class="editor">
    <div class="row">
      <input v-model="start" placeholder="HH:MM" />
      <span>–</span>
      <input v-model="end" placeholder="HH:MM" />
    </div>

    <div class="tag-row">
      <span class="label">标签</span>
      <TagSelect v-model="tagId" />
    </div>

    <div class="text-area">
      <textarea v-model="text" rows="6" placeholder="支持 **markdown** 和 [链接](https://...)" />
      <button class="preview-toggle" type="button" @click="showPreview = !showPreview">
        {{ showPreview ? "✎ 编辑" : "👁 预览" }}
      </button>
      <div v-if="showPreview && text" class="preview" v-html="previewHtml" />
    </div>

    <div class="actions">
      <button data-action="delete" class="danger" @click="$emit('delete')">删除</button>
      <span class="spacer" />
      <button data-action="cancel" @click="$emit('cancel')">取消</button>
      <button data-action="save" class="primary" :disabled="!valid" @click="save">保存</button>
    </div>
  </div>
</template>

<style scoped>
.editor { padding: 16px; min-width: 380px; max-width: 500px; }
.row { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; }
.row input { width: 80px; }
.tag-row { display: flex; gap: 8px; align-items: flex-start; margin-bottom: 12px; }
.label { font-size: 12px; color: var(--text-muted); padding-top: 4px; min-width: 32px; }
.text-area { position: relative; margin-bottom: 12px; }
textarea { width: 100%; resize: vertical; font-family: ui-monospace, "SF Mono", Menlo, monospace; }
.preview-toggle { position: absolute; right: 6px; top: 6px; font-size: 11px; padding: 2px 8px; }
.preview {
  margin-top: 8px; padding: 8px 10px;
  background: var(--bg); border: 1px solid var(--border); border-radius: 4px;
}
.preview :deep(p) { margin: 0 0 .4em 0; }
.preview :deep(a) { color: var(--accent); }
.actions { display: flex; align-items: center; gap: 8px; }
.spacer { flex: 1; }
.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.primary:disabled { opacity: .4; cursor: not-allowed; }
.danger { color: #c0392b; }
</style>
```

- [ ] **Step 2：扩展现有 EntryEditor 测试 + 加新测试**

替换 `tests/component/EntryEditor.test.ts` 全文：

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import EntryEditor from "@/components/EntryEditor.vue";
import { useStore, _resetStore } from "@/lib/store";
import { makeEntry, makeTag } from "../fixtures/month";

beforeEach(() => {
  _resetStore();
  const store = useStore();
  store.state.tags = {
    data: { version: 1, tags: [makeTag({ id: "work" }), makeTag({ id: "rest", name: "休息", color: "#4caf7a" })] },
    sha: null,
  };
});

describe("EntryEditor", () => {
  it("disables save when end < start", () => {
    const w = mount(EntryEditor, {
      props: { entry: makeEntry({ start: "10:00", end: "09:00" }) },
    });
    expect(w.find('button[data-action="save"]').attributes("disabled")).toBeDefined();
  });

  it("emits save with patched text + tagId", async () => {
    const w = mount(EntryEditor, { props: { entry: makeEntry({ id: "a", text: "old", tagId: null }) } });
    await w.find("textarea").setValue("new");
    // pick the "work" tag (1st non-null option)
    const tagButtons = w.findAll(".tag-row button");
    await tagButtons[1].trigger("click");
    await w.find('button[data-action="save"]').trigger("click");
    const e = w.emitted("save")?.[0]?.[0] as any;
    expect(e.text).toBe("new");
    expect(e.tagId).toBe("work");
  });

  it("emits delete on delete click", async () => {
    const w = mount(EntryEditor, { props: { entry: makeEntry({ id: "a" }) } });
    await w.find('button[data-action="delete"]').trigger("click");
    expect(w.emitted("delete")).toBeTruthy();
  });

  it("toggles markdown preview", async () => {
    const w = mount(EntryEditor, { props: { entry: makeEntry({ text: "**bold**" }) } });
    expect(w.find(".preview").exists()).toBe(false);
    await w.find(".preview-toggle").trigger("click");
    expect(w.find(".preview").html()).toContain("<strong>bold</strong>");
  });
});
```

- [ ] **Step 3：跑测试**

```bash
pnpm test tests/component/EntryEditor.test.ts
```

预期：4 个 PASS。

- [ ] **Step 4：commit**

```bash
git add src/components/EntryEditor.vue tests/component/EntryEditor.test.ts
git commit -m "feat(ui): EntryEditor with TagSelect + markdown preview"
```

---

## Task 9：TagSummary（左侧每日时长合计）

**Files:**
- Create: `src/components/TagSummary.vue`

- [ ] **Step 1：实现**

```vue
<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "@/lib/store";
import TagBadge from "./TagBadge.vue";

const store = useStore();

function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

interface Row { tagId: string | null; minutes: number }

const rows = computed<Row[]>(() => {
  const totals = new Map<string | null, number>();
  for (const e of store.entriesForSelectedDate()) {
    totals.set(e.tagId, (totals.get(e.tagId) ?? 0) + minutesBetween(e.start, e.end));
  }
  return [...totals.entries()]
    .map(([tagId, minutes]) => ({ tagId, minutes }))
    .sort((a, b) => b.minutes - a.minutes);
});

function fmt(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
}
</script>

<template>
  <div class="summary">
    <div class="head">今日合计</div>
    <ul v-if="rows.length">
      <li v-for="r in rows" :key="r.tagId ?? 'untagged'">
        <TagBadge :tag="store.getTagById(r.tagId)" />
        <span class="dur">{{ fmt(r.minutes) }}</span>
      </li>
    </ul>
    <p v-else class="empty">还没有 entry</p>
  </div>
</template>

<style scoped>
.summary { padding: 12px; border-top: 1px solid var(--border); }
.head { font-size: 11px; color: var(--text-faint); text-transform: uppercase; letter-spacing: .05em; margin-bottom: 8px; }
ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
li { display: flex; align-items: center; justify-content: space-between; }
.dur { font-variant-numeric: tabular-nums; color: var(--text-muted); font-size: 12px; }
.empty { color: var(--text-faint); font-size: 12px; margin: 0; }
</style>
```

- [ ] **Step 2：commit**

```bash
git add src/components/TagSummary.vue
git commit -m "feat(ui): TagSummary daily aggregation"
```

---

## Task 10：SyncStatusPill + 重试

**Files:**
- Create: `src/components/SyncStatusPill.vue`
- Modify: `src/components/TopBar.vue`, `src/lib/store.ts`

- [ ] **Step 1：在 store.ts 暴露重试入口**

在 store 的 `createStore` 末尾添加 `retryFailed`：

```ts
function retryFailed(): void {
  // 重试 entry 的最近一次 pending（如果有）
  if (sync) {
    // 实际上 SyncEngine 在 throw 后已退出；
    // 简化方案：把当前选中月份重新 schedule 一次
    const m = monthOf(state.selectedDate);
    const doc = state.months[m];
    if (doc) sync.scheduleSave(m, doc);
  }
  // 同时重试 tags
  if (state.tagsSyncStatus.kind === "error") {
    scheduleTagsSave();
  }
}
```

加到 return 块：

```ts
return {
  state,
  bootFromCache, setLoggedIn, logout,
  selectDate, loadMonth,
  entriesForSelectedDate, upsertEntry, deleteEntry, newEntry,
  loadTags, upsertTag, deleteTag, activeTags, getTagById,
  retryFailed,                                  // ← 新增
};
```

- [ ] **Step 2：写 SyncStatusPill.vue**

```vue
<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "@/lib/store";

const store = useStore();

interface View { label: string; kind: "saving" | "saved" | "error" | "idle" }

const view = computed<View>(() => {
  const e = store.state.syncStatus;
  const t = store.state.tagsSyncStatus;
  if (e.kind === "error" || t.kind === "error") {
    return { label: "保存失败 · 点击重试", kind: "error" };
  }
  if (e.kind === "saving" || t.kind === "saving") {
    return { label: "保存中…", kind: "saving" };
  }
  if (e.kind === "saved" || t.kind === "saved") {
    return { label: "已保存", kind: "saved" };
  }
  return { label: "", kind: "idle" };
});

function onClick() {
  if (view.value.kind === "error") store.retryFailed();
}
</script>

<template>
  <button
    v-if="view.kind !== 'idle'"
    class="pill" :class="view.kind"
    :disabled="view.kind !== 'error'"
    @click="onClick"
  >
    <span class="dot" />
    {{ view.label }}
  </button>
</template>

<style scoped>
.pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 2px 8px; font-size: 11px; border-radius: 10px;
  background: var(--bg); border: 1px solid var(--border);
}
.pill .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.pill.saving { color: var(--accent); }
.pill.saved { color: #4caf7a; }
.pill.error { color: #c0392b; cursor: pointer; border-color: #c0392b40; }
.pill.error:hover { background: #c0392b10; }
.pill:disabled { cursor: default; }
</style>
```

- [ ] **Step 3：把 TopBar 里 `sync` 那块替换为 `<SyncStatusPill />`**

修改 `src/components/TopBar.vue`，import 加上：

```ts
import SyncStatusPill from "./SyncStatusPill.vue";
```

把 template 里 `<span class="sync">{{ syncLabel }}</span>` 整行替换为：

```html
<SyncStatusPill />
```

并把 `syncLabel` 计算属性删掉（不再需要）。

- [ ] **Step 4：commit**

```bash
git add src/components/SyncStatusPill.vue src/components/TopBar.vue src/lib/store.ts
git commit -m "feat(ui): SyncStatusPill with retry"
```

---

## Task 11：离线检测（network.ts + UI）

**Files:**
- Create: `src/lib/network.ts`
- Modify: `src/components/SyncStatusPill.vue`

- [ ] **Step 1：写 network.ts**

```ts
import { ref, onMounted, onUnmounted } from "vue";

export function useOnlineStatus() {
  const online = ref(typeof navigator === "undefined" ? true : navigator.onLine);
  const onUp = () => { online.value = true; };
  const onDown = () => { online.value = false; };
  onMounted(() => {
    window.addEventListener("online", onUp);
    window.addEventListener("offline", onDown);
  });
  onUnmounted(() => {
    window.removeEventListener("online", onUp);
    window.removeEventListener("offline", onDown);
  });
  return online;
}
```

- [ ] **Step 2：扩展 SyncStatusPill 优先显示离线**

替换 SyncStatusPill `<script setup>`：

```ts
import { computed } from "vue";
import { useStore } from "@/lib/store";
import { useOnlineStatus } from "@/lib/network";

const store = useStore();
const online = useOnlineStatus();

interface View { label: string; kind: "saving" | "saved" | "error" | "offline" | "idle" }

const view = computed<View>(() => {
  if (!online.value) return { label: "离线", kind: "offline" };
  const e = store.state.syncStatus;
  const t = store.state.tagsSyncStatus;
  if (e.kind === "error" || t.kind === "error") {
    return { label: "保存失败 · 点击重试", kind: "error" };
  }
  if (e.kind === "saving" || t.kind === "saving") {
    return { label: "保存中…", kind: "saving" };
  }
  if (e.kind === "saved" || t.kind === "saved") {
    return { label: "已保存", kind: "saved" };
  }
  return { label: "", kind: "idle" };
});

function onClick() {
  if (view.value.kind === "error") store.retryFailed();
}
```

CSS 末尾追加：

```css
.pill.offline { color: #d97706; border-color: #d9770640; background: #fff7ed; }
```

- [ ] **Step 3：online 恢复时自动重试一次**

在 `network.ts` 末尾追加：

```ts
type Listener = () => void;
const onlineListeners: Listener[] = [];

export function onReconnect(fn: Listener): void {
  onlineListeners.push(fn);
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    for (const fn of onlineListeners) fn();
  });
}
```

在 `store.ts` 顶部 import：

```ts
import { onReconnect } from "./network";
```

在 `createStore` 末尾接入（return 之前）：

```ts
onReconnect(() => {
  if (state.syncStatus.kind === "error" || state.tagsSyncStatus.kind === "error") {
    retryFailed();
  }
});
```

- [ ] **Step 4：commit**

```bash
git add src/lib/network.ts src/components/SyncStatusPill.vue src/lib/store.ts
git commit -m "feat: offline indicator + auto-retry on reconnect"
```

---

## Task 12：QuickAdd 优化（自定义时段）

**Files:**
- Modify: `src/components/QuickAdd.vue`, `tests/component/QuickAdd.test.ts`, `src/App.vue`

- [ ] **Step 1：扩展测试**

替换 `tests/component/QuickAdd.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import QuickAdd from "@/components/QuickAdd.vue";

describe("QuickAdd", () => {
  it("emits 'add' with default 1h slot from clicked hour", async () => {
    const w = mount(QuickAdd, { props: { hour: 14 } });
    await w.find('[data-action="quick"]').trigger("click");
    const arg = w.emitted("add")?.[0]?.[0] as any;
    expect(arg).toEqual({ start: "14:00", end: "15:00" });
  });

  it("opens picker on 'custom' button and emits chosen times", async () => {
    const w = mount(QuickAdd, { props: { hour: 14 } });
    await w.find('[data-action="custom"]').trigger("click");
    const inputs = w.findAll('input[type="time"]');
    await inputs[0].setValue("14:15");
    await inputs[1].setValue("14:50");
    await w.find('[data-action="confirm"]').trigger("click");
    const arg = w.emitted("add")?.[0]?.[0] as any;
    expect(arg).toEqual({ start: "14:15", end: "14:50" });
  });
});
```

- [ ] **Step 2：FAIL → 实现**

```vue
<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{ hour: number }>();
const emit = defineEmits<{ add: [{ start: string; end: string }] }>();

const showCustom = ref(false);
const customStart = ref("");
const customEnd = ref("");

function pad(n: number): string { return String(n).padStart(2, "0"); }

function quickAdd() {
  const start = `${pad(props.hour)}:00`;
  const end = props.hour === 23 ? "23:59" : `${pad(props.hour + 1)}:00`;
  emit("add", { start, end });
}

function openCustom() {
  customStart.value = `${pad(props.hour)}:00`;
  customEnd.value = props.hour === 23 ? "23:59" : `${pad(props.hour + 1)}:00`;
  showCustom.value = true;
}

function confirm() {
  emit("add", { start: customStart.value, end: customEnd.value });
  showCustom.value = false;
}
</script>

<template>
  <div class="qa">
    <button data-action="quick" class="add-btn" @click.stop="quickAdd" aria-label="快速添加 1 小时">+</button>
    <button data-action="custom" class="add-btn alt" @click.stop="openCustom" aria-label="自定义时段">⋯</button>

    <div v-if="showCustom" class="popover" @click.stop>
      <input type="time" v-model="customStart" />
      <span>–</span>
      <input type="time" v-model="customEnd" />
      <button data-action="confirm" @click="confirm">添加</button>
    </div>
  </div>
</template>

<style scoped>
.qa { position: absolute; right: 6px; top: 6px; display: flex; gap: 2px; }
.add-btn {
  width: 22px; height: 22px; padding: 0; border-radius: 50%;
  border: 1px dashed var(--border-strong); background: transparent; color: var(--text-muted);
  opacity: 0; transition: opacity .15s;
}
.hour-cell:hover .add-btn { opacity: 1; }
.add-btn:hover { color: var(--accent); border-color: var(--accent); }
.popover {
  position: absolute; top: 28px; right: 0; z-index: 10;
  display: flex; gap: 4px; align-items: center;
  background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 6px; box-shadow: var(--shadow-sm);
}
</style>
```

- [ ] **Step 3：跑测试**

```bash
pnpm test tests/component/QuickAdd.test.ts
```

预期：2 个 PASS。

- [ ] **Step 4：commit**

```bash
git add src/components/QuickAdd.vue tests/component/QuickAdd.test.ts
git commit -m "feat(ui): QuickAdd with custom time picker"
```

---

## Task 13：SettingsPanel（标签管理）

**Files:**
- Create: `src/components/SettingsPanel.vue`
- Modify: `src/components/TopBar.vue`, `src/App.vue`

- [ ] **Step 1：写 SettingsPanel.vue**

```vue
<script setup lang="ts">
import { ref } from "vue";
import { useStore } from "@/lib/store";
import TagBadge from "./TagBadge.vue";
import type { Tag } from "@/lib/types";

defineEmits<{ close: [] }>();
const store = useStore();

const newId = ref("");
const newName = ref("");
const newColor = ref("#5a8dee");

function addTag() {
  const id = newId.value.trim().toLowerCase();
  if (!id || !/^[a-z0-9_-]+$/.test(id)) { alert("ID 只能含 a-z 0-9 _ -"); return; }
  if (store.state.tags.data.tags.some((t) => t.id === id && t.deletedAt === null)) {
    alert("ID 已存在"); return;
  }
  const now = new Date().toISOString();
  const t: Tag = {
    id, name: newName.value.trim() || id, color: newColor.value,
    updatedAt: now, deletedAt: null,
  };
  store.upsertTag(t);
  newId.value = ""; newName.value = "";
}

function rename(t: Tag, name: string) {
  store.upsertTag({ ...t, name, updatedAt: new Date().toISOString() });
}
function recolor(t: Tag, color: string) {
  store.upsertTag({ ...t, color, updatedAt: new Date().toISOString() });
}
function remove(t: Tag) {
  if (confirm(`删除标签 "${t.name}"？已使用此标签的 entry 会变成未分类。`)) {
    store.deleteTag(t.id);
  }
}
function logout() {
  if (confirm("退出登录？本设备将清除 token。")) store.logout();
}
</script>

<template>
  <div class="settings">
    <header>
      <h2>设置</h2>
      <button @click="$emit('close')">关闭</button>
    </header>

    <section>
      <h3>标签</h3>
      <table>
        <tbody>
          <tr v-for="t in store.activeTags()" :key="t.id">
            <td><input type="color" :value="t.color" @change="recolor(t, ($event.target as HTMLInputElement).value)" /></td>
            <td><code>{{ t.id }}</code></td>
            <td><input :value="t.name" @change="rename(t, ($event.target as HTMLInputElement).value)" /></td>
            <td><TagBadge :tag="t" /></td>
            <td><button class="danger" @click="remove(t)">删除</button></td>
          </tr>
        </tbody>
      </table>

      <div class="add-row">
        <input type="color" v-model="newColor" />
        <input v-model="newId" placeholder="id (work)" maxlength="20" />
        <input v-model="newName" placeholder="名字 (工作)" maxlength="30" />
        <button class="primary" @click="addTag">新建</button>
      </div>
    </section>

    <section>
      <h3>账号</h3>
      <p v-if="store.state.auth.kind === 'logged-in'" class="muted">@{{ store.state.auth.user.login }}</p>
      <button class="danger" @click="logout">退出登录</button>
    </section>
  </div>
</template>

<style scoped>
.settings { padding: 16px; min-width: 480px; max-width: 640px; }
header { display: flex; align-items: center; justify-content: space-between; }
section { margin-top: 16px; }
table { width: 100%; border-collapse: collapse; }
td { padding: 4px; vertical-align: middle; }
.add-row { display: flex; gap: 8px; align-items: center; margin-top: 12px; }
.add-row input[type=color] { width: 32px; height: 32px; padding: 2px; }
.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.danger { color: #c0392b; }
.muted { color: var(--text-muted); }
</style>
```

- [ ] **Step 2：在 TopBar 里加齿轮按钮**

修改 `src/components/TopBar.vue`，在 `.right` 内加：

```html
<button class="icon" @click="$emit('open-settings')" aria-label="设置">⚙</button>
```

加 `defineEmits`：

```ts
defineEmits<{ "open-settings": [] }>();
```

CSS 末尾追加：

```css
.icon { padding: 4px 8px; }
```

- [ ] **Step 3：在 App.vue 里挂 settings modal + 把 TagSummary 加进左栏**

修改 `src/App.vue`：

```vue
<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useStore } from "@/lib/store";
import TopBar from "@/components/TopBar.vue";
import MiniCalendar from "@/components/MiniCalendar.vue";
import TagSummary from "@/components/TagSummary.vue";
import Timeline from "@/components/Timeline.vue";
import EntryEditor from "@/components/EntryEditor.vue";
import SettingsPanel from "@/components/SettingsPanel.vue";
import LoginPanel from "@/components/LoginPanel.vue";
import OnboardingPanel from "@/components/OnboardingPanel.vue";
import type { Entry } from "@/lib/types";

const store = useStore();
const editing = ref<Entry | null>(null);
const settingsOpen = ref(false);

onMounted(() => store.bootFromCache());

const view = computed(() => {
  if (store.state.auth.kind === "anonymous") return "login";
  if (store.state.repo.kind === "missing") return "onboard";
  return "main";
});

function openEditor(e: Entry) { editing.value = e; }
function closeEditor() { editing.value = null; }
function newEntryAt(start: string, end: string) { editing.value = store.newEntry(start, end); }
function onSave(e: Entry) { store.upsertEntry(e); editing.value = null; }
function onDelete() { if (editing.value) store.deleteEntry(editing.value.id); editing.value = null; }
</script>

<template>
  <LoginPanel v-if="view === 'login'" />
  <OnboardingPanel v-else-if="view === 'onboard'" />
  <div v-else class="layout">
    <TopBar @open-settings="settingsOpen = true" />
    <aside class="side">
      <MiniCalendar />
      <TagSummary />
      <div class="quick">
        <button @click="newEntryAt('09:00','10:00')">+ 新增条目</button>
      </div>
    </aside>
    <main class="main">
      <Timeline @click-entry="openEditor" />
    </main>

    <div v-if="editing" class="modal-bg" @click.self="closeEditor">
      <div class="modal">
        <EntryEditor :entry="editing" @save="onSave" @delete="onDelete" @cancel="closeEditor" />
      </div>
    </div>

    <div v-if="settingsOpen" class="modal-bg" @click.self="settingsOpen = false">
      <div class="modal">
        <SettingsPanel @close="settingsOpen = false" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.layout { display: grid; grid-template-rows: auto 1fr; grid-template-columns: 280px 1fr; height: 100vh; }
.layout > :deep(header) { grid-column: 1 / 3; }
.side { border-right: 1px solid var(--border); background: var(--bg-elevated); overflow-y: auto; }
.main { overflow-y: auto; }
.quick { padding: 12px; border-top: 1px solid var(--border); }
.modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,.3); display: grid; place-items: center; z-index: 100; }
.modal { background: var(--bg-elevated); border-radius: var(--radius); box-shadow: 0 10px 30px rgba(0,0,0,.2); max-height: 90vh; overflow: auto; }

@media (max-width: 720px) {
  .layout { grid-template-columns: 1fr; }
  .side { display: none; }
}
</style>
```

- [ ] **Step 4：commit**

```bash
git add src/components/SettingsPanel.vue src/components/TopBar.vue src/App.vue
git commit -m "feat(ui): SettingsPanel with tag management + sidebar TagSummary"
```

---

## Task 14：标签 e2e

**Files:**
- Create: `tests/e2e/tags.spec.ts`

- [ ] **Step 1：写 e2e**

```ts
import { test, expect } from "@playwright/test";
import { mockGitHub } from "./_mocks";

test("create tag → assign to entry → see colored bar", async ({ page }) => {
  await mockGitHub(page);
  // 添加 tags.json 路由
  let tagsData: any = { version: 1, tags: [] };
  await page.route(/contents\/tags\.json/, async (route) => {
    if (route.request().method() === "GET") {
      route.fulfill({ contentType: "application/json", body: JSON.stringify({
        sha: "tagsha", encoding: "base64", content: btoa(JSON.stringify(tagsData)),
      })});
    } else {
      tagsData = JSON.parse(atob(JSON.parse(route.request().postData()!).content));
      route.fulfill({ contentType: "application/json", body: JSON.stringify({ content: { sha: "newtagsha" } })});
    }
  });

  await page.goto("/");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.locator(".timeline")).toBeVisible();

  // 打开设置创建标签
  await page.getByRole("button", { name: "设置" }).click();
  await page.locator('input[placeholder*="id"]').fill("work");
  await page.locator('input[placeholder*="名字"]').fill("工作");
  await page.getByRole("button", { name: "新建" }).click();
  await page.getByRole("button", { name: "关闭" }).click();

  // 等待 tags 保存
  await expect(page.getByText("已保存")).toBeVisible({ timeout: 5000 });

  // 创建 entry 并选 work 标签
  await page.getByRole("button", { name: /\+ 新增条目/ }).click();
  await page.locator("textarea").fill("写代码");
  // 在 EntryEditor 的 TagSelect 里点 "工作"
  await page.locator('.tag-row button:has-text("工作")').click();
  await page.getByRole("button", { name: "保存" }).click();

  // 验证 EntryCard 的 .bar 颜色 = #5a8dee
  await expect(page.locator(".timeline .bar").first()).toHaveCSS("background-color", "rgb(90, 141, 238)");
});
```

- [ ] **Step 2：跑**

```bash
pnpm test:e2e tests/e2e/tags.spec.ts
```

预期：PASS。

- [ ] **Step 3：commit**

```bash
git add tests/e2e/tags.spec.ts
git commit -m "test(e2e): tag create + assign + color"
```

---

## Task 15：离线 e2e

**Files:**
- Create: `tests/e2e/offline.spec.ts`

- [ ] **Step 1：实现**

```ts
import { test, expect } from "@playwright/test";
import { mockGitHub } from "./_mocks";

test("offline → make change → reconnect → auto-retry", async ({ page, context }) => {
  await mockGitHub(page);
  await page.goto("/");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.locator(".timeline")).toBeVisible();

  // 切到离线
  await context.setOffline(true);
  // 由于浏览器会自然 dispatch offline 事件
  await expect(page.locator(".pill.offline")).toBeVisible({ timeout: 3000 });

  // 离线状态下尝试新增（不会真 PUT）
  await page.getByRole("button", { name: /\+ 新增条目/ }).click();
  await page.locator("textarea").fill("offline 时写的");
  await page.getByRole("button", { name: "保存" }).click();
  // entry 应在 UI 上立即显示（乐观更新）
  await expect(page.getByText("offline 时写的")).toBeVisible();

  // 回线
  await context.setOffline(false);
  // pill 应回到 saving / saved
  await expect(page.locator(".pill.saved")).toBeVisible({ timeout: 8000 });
});
```

- [ ] **Step 2：跑**

```bash
pnpm test:e2e tests/e2e/offline.spec.ts
```

> 这个测试对 mock + reactive timing 比较敏感，如果不稳，标 `test.skip` 并在 PR 描述里说明，把根因留给 Plan 3 修。

- [ ] **Step 3：commit**

```bash
git add tests/e2e/offline.spec.ts
git commit -m "test(e2e): offline indicator + reconnect retry"
```

---

## Task 16：收尾验证

- [ ] **Step 1：跑全套**

```bash
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```

预期：单测 ≥ 50 个 PASS（Plan 1 31 + Plan 2 ~19）；e2e 5 个 PASS（Plan 1 3 + Plan 2 2）；build 成功。

- [ ] **Step 2：手动 smoke**

启动 dev、登录、完成下面动作，每步都应行为正确：

1. 设置里建 3 个标签：工作 / 阅读 / 休息（不同颜色）
2. 写 6 条不同标签的 entry，看 EntryCard 色条是否对应
3. 看左栏 TagSummary 时长是否对
4. 打开设置改一个标签的颜色，关闭设置看色条是否实时更新
5. 删除一个标签，看 entry 上的色条变成默认灰
6. 在 entry 文本里写 `**粗体**` 和 `[链接](https://...)`，预览面板渲染对、卡片上也渲染对
7. 离线开浏览器（DevTools → Network → Offline），看 pill 显示离线
8. 离线状态下改 entry，回线后看 pill 自动从离线 → 保存中 → 已保存

- [ ] **Step 3：final commit（如有 polish）**

```bash
git push origin main
```

---

## Plan 2 完工标准

- [ ] 单测 ≥ 50 PASS（merge 11 + auth 3 + github 8 + idb 4 + sync 3 + date 6 + id 2 + types 1 + markdown 5 ≈ 43 + 余量）
- [ ] 组件测试 PASS（Timeline 3 + EntryEditor 4 + QuickAdd 2 = 9）
- [ ] e2e PASS（login + write + conflict + tags + offline = 5）
- [ ] 标签可建/改/删/选；删后已使用此标签的 entry 显示未分类
- [ ] 卡片色条按 tag.color 着色
- [ ] entry 文本支持基础 Markdown（粗体、斜体、链接、列表）
- [ ] 离线时 pill 显示离线，回线自动重试
- [ ] 保存失败时 pill 可点重试

---

## 留给 Plan 3

- 全局搜索（关键字 + 标签 + 时间范围）
- 周/月统计柱图
- md / json 导出
- 历史月份按需预取（点击日历跨月时预加载）
