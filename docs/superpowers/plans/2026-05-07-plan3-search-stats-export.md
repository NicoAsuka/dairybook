# dairybook Plan 3：搜索 & 统计 & 导出 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**前置：** Plan 1 + Plan 2 全部完成且能用（带 tags、Markdown、离线指示）。

**Goal:** 在 dairybook 上加上全局搜索（关键字 + 标签 + 时间范围）、周/月统计柱图、md/json 导出，三件事完成后整个 spec 闭环。

**Architecture:** 全部在客户端实现：搜索是按需把月份文件 load 到 `state.months` 里再 in-memory grep；统计同样基于已加载的月数据聚合；导出把 `state.months` + `state.tags` 序列化成 JSON / 渲染成 Markdown 后用 `Blob` + `a.click()` 下载。无新增后端依赖、无新依赖库（自己画 SVG 柱图）。

**Tech Stack:** 沿用 Plan 1+2，无新依赖。

---

## 文件结构变化

```
dairybook/
├── src/
│   ├── lib/
│   │   ├── search.ts        # ✨ 新：filter entries by keyword + tag + range
│   │   ├── stats.ts         # ✨ 新：aggregate minutes by tag over range
│   │   ├── export.ts        # ✨ 新：build md / json blob
│   │   └── store.ts         # 🔧 prefetchMonths(range)
│   ├── components/
│   │   ├── SearchPanel.vue  # ✨ 新：右侧抽屉
│   │   ├── StatsModal.vue   # ✨ 新：周/月柱图
│   │   ├── BarChart.vue     # ✨ 新：纯 SVG 堆叠柱图
│   │   ├── SettingsPanel.vue # 🔧 加导出按钮
│   │   ├── TopBar.vue       # 🔧 加搜索 + 统计入口
│   │   └── App.vue          # 🔧 挂载 SearchPanel + StatsModal
└── tests/
    ├── unit/
    │   ├── search.test.ts
    │   ├── stats.test.ts
    │   └── export.test.ts
    └── e2e/
        ├── search.spec.ts
        ├── stats.spec.ts
        └── export.spec.ts
```

---

## Task 1：search.ts

纯函数：入参 `MonthDoc[] + filter`，出参 `SearchHit[]`。store 不参与，方便测试。

**Files:**
- Create: `src/lib/search.ts`, `tests/unit/search.test.ts`

- [ ] **Step 1：写测试**

```ts
import { describe, expect, it } from "vitest";
import { searchEntries } from "@/lib/search";
import { makeEntry, makeMonth } from "../fixtures/month";

const may = makeMonth("2026-05", {
  "2026-05-07": { entries: [
    makeEntry({ id: "a", text: "晨读人间词话", tagId: "read", start: "09:00", end: "10:00" }),
    makeEntry({ id: "b", text: "写代码 dairybook", tagId: "work", start: "10:00", end: "12:00" }),
  ]},
  "2026-05-08": { entries: [
    makeEntry({ id: "c", text: "煮咖啡", tagId: "rest", start: "08:00", end: "08:30" }),
  ]},
});

const months = [{ data: may, sha: "x" }];

describe("searchEntries", () => {
  it("matches by keyword (case-insensitive substring on text)", () => {
    const hits = searchEntries(months, { keyword: "代码" });
    expect(hits.map((h) => h.entry.id)).toEqual(["b"]);
  });

  it("filters by tagId", () => {
    const hits = searchEntries(months, { tagIds: ["read"] });
    expect(hits.map((h) => h.entry.id)).toEqual(["a"]);
  });

  it("filters by tagId = null (untagged)", () => {
    const m2 = makeMonth("2026-05", {
      "2026-05-07": { entries: [makeEntry({ id: "u", tagId: null })] },
    });
    const hits = searchEntries([{ data: m2, sha: "y" }], { tagIds: [null] });
    expect(hits.map((h) => h.entry.id)).toEqual(["u"]);
  });

  it("filters by date range (inclusive)", () => {
    const hits = searchEntries(months, { from: "2026-05-08", to: "2026-05-08" });
    expect(hits.map((h) => h.entry.id)).toEqual(["c"]);
  });

  it("combines filters with AND", () => {
    const hits = searchEntries(months, { keyword: "咖啡", tagIds: ["rest"] });
    expect(hits).toHaveLength(1);
    expect(hits[0].entry.id).toBe("c");
  });

  it("returns hits sorted by date desc, then start asc", () => {
    const hits = searchEntries(months, {});
    expect(hits.map((h) => `${h.date} ${h.entry.start}`)).toEqual([
      "2026-05-08 08:00",
      "2026-05-07 09:00",
      "2026-05-07 10:00",
    ]);
  });
});
```

- [ ] **Step 2：实现**

```ts
import type { Entry, MonthDoc } from "./types";

export interface SearchFilter {
  keyword?: string;
  tagIds?: (string | null)[];   // 用 [null] 搜未分类
  from?: string;                // YYYY-MM-DD
  to?: string;                  // YYYY-MM-DD inclusive
}

export interface SearchHit {
  date: string;                 // YYYY-MM-DD
  entry: Entry;
}

export function searchEntries(months: MonthDoc[], filter: SearchFilter): SearchHit[] {
  const kw = filter.keyword?.trim().toLowerCase() ?? "";
  const tagSet = filter.tagIds ? new Set<string | null>(filter.tagIds) : null;
  const hits: SearchHit[] = [];

  for (const doc of months) {
    for (const [date, day] of Object.entries(doc.data.days)) {
      if (filter.from && date < filter.from) continue;
      if (filter.to && date > filter.to) continue;
      for (const e of day.entries) {
        if (kw && !e.text.toLowerCase().includes(kw)) continue;
        if (tagSet && !tagSet.has(e.tagId)) continue;
        hits.push({ date, entry: e });
      }
    }
  }

  hits.sort((a, b) =>
    a.date === b.date
      ? a.entry.start.localeCompare(b.entry.start)
      : b.date.localeCompare(a.date),    // newer date first
  );
  return hits;
}
```

- [ ] **Step 3：跑**

```bash
pnpm test tests/unit/search.test.ts
```

预期：6 个 PASS。

- [ ] **Step 4：commit**

```bash
git add src/lib/search.ts tests/unit/search.test.ts
git commit -m "feat(lib): client-side search by keyword/tag/range"
```

---

## Task 2：stats.ts

**Files:**
- Create: `src/lib/stats.ts`, `tests/unit/stats.test.ts`

- [ ] **Step 1：写测试**

```ts
import { describe, expect, it } from "vitest";
import { aggregateByTag, aggregateDailyByTag } from "@/lib/stats";
import { makeEntry, makeMonth } from "../fixtures/month";

const month = makeMonth("2026-05", {
  "2026-05-07": { entries: [
    makeEntry({ id: "a", tagId: "work", start: "09:00", end: "10:30" }),  // 90m
    makeEntry({ id: "b", tagId: "read", start: "10:30", end: "11:00" }),  // 30m
  ]},
  "2026-05-08": { entries: [
    makeEntry({ id: "c", tagId: "work", start: "13:00", end: "15:00" }),  // 120m
    makeEntry({ id: "d", tagId: null,   start: "20:00", end: "20:15" }),  // 15m untagged
  ]},
});

describe("aggregateByTag", () => {
  it("sums minutes by tagId across range", () => {
    const result = aggregateByTag([{ data: month, sha: "x" }], "2026-05-07", "2026-05-08");
    expect(result).toEqual([
      { tagId: "work", minutes: 210 },
      { tagId: "read", minutes: 30 },
      { tagId: null,   minutes: 15 },
    ]);
  });

  it("respects the date range", () => {
    const result = aggregateByTag([{ data: month, sha: "x" }], "2026-05-08", "2026-05-08");
    expect(result.find((r) => r.tagId === "work")?.minutes).toBe(120);
    expect(result.find((r) => r.tagId === "read")).toBeUndefined();
  });
});

describe("aggregateDailyByTag", () => {
  it("returns 7-day series for a week", () => {
    const days = aggregateDailyByTag([{ data: month, sha: "x" }], "2026-05-04", "2026-05-10");
    expect(days).toHaveLength(7);
    expect(days[0].date).toBe("2026-05-04");
    expect(days[3].byTag.find((t) => t.tagId === "work")?.minutes).toBe(90);
    expect(days[4].byTag.find((t) => t.tagId === "work")?.minutes).toBe(120);
  });
});
```

- [ ] **Step 2：实现**

```ts
import type { MonthDoc } from "./types";
import { addDays, formatYMD, parseYMD } from "./date";

function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
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
```

- [ ] **Step 3：跑**

```bash
pnpm test tests/unit/stats.test.ts
```

预期：3 个 PASS。

- [ ] **Step 4：commit**

```bash
git add src/lib/stats.ts tests/unit/stats.test.ts
git commit -m "feat(lib): tag time aggregation"
```

---

## Task 3：export.ts

**Files:**
- Create: `src/lib/export.ts`, `tests/unit/export.test.ts`

- [ ] **Step 1：写测试**

```ts
import { describe, expect, it } from "vitest";
import { buildJsonExport, buildMarkdownExport } from "@/lib/export";
import { makeEntry, makeMonth, makeTag, makeTagsData } from "../fixtures/month";

const months = [
  { data: makeMonth("2026-05", {
    "2026-05-07": { entries: [
      makeEntry({ id: "a", text: "晨读 **人间词话**", tagId: "read", start: "09:00", end: "10:00" }),
      makeEntry({ id: "b", text: "写代码", tagId: null,   start: "10:00", end: "11:00" }),
    ]},
  }), sha: "x" },
];
const tags = makeTagsData([makeTag({ id: "read", name: "阅读", color: "#ef9a3c" })]);

describe("buildJsonExport", () => {
  it("returns valid JSON with months + tags", () => {
    const blob = buildJsonExport(months, tags);
    expect(blob.type).toBe("application/json");
    // can't read blob directly in jsdom easily; test the underlying string
  });
});

describe("buildMarkdownExport", () => {
  it("produces month/day headings + entries with time + tag", () => {
    const md = buildMarkdownExport(months, tags);
    expect(md).toContain("# 2026-05");
    expect(md).toContain("## 2026-05-07");
    expect(md).toContain("- **09:00–10:00** [阅读] 晨读 **人间词话**");
    expect(md).toContain("- **10:00–11:00** 写代码");  // untagged
  });
});
```

- [ ] **Step 2：实现**

```ts
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
```

- [ ] **Step 3：跑**

```bash
pnpm test tests/unit/export.test.ts
```

预期：2 个 PASS。

- [ ] **Step 4：commit**

```bash
git add src/lib/export.ts tests/unit/export.test.ts
git commit -m "feat(lib): md + json export"
```

---

## Task 4：store.prefetchMonths

**Files:**
- Modify: `src/lib/store.ts`

- [ ] **Step 1：在 store 加 prefetchMonths**

在 `createStore` 内的合适位置（`loadMonth` 旁）加：

```ts
async function prefetchMonths(from: string, to: string): Promise<void> {
  if (!client) return;
  const ymStart = from.slice(0, 7);
  const ymEnd = to.slice(0, 7);
  const months = monthsBetween(ymStart, ymEnd);
  await Promise.all(months.map(async (m) => {
    if (state.months[m]) return;
    await loadMonth(m);
  }));
}

function monthsBetween(start: string, end: string): string[] {
  const out: string[] = [];
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}
```

加到 return 块：

```ts
return {
  state,
  bootFromCache, setLoggedIn, logout,
  selectDate, loadMonth, prefetchMonths,        // ← 新增
  entriesForSelectedDate, upsertEntry, deleteEntry, newEntry,
  loadTags, upsertTag, deleteTag, activeTags, getTagById,
  retryFailed,
};
```

- [ ] **Step 2：跑全套确认无破坏**

```bash
pnpm test
```

预期：所有现有测试 PASS。

- [ ] **Step 3：commit**

```bash
git add src/lib/store.ts
git commit -m "feat(store): prefetchMonths(from, to)"
```

---

## Task 5：SearchPanel.vue（抽屉式搜索）

**Files:**
- Create: `src/components/SearchPanel.vue`

- [ ] **Step 1：实现**

```vue
<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useStore } from "@/lib/store";
import { searchEntries, type SearchFilter } from "@/lib/search";
import { addDays, formatYMD, parseYMD } from "@/lib/date";
import TagBadge from "./TagBadge.vue";
import { renderMarkdown } from "@/lib/markdown";

const emit = defineEmits<{ close: []; jump: [string] }>();
const store = useStore();

const keyword = ref("");
const selectedTagIds = ref<(string | null)[]>([]);
const today = formatYMD(new Date());
const from = ref(formatYMD(addDays(parseYMD(today), -30)));
const to = ref(today);
const loading = ref(false);

watch([from, to], async ([f, t]) => {
  loading.value = true;
  try { await store.prefetchMonths(f, t); }
  finally { loading.value = false; }
}, { immediate: true });

const filter = computed<SearchFilter>(() => ({
  keyword: keyword.value || undefined,
  tagIds: selectedTagIds.value.length ? selectedTagIds.value : undefined,
  from: from.value,
  to: to.value,
}));

const monthsArray = computed(() => Object.values(store.state.months));
const hits = computed(() => searchEntries(monthsArray.value, filter.value));

function toggleTag(id: string | null) {
  const i = selectedTagIds.value.indexOf(id);
  if (i >= 0) selectedTagIds.value.splice(i, 1);
  else selectedTagIds.value.push(id);
}

function jumpTo(date: string) {
  emit("jump", date);
  emit("close");
}
</script>

<template>
  <aside class="drawer" @click.self="$emit('close')">
    <div class="panel">
      <header>
        <h2>搜索</h2>
        <button @click="$emit('close')">关闭</button>
      </header>

      <div class="row">
        <input v-model="keyword" placeholder="关键字…" autofocus />
      </div>

      <div class="row range">
        <input type="date" v-model="from" />
        <span>到</span>
        <input type="date" v-model="to" />
        <span v-if="loading" class="muted">加载月份…</span>
      </div>

      <div class="row tags">
        <button :class="{ on: selectedTagIds.includes(null) }" @click="toggleTag(null)">
          <TagBadge :tag="null" />
        </button>
        <button
          v-for="t in store.activeTags()" :key="t.id"
          :class="{ on: selectedTagIds.includes(t.id) }"
          @click="toggleTag(t.id)"
        >
          <TagBadge :tag="t" />
        </button>
      </div>

      <div class="results">
        <p v-if="!hits.length" class="muted">无匹配。</p>
        <button v-for="h in hits" :key="h.entry.id" class="hit" @click="jumpTo(h.date)">
          <span class="hit-date">{{ h.date }}</span>
          <span class="hit-time">{{ h.entry.start }}–{{ h.entry.end }}</span>
          <TagBadge :tag="store.getTagById(h.entry.tagId)" />
          <span class="hit-text" v-html="renderMarkdown(h.entry.text)" />
        </button>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.drawer { position: fixed; inset: 0; background: rgba(0,0,0,.3); display: flex; justify-content: flex-end; z-index: 90; }
.panel { width: min(560px, 100%); background: var(--bg-elevated); padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
header { display: flex; align-items: center; justify-content: space-between; }
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.row.range input[type=date] { padding: 4px 6px; }
.row.tags button { background: transparent; border: 1px solid transparent; padding: 2px; border-radius: 12px; }
.row.tags button.on { border-color: var(--accent); background: var(--bg); }
.results { display: flex; flex-direction: column; gap: 4px; max-height: 60vh; overflow-y: auto; }
.hit {
  display: grid; grid-template-columns: auto auto auto 1fr; gap: 8px; align-items: center;
  text-align: left; background: transparent; border: 1px solid var(--border);
  padding: 6px 8px; border-radius: 4px;
}
.hit:hover { border-color: var(--accent); background: var(--bg); }
.hit-date { color: var(--text-muted); font-variant-numeric: tabular-nums; font-size: 12px; }
.hit-time { color: var(--text-faint); font-size: 11px; font-variant-numeric: tabular-nums; }
.hit-text { color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hit-text :deep(p) { margin: 0; display: inline; }
.muted { color: var(--text-muted); }
</style>
```

- [ ] **Step 2：commit**

```bash
git add src/components/SearchPanel.vue
git commit -m "feat(ui): SearchPanel drawer"
```

---

## Task 6：BarChart.vue + StatsModal.vue

**Files:**
- Create: `src/components/BarChart.vue`, `src/components/StatsModal.vue`

- [ ] **Step 1：写 BarChart.vue（堆叠柱图，纯 SVG）**

```vue
<script setup lang="ts">
import { computed } from "vue";

interface Series { tagId: string | null; color: string; name: string }
interface Bar { label: string; segments: { tagId: string | null; minutes: number }[] }

const props = defineProps<{
  bars: Bar[];           // x 轴每根柱子
  series: Series[];      // 颜色映射，按渲染层级排序
  height?: number;
}>();

const H = props.height ?? 200;
const PAD = 28;

const max = computed(() => {
  let m = 0;
  for (const b of props.bars) {
    const sum = b.segments.reduce((a, s) => a + s.minutes, 0);
    if (sum > m) m = sum;
  }
  return Math.max(m, 60);     // 至少 1h 高
});

const colorMap = computed(() => new Map(props.series.map((s) => [s.tagId, s.color])));
const nameMap = computed(() => new Map(props.series.map((s) => [s.tagId, s.name])));
</script>

<template>
  <div class="chart">
    <svg :viewBox="`0 0 ${bars.length * 60 + PAD} ${H}`" preserveAspectRatio="none">
      <line :x1="PAD" :y1="H - PAD" :x2="bars.length * 60 + PAD - 8" :y2="H - PAD" stroke="var(--border-strong)" />
      <g v-for="(b, i) in bars" :key="b.label">
        <g :transform="`translate(${PAD + i * 60}, 0)`">
          <g :transform="`translate(0, ${H - PAD})`">
            <g v-for="(seg, si) in b.segments" :key="si">
              <rect
                :x="10"
                :y="-(b.segments.slice(0, si + 1).reduce((a, s) => a + s.minutes, 0) / max * (H - PAD - 12))"
                :width="40"
                :height="(seg.minutes / max) * (H - PAD - 12)"
                :fill="colorMap.get(seg.tagId) ?? '#9aa0a6'"
              >
                <title>{{ nameMap.get(seg.tagId) ?? '未分类' }}: {{ Math.round(seg.minutes) }}m</title>
              </rect>
            </g>
          </g>
          <text :x="30" :y="H - 8" text-anchor="middle" font-size="10" fill="var(--text-muted)">
            {{ b.label }}
          </text>
        </g>
      </g>
    </svg>
    <div class="legend">
      <span v-for="s in series" :key="s.tagId ?? 'untagged'">
        <i :style="{ background: s.color }" />{{ s.name }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.chart svg { width: 100%; height: auto; }
.legend { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; color: var(--text-muted); margin-top: 8px; }
.legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; vertical-align: middle; }
</style>
```

- [ ] **Step 2：写 StatsModal.vue**

```vue
<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useStore } from "@/lib/store";
import { aggregateByTag, aggregateDailyByTag } from "@/lib/stats";
import { addDays, formatYMD, parseYMD } from "@/lib/date";
import BarChart from "./BarChart.vue";

defineEmits<{ close: [] }>();
const store = useStore();

const mode = ref<"week" | "month">("week");
const today = formatYMD(new Date());
const refDate = ref(today);

const range = computed(() => {
  const d = parseYMD(refDate.value);
  if (mode.value === "week") {
    // start of week (Sun = 0)
    const dow = d.getUTCDay();
    const start = addDays(d, -dow);
    return { from: formatYMD(start), to: formatYMD(addDays(start, 6)) };
  }
  // month
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  return {
    from: formatYMD(new Date(Date.UTC(y, m, 1))),
    to: formatYMD(new Date(Date.UTC(y, m + 1, 0))),
  };
});

const loading = ref(false);
watch(range, async (r) => {
  loading.value = true;
  try { await store.prefetchMonths(r.from, r.to); }
  finally { loading.value = false; }
}, { immediate: true });

const monthsArray = computed(() => Object.values(store.state.months));

const totals = computed(() => aggregateByTag(monthsArray.value, range.value.from, range.value.to));

const series = computed(() => {
  const all = totals.value.map((t) => ({
    tagId: t.tagId,
    color: store.getTagById(t.tagId)?.color ?? "#9aa0a6",
    name: store.getTagById(t.tagId)?.name ?? "未分类",
  }));
  return all;
});

const bars = computed(() => {
  if (mode.value === "week") {
    const days = aggregateDailyByTag(monthsArray.value, range.value.from, range.value.to);
    return days.map((d) => ({
      label: d.date.slice(8),
      segments: d.byTag,
    }));
  }
  // month: weekly buckets
  const start = parseYMD(range.value.from);
  const buckets: { from: string; to: string; label: string }[] = [];
  for (let d = start; formatYMD(d) <= range.value.to; d = addDays(d, 7)) {
    const end = addDays(d, 6);
    const to = formatYMD(end) > range.value.to ? range.value.to : formatYMD(end);
    buckets.push({ from: formatYMD(d), to, label: formatYMD(d).slice(5) });
  }
  return buckets.map((b) => ({
    label: b.label,
    segments: aggregateByTag(monthsArray.value, b.from, b.to),
  }));
});

function fmt(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return `${m}m`;
  if (!m) return `${h}h`;
  return `${h}h${m}m`;
}
</script>

<template>
  <div class="stats">
    <header>
      <h2>统计</h2>
      <button @click="$emit('close')">关闭</button>
    </header>

    <div class="controls">
      <button :class="{ on: mode === 'week' }" @click="mode = 'week'">本周</button>
      <button :class="{ on: mode === 'month' }" @click="mode = 'month'">本月</button>
      <input type="date" v-model="refDate" />
      <span v-if="loading" class="muted">加载中…</span>
    </div>

    <p class="range">{{ range.from }} 至 {{ range.to }}</p>

    <BarChart :bars="bars" :series="series" />

    <table class="totals">
      <tbody>
        <tr v-for="t in totals" :key="t.tagId ?? 'untagged'">
          <td>
            <span class="dot" :style="{ background: store.getTagById(t.tagId)?.color ?? '#9aa0a6' }" />
            {{ store.getTagById(t.tagId)?.name ?? '未分类' }}
          </td>
          <td class="num">{{ fmt(t.minutes) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.stats { padding: 16px; min-width: 480px; max-width: 720px; }
header { display: flex; justify-content: space-between; align-items: center; }
.controls { display: flex; gap: 8px; align-items: center; margin: 12px 0; }
.controls button.on { border-color: var(--accent); color: var(--accent); }
.range { color: var(--text-muted); font-size: 12px; margin: 0 0 12px 0; }
.muted { color: var(--text-muted); font-size: 12px; }
.totals { width: 100%; margin-top: 16px; }
.totals td { padding: 4px 0; }
.totals .num { text-align: right; font-variant-numeric: tabular-nums; color: var(--text-muted); }
.dot { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 6px; vertical-align: middle; }
</style>
```

- [ ] **Step 3：commit**

```bash
git add src/components/BarChart.vue src/components/StatsModal.vue
git commit -m "feat(ui): StatsModal with stacked bar chart"
```

---

## Task 7：SettingsPanel 加导出按钮

**Files:**
- Modify: `src/components/SettingsPanel.vue`

- [ ] **Step 1：在 SettingsPanel `<script setup>` 顶部 import**

```ts
import { buildJsonExport, buildMarkdownExport, downloadBlob } from "@/lib/export";
```

- [ ] **Step 2：在 script 内增加导出函数**

```ts
async function exportJson() {
  // 拉够全部 month 数据
  await loadAll();
  const blob = buildJsonExport(Object.values(store.state.months), store.state.tags.data);
  downloadBlob(blob, `dairybook-${new Date().toISOString().slice(0,10)}.json`);
}

async function exportMd() {
  await loadAll();
  const md = buildMarkdownExport(Object.values(store.state.months), store.state.tags.data);
  downloadBlob(new Blob([md], { type: "text/markdown" }), `dairybook-${new Date().toISOString().slice(0,10)}.md`);
}

async function loadAll() {
  // simple: prefetch 12 个月范围（1 年内的所有月）。如需更多让用户自定义。
  const today = new Date().toISOString().slice(0, 10);
  const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  await store.prefetchMonths(yearAgo, today);
}
```

- [ ] **Step 3：在 template 增加导出 section**

在 `</section>`（账号 section 之前或之后）加：

```html
<section>
  <h3>导出</h3>
  <p class="muted">导出最近 12 个月的所有 entry。下载到本地，用于备份。</p>
  <div class="row">
    <button @click="exportMd">导出 Markdown</button>
    <button @click="exportJson">导出 JSON</button>
  </div>
</section>
```

- [ ] **Step 4：commit**

```bash
git add src/components/SettingsPanel.vue
git commit -m "feat(ui): export md / json from settings"
```

---

## Task 8：TopBar 入口 + App.vue 挂载

**Files:**
- Modify: `src/components/TopBar.vue`, `src/App.vue`

- [ ] **Step 1：TopBar 加搜索 + 统计按钮**

修改 `src/components/TopBar.vue`，emit 加：

```ts
defineEmits<{
  "open-settings": [];
  "open-search": [];
  "open-stats": [];
}>();
```

template 的 `.right` 内（齿轮按钮前）加：

```html
<button class="icon" @click="$emit('open-search')" aria-label="搜索">🔍</button>
<button class="icon" @click="$emit('open-stats')" aria-label="统计">📊</button>
```

- [ ] **Step 2：App.vue 挂载 SearchPanel + StatsModal**

修改 `src/App.vue`，import 新增：

```ts
import SearchPanel from "@/components/SearchPanel.vue";
import StatsModal from "@/components/StatsModal.vue";
```

state 加：

```ts
const searchOpen = ref(false);
const statsOpen = ref(false);
```

`<TopBar>` 改为：

```vue
<TopBar
  @open-settings="settingsOpen = true"
  @open-search="searchOpen = true"
  @open-stats="statsOpen = true"
/>
```

template 末尾（settings modal 之后）加：

```vue
<SearchPanel v-if="searchOpen"
  @close="searchOpen = false"
  @jump="(date: string) => { store.selectDate(date); searchOpen = false; }"
/>

<div v-if="statsOpen" class="modal-bg" @click.self="statsOpen = false">
  <div class="modal">
    <StatsModal @close="statsOpen = false" />
  </div>
</div>
```

- [ ] **Step 3：commit**

```bash
git add src/components/TopBar.vue src/App.vue
git commit -m "feat(ui): wire SearchPanel + StatsModal entrypoints"
```

---

## Task 9：搜索 e2e

**Files:**
- Create: `tests/e2e/search.spec.ts`

- [ ] **Step 1：实现**

```ts
import { test, expect } from "@playwright/test";
import { mockGitHub } from "./_mocks";

test("search by keyword filters results and jumps to date", async ({ page }) => {
  // 准备一个含两条 entry 的月份
  const may = {
    version: 1, month: "2026-05",
    days: {
      "2026-05-07": { entries: [
        { id: "a", start: "09:00", end: "10:00", text: "晨读人间词话",
          tagId: null, createdAt: "2026-05-07T09:00:00Z", updatedAt: "2026-05-07T09:00:00Z" },
        { id: "b", start: "10:00", end: "11:00", text: "写代码 dairybook",
          tagId: null, createdAt: "2026-05-07T10:00:00Z", updatedAt: "2026-05-07T10:00:00Z" },
      ]},
    },
  };
  await mockGitHub(page, { monthData: may });

  await page.goto("/");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.locator(".timeline")).toBeVisible();

  await page.getByRole("button", { name: "搜索" }).click();
  await page.locator('.drawer input[placeholder*="关键字"]').fill("代码");

  await expect(page.locator(".hit")).toHaveCount(1);
  await expect(page.locator(".hit-text")).toContainText("代码");
});
```

- [ ] **Step 2：跑 + commit**

```bash
pnpm test:e2e tests/e2e/search.spec.ts
```

```bash
git add tests/e2e/search.spec.ts
git commit -m "test(e2e): search drawer filters by keyword"
```

---

## Task 10：统计 e2e

**Files:**
- Create: `tests/e2e/stats.spec.ts`

- [ ] **Step 1：实现**

```ts
import { test, expect } from "@playwright/test";
import { mockGitHub } from "./_mocks";

test("stats modal shows weekly bar chart with totals", async ({ page }) => {
  const may = {
    version: 1, month: "2026-05",
    days: {
      "2026-05-07": { entries: [
        { id: "a", start: "09:00", end: "10:30", text: "工作",
          tagId: null, createdAt: "2026-05-07T09:00:00Z", updatedAt: "2026-05-07T09:00:00Z" },
      ]},
    },
  };
  await mockGitHub(page, { monthData: may });

  await page.goto("/");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.locator(".timeline")).toBeVisible();

  await page.getByRole("button", { name: "统计" }).click();

  await expect(page.locator(".stats")).toBeVisible();
  await expect(page.locator(".stats svg")).toBeVisible();
  // 总时长行至少包含 "1h30m"（90 分钟）
  await expect(page.locator(".totals")).toContainText("1h30m");
});
```

- [ ] **Step 2：跑 + commit**

```bash
pnpm test:e2e tests/e2e/stats.spec.ts
```

```bash
git add tests/e2e/stats.spec.ts
git commit -m "test(e2e): stats modal renders chart + totals"
```

---

## Task 11：导出 e2e

**Files:**
- Create: `tests/e2e/export.spec.ts`

- [ ] **Step 1：实现**

```ts
import { test, expect } from "@playwright/test";
import { mockGitHub } from "./_mocks";

test("export markdown downloads a .md file with entries", async ({ page }) => {
  const may = {
    version: 1, month: "2026-05",
    days: {
      "2026-05-07": { entries: [
        { id: "a", start: "09:00", end: "10:00", text: "测试导出",
          tagId: null, createdAt: "2026-05-07T09:00:00Z", updatedAt: "2026-05-07T09:00:00Z" },
      ]},
    },
  };
  await mockGitHub(page, { monthData: may });

  await page.goto("/");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.locator(".timeline")).toBeVisible();

  await page.getByRole("button", { name: "设置" }).click();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 Markdown" }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/dairybook-\d{4}-\d{2}-\d{2}\.md/);
  const path = await download.path();
  const fs = await import("node:fs/promises");
  const content = await fs.readFile(path!, "utf8");
  expect(content).toContain("# 2026-05");
  expect(content).toContain("测试导出");
});
```

- [ ] **Step 2：跑 + commit**

```bash
pnpm test:e2e tests/e2e/export.spec.ts
```

```bash
git add tests/e2e/export.spec.ts
git commit -m "test(e2e): markdown export download"
```

---

## Task 12：收尾验证

- [ ] **Step 1：跑全套**

```bash
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```

预期：单测 ≥ 55（Plan 1+2 已 ≥ 50，Plan 3 + 11：search 6 + stats 3 + export 2）；e2e ≥ 8（Plan 1+2 5 + Plan 3 3）。

- [ ] **Step 2：手动 smoke**

至少跑过这几条路径：

1. 写 entry → 用关键字搜索 → 点击搜索结果跳到对应日期
2. 用标签 + 时间范围过滤搜索
3. 打开统计→看本周柱图 + 切到本月 + 切日期
4. 设置→导出 Markdown，文件中应有所有有 entry 的日期
5. 设置→导出 JSON，可以肉眼检查结构

- [ ] **Step 3：final commit + push**

```bash
git push origin main
```

---

## Plan 3 完工标准 / 整套完工

- [ ] 全部三个 Plan 单测合计 ≥ 55 PASS
- [ ] e2e ≥ 8 PASS（login + write + conflict + tags + offline + search + stats + export）
- [ ] 搜索能按关键字 / 标签 / 日期范围过滤；点结果跳转
- [ ] 统计能显示周柱图 + 月柱图 + 标签时长合计
- [ ] 能导出 md 和 json，下载到本地
- [ ] CI 通过、Pages 上能正常访问
- [ ] 整个 spec §1–§9 全部覆盖

到此 dairybook 整个 spec 闭环。
