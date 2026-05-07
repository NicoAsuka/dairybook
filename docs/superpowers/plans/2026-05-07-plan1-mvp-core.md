# dairybook Plan 1：MVP 内核 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个能用 GitHub Device Flow 登录、把日程条目按 24 小时网格写入并多设备同步到私有 GitHub 仓库的 Vue 3 SPA。完工时：用户能登录、写 entry、跨设备读到同一份数据、并发写不丢数据。

**Architecture:** Vue 3 + TS 单页应用，纯前端零后端。`src/lib/*.ts` 为框架无关的纯逻辑模块（types / date / id / merge / github / auth / idb / sync / store），`src/components/*.vue` 只做渲染并通过 `useStore` 调用业务层。数据落到用户的私有 `dairybook-data` 仓库，按月切分 JSON 文件，多设备并发用 sha + 三向合并解决。

**Tech Stack:** Vue 3、TypeScript、Vite、Vitest、@vue/test-utils、Playwright、msw、idb-keyval、ulidx、Biome

**Plan 1 范围（明确不在内）:**
- ❌ 标签 / 颜色 / `tags.json`（Plan 2）
- ❌ Markdown 渲染（Plan 2）
- ❌ 搜索 / 统计 / 导出（Plan 3）
- ❌ 离线队列可视化的精细 UI（Plan 2）

Plan 1 完成后 entry 上的 `tagId` 字段固定为 `null`，文本显示纯文本，能写能读能同步即视为达成。

---

## 文件结构

```
dairybook/
├── .github/workflows/
│   └── ci.yml
├── src/
│   ├── lib/
│   │   ├── types.ts           # Entry, MonthData, AuthState 等所有类型
│   │   ├── date.ts            # 日期工具
│   │   ├── id.ts              # ULID 包装
│   │   ├── merge.ts           # entries 三向合并
│   │   ├── github.ts          # GitHub Contents API 封装
│   │   ├── auth.ts            # Device Flow 登录
│   │   ├── idb.ts             # IndexedDB 缓存（月数据 + token）
│   │   ├── sync.ts            # 防抖 PUT + 重试队列 + 409 处理
│   │   └── store.ts           # useStore composable
│   ├── components/
│   │   ├── TopBar.vue
│   │   ├── DateNav.vue
│   │   ├── MiniCalendar.vue
│   │   ├── Timeline.vue
│   │   ├── EntryCard.vue
│   │   ├── EntryEditor.vue
│   │   ├── QuickAdd.vue
│   │   ├── LoginPanel.vue
│   │   └── OnboardingPanel.vue
│   ├── App.vue
│   ├── main.ts
│   └── styles.css
├── tests/
│   ├── unit/
│   │   ├── date.test.ts
│   │   ├── id.test.ts
│   │   ├── merge.test.ts
│   │   ├── github.test.ts
│   │   ├── auth.test.ts
│   │   ├── idb.test.ts
│   │   └── sync.test.ts
│   ├── component/
│   │   ├── EntryEditor.test.ts
│   │   ├── Timeline.test.ts
│   │   └── QuickAdd.test.ts
│   ├── e2e/
│   │   ├── login.spec.ts
│   │   ├── write.spec.ts
│   │   └── conflict.spec.ts
│   ├── fixtures/
│   │   └── month.ts
│   └── setup.ts
├── public/
│   └── favicon.svg
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── biome.json
└── README.md
```

每个 `lib/` 文件单一职责、纯 TS、不依赖 Vue，可独立单测。组件不直接调 `github.ts` 或 `idb.ts`，全部通过 `useStore()`。

---

## Task 1：项目脚手架

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `biome.json`, `index.html`, `tests/setup.ts`

- [ ] **Step 1：初始化 package.json**

写 `package.json`：

```json
{
  "name": "dairybook",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "lint": "biome check .",
    "format": "biome format --write ."
  }
}
```

- [ ] **Step 2：装依赖**

```bash
pnpm add vue@^3.4 idb-keyval@^6 ulidx@^2
pnpm add -D vite @vitejs/plugin-vue typescript @vue/tsconfig vue-tsc \
            vitest @vue/test-utils jsdom @biomejs/biome msw \
            @playwright/test
```

- [ ] **Step 3：写 tsconfig.json**

```json
{
  "extends": "@vue/tsconfig/tsconfig.dom.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] },
    "types": ["vite/client"]
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 4：写 vite.config.ts 与 vitest.config.ts**

`vite.config.ts`：

```ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  base: "./",
});
```

`vitest.config.ts`：

```ts
import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.ts", "tests/component/**/*.test.ts"],
  },
});
```

- [ ] **Step 5：写 biome.json**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "files": { "ignore": ["dist", "node_modules", "playwright-report"] },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2 },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "javascript": { "formatter": { "quoteStyle": "double", "semicolons": "always" } }
}
```

- [ ] **Step 6：写 tests/setup.ts（msw 占位）**

```ts
import { afterAll, afterEach, beforeAll } from "vitest";
import { setupServer } from "msw/node";

export const mswServer = setupServer();

beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());
```

- [ ] **Step 7：写 index.html**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>dairybook</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 8：验证 build 不报错**

```bash
pnpm build
```

预期：报错"Could not load /src/main.ts"——这是预期的，下一个 Task 写它。但 vite 必须能正常解析配置（输出含 vue plugin 加载成功的信息）。

- [ ] **Step 9：commit**

```bash
git add package.json pnpm-lock.yaml tsconfig.json vite.config.ts \
        vitest.config.ts biome.json index.html tests/setup.ts
git commit -m "chore: bootstrap Vue 3 + Vite + Vitest project"
```

---

## Task 2：Vue 应用骨架

**Files:**
- Create: `src/main.ts`, `src/App.vue`, `src/styles.css`

- [ ] **Step 1：写最小 App.vue**

```vue
<script setup lang="ts">
</script>

<template>
  <div class="app-shell">
    <h1>dairybook</h1>
    <p class="muted">即将就绪。</p>
  </div>
</template>

<style scoped>
.app-shell { padding: 24px; }
.muted { color: #888; }
</style>
```

- [ ] **Step 2：写 main.ts**

```ts
import { createApp } from "vue";
import App from "./App.vue";
import "./styles.css";

createApp(App).mount("#app");
```

- [ ] **Step 3：写 styles.css（全局基础）**

```css
* { box-sizing: border-box; }
html, body, #app { margin: 0; padding: 0; height: 100%; }
body {
  font-family: -apple-system, "PingFang SC", "Helvetica Neue", sans-serif;
  font-size: 14px;
  color: #2b2b2b;
  background: #fafafa;
}
```

- [ ] **Step 4：跑 dev 看一眼**

```bash
pnpm dev
```

预期：http://localhost:5173 显示 "dairybook" 标题与灰字。Ctrl-C 关掉。

- [ ] **Step 5：验证 build 通过**

```bash
pnpm build
```

预期：成功生成 `dist/`。

- [ ] **Step 6：commit**

```bash
git add src/
git commit -m "feat: empty Vue 3 app shell"
```

---

## Task 3：CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1：写 ci.yml**

```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build
```

- [ ] **Step 2：本地跑全套验证**

```bash
pnpm lint && pnpm test && pnpm build
```

预期：lint 0 错；test 显示 "No tests found"（OK，下面就写）；build 成功。

- [ ] **Step 3：commit**

```bash
git add .github/
git commit -m "ci: add lint+test+build workflow"
```

---

## Task 4：核心类型（types.ts）

**Files:**
- Create: `src/lib/types.ts`

- [ ] **Step 1：写 types.ts**

```ts
// 一条日程
export interface Entry {
  id: string;            // ULID
  start: string;         // "HH:MM"
  end: string;           // "HH:MM"，必须 >= start，禁止跨午夜
  text: string;          // 原始文本（Plan 1 不渲染 Markdown）
  tagId: string | null;  // Plan 1 固定为 null
  createdAt: string;     // ISO 8601 UTC
  updatedAt: string;     // ISO 8601 UTC
}

// 一天的数据
export interface DayData {
  entries: Entry[];
}

// 月文件 data/YYYY-MM.json 的全部内容
export interface MonthData {
  version: 1;
  month: string;                          // "YYYY-MM"
  days: Record<string, DayData>;          // key: "YYYY-MM-DD"
}

// 月文件附带的 sha（GitHub blob sha）
export interface MonthDoc {
  data: MonthData;
  sha: string | null;     // null = 仓库里还没这个文件
}

// 登录态
export type AuthState =
  | { kind: "anonymous" }
  | { kind: "logged-in"; token: string; user: { login: string } };

// 仓库就绪态
export type RepoState =
  | { kind: "unknown" }            // 还没检测
  | { kind: "missing" }            // dairybook-data 仓库不存在或 App 未安装
  | { kind: "ready"; owner: string; repo: string };

// 同步状态指示
export type SyncStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: number }    // unix ms
  | { kind: "error"; message: string; retryable: boolean };
```

- [ ] **Step 2：写一个 noop 测试确认 TS 编译通过**

`tests/unit/types.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import type { Entry } from "@/lib/types";

describe("types", () => {
  it("Entry shape compiles", () => {
    const e: Entry = {
      id: "01H",
      start: "09:00",
      end: "10:00",
      text: "x",
      tagId: null,
      createdAt: "2026-05-07T09:00:00Z",
      updatedAt: "2026-05-07T09:00:00Z",
    };
    expect(e.id).toBe("01H");
  });
});
```

- [ ] **Step 3：跑测试**

```bash
pnpm test
```

预期：1 passed。

- [ ] **Step 4：commit**

```bash
git add src/lib/types.ts tests/unit/types.test.ts
git commit -m "feat(lib): define core types"
```

---

## Task 5：日期工具（date.ts）

**Files:**
- Create: `src/lib/date.ts`, `tests/unit/date.test.ts`

- [ ] **Step 1：先写测试**

`tests/unit/date.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { formatYM, formatYMD, parseYMD, addDays, monthOf, isValidTime, compareTimes } from "@/lib/date";

describe("formatYM", () => {
  it("formats Date to YYYY-MM", () => {
    expect(formatYM(new Date(Date.UTC(2026, 4, 7)))).toBe("2026-05");
  });
});

describe("formatYMD / parseYMD", () => {
  it("roundtrips", () => {
    const d = parseYMD("2026-05-07");
    expect(formatYMD(d)).toBe("2026-05-07");
  });
});

describe("addDays", () => {
  it("crosses month boundary", () => {
    expect(formatYMD(addDays(parseYMD("2026-05-31"), 1))).toBe("2026-06-01");
  });
  it("subtracts negative", () => {
    expect(formatYMD(addDays(parseYMD("2026-05-01"), -1))).toBe("2026-04-30");
  });
});

describe("monthOf", () => {
  it("derives YYYY-MM from YYYY-MM-DD", () => {
    expect(monthOf("2026-05-07")).toBe("2026-05");
  });
});

describe("isValidTime", () => {
  it("accepts HH:MM 24h", () => {
    expect(isValidTime("00:00")).toBe(true);
    expect(isValidTime("23:59")).toBe(true);
  });
  it("rejects bad input", () => {
    expect(isValidTime("24:00")).toBe(false);
    expect(isValidTime("9:00")).toBe(false);
    expect(isValidTime("ab:cd")).toBe(false);
  });
});

describe("compareTimes", () => {
  it("returns negative / 0 / positive", () => {
    expect(compareTimes("09:00", "10:00")).toBeLessThan(0);
    expect(compareTimes("09:00", "09:00")).toBe(0);
    expect(compareTimes("10:00", "09:00")).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2：跑测试，确认全失败**

```bash
pnpm test tests/unit/date.test.ts
```

预期：6 个 describe 都因 import 失败而 FAIL（"Failed to resolve import"）。

- [ ] **Step 3：实现 date.ts**

```ts
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
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
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
```

- [ ] **Step 4：跑测试**

```bash
pnpm test tests/unit/date.test.ts
```

预期：全部 PASS。

- [ ] **Step 5：commit**

```bash
git add src/lib/date.ts tests/unit/date.test.ts
git commit -m "feat(lib): date utilities"
```

---

## Task 6：ULID 生成（id.ts）

**Files:**
- Create: `src/lib/id.ts`, `tests/unit/id.test.ts`

- [ ] **Step 1：先写测试**

`tests/unit/id.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { newId } from "@/lib/id";

describe("newId", () => {
  it("returns 26-char ULID", () => {
    const id = newId();
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });
  it("is monotonically sortable across rapid calls", () => {
    const ids = Array.from({ length: 50 }, () => newId());
    const sorted = [...ids].sort();
    expect(sorted).toEqual(ids);
  });
});
```

- [ ] **Step 2：跑，确认 FAIL**

```bash
pnpm test tests/unit/id.test.ts
```

预期：FAIL（import 失败）。

- [ ] **Step 3：实现 id.ts**

```ts
import { monotonicFactory } from "ulidx";

const ulid = monotonicFactory();

export function newId(): string {
  return ulid();
}
```

- [ ] **Step 4：跑测试**

```bash
pnpm test tests/unit/id.test.ts
```

预期：PASS。

- [ ] **Step 5：commit**

```bash
git add src/lib/id.ts tests/unit/id.test.ts
git commit -m "feat(lib): monotonic ULID generator"
```

---

## Task 7：三向合并（merge.ts）

合并是数据安全的核心，必须 TDD 严覆盖。

**Files:**
- Create: `src/lib/merge.ts`, `tests/unit/merge.test.ts`, `tests/fixtures/month.ts`

- [ ] **Step 1：写 fixture builder**

`tests/fixtures/month.ts`：

```ts
import type { Entry, MonthData } from "@/lib/types";

export function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: "01TEST00000000000000000001",
    start: "09:00",
    end: "10:00",
    text: "default",
    tagId: null,
    createdAt: "2026-05-07T09:00:00Z",
    updatedAt: "2026-05-07T09:00:00Z",
    ...overrides,
  };
}

export function makeMonth(month = "2026-05", days: MonthData["days"] = {}): MonthData {
  return { version: 1, month, days };
}
```

- [ ] **Step 2：写 merge 测试（每种场景一个 it）**

`tests/unit/merge.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { mergeMonths } from "@/lib/merge";
import { makeEntry, makeMonth } from "../fixtures/month";

describe("mergeMonths", () => {
  it("returns local when remote equals base (nothing to merge)", () => {
    const base = makeMonth("2026-05", {
      "2026-05-07": { entries: [makeEntry({ id: "a" })] },
    });
    const local = makeMonth("2026-05", {
      "2026-05-07": { entries: [makeEntry({ id: "a", text: "edited locally", updatedAt: "2026-05-07T10:00:00Z" })] },
    });
    const merged = mergeMonths(base, local, base);
    expect(merged.days["2026-05-07"]?.entries[0]?.text).toBe("edited locally");
  });

  it("keeps both sides' new entries", () => {
    const base = makeMonth("2026-05", { "2026-05-07": { entries: [] } });
    const local = makeMonth("2026-05", {
      "2026-05-07": { entries: [makeEntry({ id: "loc", text: "L" })] },
    });
    const remote = makeMonth("2026-05", {
      "2026-05-07": { entries: [makeEntry({ id: "rem", text: "R" })] },
    });
    const merged = mergeMonths(base, local, remote);
    const ids = (merged.days["2026-05-07"]?.entries ?? []).map((e) => e.id).sort();
    expect(ids).toEqual(["loc", "rem"]);
  });

  it("on same-id concurrent edit, keeps the newer updatedAt", () => {
    const base = makeMonth("2026-05", {
      "2026-05-07": { entries: [makeEntry({ id: "a", text: "base", updatedAt: "2026-05-07T09:00:00Z" })] },
    });
    const local = makeMonth("2026-05", {
      "2026-05-07": { entries: [makeEntry({ id: "a", text: "local", updatedAt: "2026-05-07T10:00:00Z" })] },
    });
    const remote = makeMonth("2026-05", {
      "2026-05-07": { entries: [makeEntry({ id: "a", text: "remote", updatedAt: "2026-05-07T11:00:00Z" })] },
    });
    const merged = mergeMonths(base, local, remote);
    expect(merged.days["2026-05-07"]?.entries[0]?.text).toBe("remote");
  });

  it("preserves the edited side when one deletes and one edits", () => {
    const base = makeMonth("2026-05", {
      "2026-05-07": { entries: [makeEntry({ id: "a", text: "base" })] },
    });
    const local = makeMonth("2026-05", {
      "2026-05-07": { entries: [] },  // local deleted
    });
    const remote = makeMonth("2026-05", {
      "2026-05-07": { entries: [makeEntry({ id: "a", text: "edited", updatedAt: "2026-05-07T11:00:00Z" })] },
    });
    const merged = mergeMonths(base, local, remote);
    expect(merged.days["2026-05-07"]?.entries.map((e) => e.text)).toEqual(["edited"]);
  });

  it("removes when both sides delete the same entry", () => {
    const base = makeMonth("2026-05", {
      "2026-05-07": { entries: [makeEntry({ id: "a" })] },
    });
    const local = makeMonth("2026-05", { "2026-05-07": { entries: [] } });
    const remote = makeMonth("2026-05", { "2026-05-07": { entries: [] } });
    const merged = mergeMonths(base, local, remote);
    expect(merged.days["2026-05-07"]?.entries).toEqual([]);
  });

  it("merges across different days", () => {
    const base = makeMonth("2026-05", {});
    const local = makeMonth("2026-05", {
      "2026-05-07": { entries: [makeEntry({ id: "a" })] },
    });
    const remote = makeMonth("2026-05", {
      "2026-05-08": { entries: [makeEntry({ id: "b" })] },
    });
    const merged = mergeMonths(base, local, remote);
    expect(Object.keys(merged.days).sort()).toEqual(["2026-05-07", "2026-05-08"]);
  });

  it("orders merged entries by start time then id", () => {
    const base = makeMonth("2026-05", { "2026-05-07": { entries: [] } });
    const local = makeMonth("2026-05", {
      "2026-05-07": { entries: [makeEntry({ id: "x", start: "11:00", end: "12:00" })] },
    });
    const remote = makeMonth("2026-05", {
      "2026-05-07": { entries: [makeEntry({ id: "y", start: "09:00", end: "10:00" })] },
    });
    const merged = mergeMonths(base, local, remote);
    expect(merged.days["2026-05-07"]?.entries.map((e) => e.id)).toEqual(["y", "x"]);
  });
});
```

- [ ] **Step 3：跑，确认 FAIL**

```bash
pnpm test tests/unit/merge.test.ts
```

- [ ] **Step 4：实现 merge.ts**

```ts
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
      // both sides newly added with same id (rare with ULID, but handle): take newer
      out.push(newer(l, r));
    } else if (!b && l) {
      out.push(l);
    } else if (!b && r) {
      out.push(r);
    } else if (b && l && r) {
      // base + local + remote → take whichever side actually changed; if both changed, newer wins
      const localChanged = l.updatedAt !== b.updatedAt;
      const remoteChanged = r.updatedAt !== b.updatedAt;
      if (localChanged && remoteChanged) out.push(newer(l, r));
      else if (localChanged) out.push(l);
      else out.push(r);
    } else if (b && l && !r) {
      // remote deleted; if local also unchanged, accept delete; if local edited, keep local
      if (l.updatedAt === b.updatedAt) {
        // both effectively unchanged from base on local → accept remote delete
        // (no-op: skip pushing)
      } else {
        out.push(l);
      }
    } else if (b && !l && r) {
      // local deleted; if remote unchanged, accept delete; if remote edited, keep remote
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
    if (merged.length > 0) days[day] = { entries: merged };
  }
  return { version: 1, month: local.month, days };
}
```

- [ ] **Step 5：跑测试**

```bash
pnpm test tests/unit/merge.test.ts
```

预期：全部 7 个 PASS。如有失败请逐个排查（可能是 base/local/remote 顺序参数）。

- [ ] **Step 6：commit**

```bash
git add src/lib/merge.ts tests/unit/merge.test.ts tests/fixtures/month.ts
git commit -m "feat(lib): three-way merge for month entries"
```

---

## Task 8：GitHub Contents API 客户端（github.ts）

**Files:**
- Create: `src/lib/github.ts`, `tests/unit/github.test.ts`

- [ ] **Step 1：写测试（使用 msw 拦截）**

`tests/unit/github.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { mswServer } from "../setup";
import { GitHubClient, GitHubError } from "@/lib/github";

const owner = "alice";
const repo = "dairybook-data";
const token = "gh_test_xxx";

describe("GitHubClient.getMonth", () => {
  it("returns parsed JSON + sha when 200", async () => {
    mswServer.use(
      http.get(`https://api.github.com/repos/${owner}/${repo}/contents/data/2026-05.json`, () =>
        HttpResponse.json({
          sha: "deadbeef",
          content: btoa(JSON.stringify({ version: 1, month: "2026-05", days: {} })),
          encoding: "base64",
        }),
      ),
    );
    const client = new GitHubClient({ token, owner, repo });
    const doc = await client.getMonth("2026-05");
    expect(doc.sha).toBe("deadbeef");
    expect(doc.data.month).toBe("2026-05");
  });

  it("returns null sha when 404", async () => {
    mswServer.use(
      http.get(`https://api.github.com/repos/${owner}/${repo}/contents/data/2026-05.json`, () =>
        HttpResponse.json({ message: "Not Found" }, { status: 404 }),
      ),
    );
    const client = new GitHubClient({ token, owner, repo });
    const doc = await client.getMonth("2026-05");
    expect(doc.sha).toBeNull();
    expect(doc.data.days).toEqual({});
  });

  it("throws GitHubError(401) when token invalid", async () => {
    mswServer.use(
      http.get(`https://api.github.com/repos/${owner}/${repo}/contents/data/2026-05.json`, () =>
        HttpResponse.json({ message: "Bad credentials" }, { status: 401 }),
      ),
    );
    const client = new GitHubClient({ token, owner, repo });
    await expect(client.getMonth("2026-05")).rejects.toThrow(GitHubError);
  });
});

describe("GitHubClient.putMonth", () => {
  it("PUT with sha sends correct body", async () => {
    let received: unknown;
    mswServer.use(
      http.put(`https://api.github.com/repos/${owner}/${repo}/contents/data/2026-05.json`, async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ content: { sha: "newsha123" } });
      }),
    );
    const client = new GitHubClient({ token, owner, repo });
    const result = await client.putMonth("2026-05", { version: 1, month: "2026-05", days: {} }, "oldsha");
    expect(result.sha).toBe("newsha123");
    expect((received as any).sha).toBe("oldsha");
    expect(typeof (received as any).content).toBe("string");
  });

  it("throws GitHubError(409) on sha conflict", async () => {
    mswServer.use(
      http.put(`https://api.github.com/repos/${owner}/${repo}/contents/data/2026-05.json`, () =>
        HttpResponse.json({ message: "sha mismatch" }, { status: 409 }),
      ),
    );
    const client = new GitHubClient({ token, owner, repo });
    await expect(
      client.putMonth("2026-05", { version: 1, month: "2026-05", days: {} }, "oldsha"),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe("GitHubClient.checkRepo", () => {
  it("returns ready when 200", async () => {
    mswServer.use(
      http.get(`https://api.github.com/repos/${owner}/${repo}`, () =>
        HttpResponse.json({ name: repo, private: true }),
      ),
    );
    const client = new GitHubClient({ token, owner, repo });
    expect(await client.checkRepo()).toBe("ready");
  });
  it("returns missing when 404", async () => {
    mswServer.use(
      http.get(`https://api.github.com/repos/${owner}/${repo}`, () =>
        HttpResponse.json({ message: "Not Found" }, { status: 404 }),
      ),
    );
    const client = new GitHubClient({ token, owner, repo });
    expect(await client.checkRepo()).toBe("missing");
  });
});
```

- [ ] **Step 2：跑，确认 FAIL**

- [ ] **Step 3：实现 github.ts**

```ts
import type { MonthData, MonthDoc } from "./types";

const API = "https://api.github.com";

export class GitHubError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "GitHubError";
  }
}

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
}

function utf8ToBase64(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}
function base64ToUtf8(s: string): string {
  return decodeURIComponent(escape(atob(s)));
}

export class GitHubClient {
  constructor(private cfg: GitHubConfig) {}

  private headers(): HeadersInit {
    return {
      Authorization: `Bearer ${this.cfg.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  private monthPath(month: string): string {
    return `${API}/repos/${this.cfg.owner}/${this.cfg.repo}/contents/data/${month}.json`;
  }

  async getMonth(month: string): Promise<MonthDoc> {
    const res = await fetch(this.monthPath(month), { headers: this.headers() });
    if (res.status === 404) {
      return { data: { version: 1, month, days: {} }, sha: null };
    }
    if (!res.ok) throw new GitHubError(res.status, await res.text());
    const body = await res.json() as { sha: string; content: string; encoding: string };
    const json = JSON.parse(base64ToUtf8(body.content.replace(/\n/g, "")));
    return { data: json as MonthData, sha: body.sha };
  }

  async putMonth(month: string, data: MonthData, sha: string | null): Promise<{ sha: string }> {
    const res = await fetch(this.monthPath(month), {
      method: "PUT",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `data: update ${month}`,
        content: utf8ToBase64(JSON.stringify(data, null, 2)),
        ...(sha ? { sha } : {}),
      }),
    });
    if (!res.ok) throw new GitHubError(res.status, await res.text());
    const body = await res.json() as { content: { sha: string } };
    return { sha: body.content.sha };
  }

  async checkRepo(): Promise<"ready" | "missing"> {
    const res = await fetch(`${API}/repos/${this.cfg.owner}/${this.cfg.repo}`, { headers: this.headers() });
    if (res.status === 200) return "ready";
    if (res.status === 404 || res.status === 403) return "missing";
    throw new GitHubError(res.status, await res.text());
  }

  async getViewer(): Promise<{ login: string }> {
    const res = await fetch(`${API}/user`, { headers: this.headers() });
    if (!res.ok) throw new GitHubError(res.status, await res.text());
    return await res.json() as { login: string };
  }
}
```

- [ ] **Step 4：跑测试**

```bash
pnpm test tests/unit/github.test.ts
```

预期：全部 PASS。

- [ ] **Step 5：commit**

```bash
git add src/lib/github.ts tests/unit/github.test.ts
git commit -m "feat(lib): GitHub Contents API client"
```

---

## Task 9：Device Flow 登录（auth.ts）

**Files:**
- Create: `src/lib/auth.ts`, `tests/unit/auth.test.ts`

- [ ] **Step 1：写测试**

`tests/unit/auth.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { mswServer } from "../setup";
import { startDeviceFlow, pollForToken } from "@/lib/auth";

const CLIENT_ID = "Iv23liTEST";

describe("startDeviceFlow", () => {
  it("returns user_code + device_code from GitHub", async () => {
    mswServer.use(
      http.post("https://github.com/login/device/code", async ({ request }) => {
        const body = await request.json() as { client_id: string };
        expect(body.client_id).toBe(CLIENT_ID);
        return HttpResponse.json({
          device_code: "DC123",
          user_code: "AB12-CD34",
          verification_uri: "https://github.com/login/device",
          expires_in: 900,
          interval: 5,
        });
      }),
    );
    const r = await startDeviceFlow(CLIENT_ID);
    expect(r.userCode).toBe("AB12-CD34");
    expect(r.interval).toBe(5);
  });
});

describe("pollForToken", () => {
  it("returns token when authorized", async () => {
    mswServer.use(
      http.post("https://github.com/login/oauth/access_token", () =>
        HttpResponse.json({ access_token: "ghu_xxx", token_type: "bearer" }),
      ),
    );
    const t = await pollForToken(CLIENT_ID, "DC123", { intervalSec: 0.01, maxTries: 1 });
    expect(t).toBe("ghu_xxx");
  });

  it("returns null on access_denied", async () => {
    mswServer.use(
      http.post("https://github.com/login/oauth/access_token", () =>
        HttpResponse.json({ error: "access_denied" }),
      ),
    );
    const t = await pollForToken(CLIENT_ID, "DC123", { intervalSec: 0.01, maxTries: 1 });
    expect(t).toBeNull();
  });

  it("retries on authorization_pending", async () => {
    let calls = 0;
    mswServer.use(
      http.post("https://github.com/login/oauth/access_token", () => {
        calls++;
        if (calls === 1) return HttpResponse.json({ error: "authorization_pending" });
        return HttpResponse.json({ access_token: "ghu_yyy", token_type: "bearer" });
      }),
    );
    const t = await pollForToken(CLIENT_ID, "DC123", { intervalSec: 0.01, maxTries: 5 });
    expect(t).toBe("ghu_yyy");
    expect(calls).toBe(2);
  });
});
```

- [ ] **Step 2：跑，FAIL**

- [ ] **Step 3：实现 auth.ts**

```ts
export interface DeviceFlowStart {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  interval: number;
  expiresIn: number;
}

const SCOPE = "repo";

export async function startDeviceFlow(clientId: string): Promise<DeviceFlowStart> {
  const res = await fetch("https://github.com/login/device/code", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: clientId, scope: SCOPE }),
  });
  if (!res.ok) throw new Error(`device flow start failed: ${res.status}`);
  const body = await res.json() as {
    device_code: string;
    user_code: string;
    verification_uri: string;
    interval: number;
    expires_in: number;
  };
  return {
    deviceCode: body.device_code,
    userCode: body.user_code,
    verificationUri: body.verification_uri,
    interval: body.interval,
    expiresIn: body.expires_in,
  };
}

export interface PollOpts {
  intervalSec: number;
  maxTries: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function pollForToken(
  clientId: string,
  deviceCode: string,
  opts: PollOpts,
): Promise<string | null> {
  let interval = opts.intervalSec;
  for (let i = 0; i < opts.maxTries; i++) {
    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    });
    const body = await res.json() as {
      access_token?: string;
      error?: string;
    };
    if (body.access_token) return body.access_token;
    if (body.error === "access_denied" || body.error === "expired_token") return null;
    if (body.error === "slow_down") interval += 5;
    // authorization_pending → just wait & retry
    await sleep(interval * 1000);
  }
  return null;
}
```

- [ ] **Step 4：跑测试**

```bash
pnpm test tests/unit/auth.test.ts
```

预期：3 个 PASS。

- [ ] **Step 5：commit**

```bash
git add src/lib/auth.ts tests/unit/auth.test.ts
git commit -m "feat(lib): GitHub Device Flow auth"
```

---

## Task 10：IndexedDB 缓存（idb.ts）

**Files:**
- Create: `src/lib/idb.ts`, `tests/unit/idb.test.ts`

- [ ] **Step 1：写测试（idb-keyval 在 jsdom 下需 fake-indexeddb，安装一下）**

```bash
pnpm add -D fake-indexeddb
```

更新 `tests/setup.ts` 顶部加：

```ts
import "fake-indexeddb/auto";
```

放在文件顶部第一行。

- [ ] **Step 2：写测试**

`tests/unit/idb.test.ts`：

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { clear } from "idb-keyval";
import { cacheMonth, getCachedMonth, getToken, setToken, clearToken } from "@/lib/idb";
import { makeMonth } from "../fixtures/month";

beforeEach(async () => {
  await clear();
  localStorage.clear();
});

describe("month cache", () => {
  it("roundtrips a MonthDoc", async () => {
    const doc = { data: makeMonth("2026-05"), sha: "abc" };
    await cacheMonth("2026-05", doc);
    const got = await getCachedMonth("2026-05");
    expect(got?.sha).toBe("abc");
  });
  it("returns undefined for missing month", async () => {
    expect(await getCachedMonth("2026-05")).toBeUndefined();
  });
});

describe("token storage", () => {
  it("set / get / clear", () => {
    expect(getToken()).toBeNull();
    setToken("ghu_test");
    expect(getToken()).toBe("ghu_test");
    clearToken();
    expect(getToken()).toBeNull();
  });
});
```

- [ ] **Step 3：实现 idb.ts**

月数据走 IndexedDB（容量大、异步）；token 走 localStorage（小、同步取，符合 spec §6.4）。

```ts
import { get, set } from "idb-keyval";
import type { MonthDoc } from "./types";

const KEY_TOKEN = "dairybook.token";
const monthKey = (m: string) => `month.${m}`;

// month cache → IndexedDB
export async function cacheMonth(month: string, doc: MonthDoc): Promise<void> {
  await set(monthKey(month), doc);
}

export async function getCachedMonth(month: string): Promise<MonthDoc | undefined> {
  return await get(monthKey(month));
}

// token → localStorage（spec §6.4：避免 CSRF；XSS 由控制 deps + 关 markdown raw HTML 兜底）
export function setToken(token: string): void {
  localStorage.setItem(KEY_TOKEN, token);
}

export function getToken(): string | null {
  return localStorage.getItem(KEY_TOKEN);
}

export function clearToken(): void {
  localStorage.removeItem(KEY_TOKEN);
}
```

- [ ] **Step 4：跑测试**

```bash
pnpm test tests/unit/idb.test.ts
```

预期：4 个 PASS。

- [ ] **Step 5：commit**

```bash
git add src/lib/idb.ts tests/unit/idb.test.ts tests/setup.ts package.json pnpm-lock.yaml
git commit -m "feat(lib): IndexedDB cache for month + token"
```

---

## Task 11：同步引擎（sync.ts）

把 entry 写入 → 防抖 → PUT → 失败入队 → 409 三向合并重试，全部封装成一个可单测的引擎。

**Files:**
- Create: `src/lib/sync.ts`, `tests/unit/sync.test.ts`

- [ ] **Step 1：写测试**

`tests/unit/sync.test.ts`：

```ts
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
    calls.get.push(m);
    return { data: makeMonth(m), sha: "remote-sha" };
  });
  const put = stubs.putMonth ?? (async (m: string, data: any, sha: string | null) => {
    calls.put.push({ m, data, sha });
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
    // 2nd PUT happened after merge
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
```

- [ ] **Step 2：跑，FAIL**

- [ ] **Step 3：实现 sync.ts**

```ts
import { GitHubError } from "./github";
import { mergeMonths } from "./merge";
import type { MonthData, MonthDoc } from "./types";

export interface SyncDeps {
  debounceMs: number;
  retryDelayMs?: number;     // base for exponential backoff on 5xx; default 1000
  getMonth: (m: string) => Promise<MonthDoc>;
  putMonth: (m: string, data: MonthData, sha: string | null) => Promise<{ sha: string }>;
  onStatus?: (status: "saving" | "saved" | "error", err?: Error) => void;
}

interface Pending {
  doc: MonthDoc;            // local doc with current sha
  base: MonthData;          // last known synced data (for 3-way merge base)
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
    const base = existing?.base ?? doc.data;  // first save: no base diff yet
    if (existing?.timer) clearTimeout(existing.timer);
    const timer = setTimeout(() => void this.flush(month), this.deps.debounceMs);
    this.pending.set(month, { doc, base, timer });
  }

  private async flush(month: string, attempt = 0): Promise<void> {
    const p = this.pending.get(month);
    if (!p) return;
    p.timer = null;
    this.deps.onStatus?.("saving");
    try {
      const result = await this.deps.putMonth(month, p.doc.data, p.doc.sha);
      // success: update base + sha, clear pending
      this.pending.set(month, { doc: { data: p.doc.data, sha: result.sha }, base: p.doc.data, timer: null });
      this.deps.onStatus?.("saved");
    } catch (err) {
      if (err instanceof GitHubError && err.status === 409) {
        // conflict: pull, merge, retry
        const remote = await this.deps.getMonth(month);
        const merged = mergeMonths(p.base, p.doc.data, remote.data);
        this.pending.set(month, { doc: { data: merged, sha: remote.sha }, base: remote.data, timer: null });
        return this.flush(month, attempt);
      }
      if (err instanceof GitHubError && err.status >= 500 && attempt < 3) {
        await new Promise((r) => setTimeout(r, this.retryDelayMs * 2 ** attempt));
        return this.flush(month, attempt + 1);
      }
      this.deps.onStatus?.("error", err as Error);
      throw err;
    }
  }

  // for tests: drain all pending
  async drain(): Promise<void> {
    for (const month of [...this.pending.keys()]) {
      await this.flush(month);
    }
  }

  getPending(month: string): MonthDoc | undefined {
    return this.pending.get(month)?.doc;
  }
}
```

- [ ] **Step 4：跑测试**

```bash
pnpm test tests/unit/sync.test.ts
```

预期：3 个 PASS。

- [ ] **Step 5：commit**

```bash
git add src/lib/sync.ts tests/unit/sync.test.ts
git commit -m "feat(lib): sync engine with debounce + 409 merge + retry"
```

---

## Task 12：useStore composable（store.ts）

把 `auth + idb + github + sync` 串起来，组件只用这一个 hook。

**Files:**
- Create: `src/lib/store.ts`

- [ ] **Step 1：写实现**

```ts
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
  selectedDate: string;            // YYYY-MM-DD
  months: Record<string, MonthDoc>;  // key: YYYY-MM
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
      client = null; sync = null; return;
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
    client = null; sync = null;
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
    const doc = state.months[m]; if (!doc) return;
    const day = doc.data.days[state.selectedDate]; if (!day) return;
    day.entries = day.entries.filter((e) => e.id !== id);
    state.months[m] = { ...doc };
    void idb.cacheMonth(m, doc);
    sync?.scheduleSave(m, doc);
  }

  function newEntry(start: string, end: string): Entry {
    const now = new Date().toISOString();
    return {
      id: newId(),
      start, end, text: "", tagId: null,
      createdAt: now, updatedAt: now,
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
```

- [ ] **Step 2：先不写专门的 store 测试**

`store.ts` 主要是粘合 + Vue reactive，下面通过组件测试和 e2e 测试覆盖。如果担心，可以补一个 store 单测验证 upsert/delete 的 sha 更新——但 Plan 1 我们靠 e2e 兜底。

- [ ] **Step 3：跑全套确认无破坏**

```bash
pnpm test
```

预期：所有现有测试 PASS。

- [ ] **Step 4：commit**

```bash
git add src/lib/store.ts
git commit -m "feat(lib): useStore composable wiring auth+sync+idb"
```

---

## Task 13：全局 CSS theme

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1：扩展 styles.css 加入设计 token**

```css
:root {
  --bg: #fafafa;
  --bg-elevated: #fff;
  --border: #ececec;
  --border-strong: #d8d8d8;
  --text: #2b2b2b;
  --text-muted: #6a6a6a;
  --text-faint: #a8a8a8;
  --accent: #5a8dee;
  --color-default: #6a6a6a;
  --radius: 6px;
  --shadow-sm: 0 1px 2px rgba(0,0,0,.05);
}

* { box-sizing: border-box; }
html, body, #app { margin: 0; padding: 0; height: 100%; }
body {
  font-family: -apple-system, "PingFang SC", "Helvetica Neue", sans-serif;
  font-size: 14px;
  color: var(--text);
  background: var(--bg);
}
button {
  font: inherit; cursor: pointer; padding: 6px 12px;
  border: 1px solid var(--border-strong); background: var(--bg-elevated);
  border-radius: var(--radius);
}
button:hover { border-color: var(--accent); }
input, textarea {
  font: inherit; padding: 6px 8px;
  border: 1px solid var(--border-strong); border-radius: 4px;
  background: var(--bg-elevated); color: var(--text);
}
input:focus, textarea:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
```

- [ ] **Step 2：commit**

```bash
git add src/styles.css
git commit -m "style: design token base"
```

---

## Task 14：TopBar + DateNav

**Files:**
- Create: `src/components/TopBar.vue`, `src/components/DateNav.vue`

- [ ] **Step 1：DateNav.vue**

```vue
<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "@/lib/store";
import { addDays, formatYMD, parseYMD } from "@/lib/date";

const store = useStore();

const label = computed(() => {
  const d = parseYMD(store.state.selectedDate);
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric", month: "long", day: "numeric", weekday: "short",
  }).format(d);
});

function shift(n: number) {
  store.selectDate(formatYMD(addDays(parseYMD(store.state.selectedDate), n)));
}
function today() {
  store.selectDate(formatYMD(new Date()));
}
</script>

<template>
  <div class="datenav">
    <button @click="shift(-1)" aria-label="前一天">‹</button>
    <span class="label">{{ label }}</span>
    <button @click="shift(1)" aria-label="后一天">›</button>
    <button class="today" @click="today">今天</button>
  </div>
</template>

<style scoped>
.datenav { display: flex; align-items: center; gap: 8px; }
.label { min-width: 200px; text-align: center; font-weight: 500; }
.today { margin-left: 12px; }
</style>
```

- [ ] **Step 2：TopBar.vue**

```vue
<script setup lang="ts">
import DateNav from "./DateNav.vue";
import { useStore } from "@/lib/store";
import { computed } from "vue";

const store = useStore();
const userLabel = computed(() =>
  store.state.auth.kind === "logged-in" ? store.state.auth.user.login : "",
);
const syncLabel = computed(() => {
  const s = store.state.syncStatus;
  if (s.kind === "saving") return "保存中…";
  if (s.kind === "saved") return "已保存";
  if (s.kind === "error") return "保存失败";
  return "";
});
</script>

<template>
  <header class="topbar">
    <div class="left">
      <strong class="brand">📓 dairybook</strong>
    </div>
    <div class="center"><DateNav /></div>
    <div class="right">
      <span class="sync">{{ syncLabel }}</span>
      <span class="user" v-if="userLabel">@{{ userLabel }}</span>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  display: grid; grid-template-columns: 1fr auto 1fr;
  align-items: center; padding: 12px 20px;
  background: var(--bg-elevated); border-bottom: 1px solid var(--border);
}
.left { justify-self: start; }
.center { justify-self: center; }
.right { justify-self: end; display: flex; gap: 12px; align-items: center; color: var(--text-muted); }
.brand { font-size: 16px; }
.sync { font-size: 12px; }
</style>
```

- [ ] **Step 3：commit**

```bash
git add src/components/TopBar.vue src/components/DateNav.vue
git commit -m "feat(ui): TopBar + DateNav"
```

---

## Task 15：MiniCalendar

**Files:**
- Create: `src/components/MiniCalendar.vue`

- [ ] **Step 1：实现**

```vue
<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "@/lib/store";
import { formatYMD, monthOf, parseYMD } from "@/lib/date";

const store = useStore();

const grid = computed(() => {
  const sel = parseYMD(store.state.selectedDate);
  const year = sel.getUTCFullYear();
  const month = sel.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1));
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const startWeekday = first.getUTCDay();             // 0=Sun
  const cells: { ymd: string | null; day: number | null }[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push({ ymd: null, day: null });
  for (let d = 1; d <= lastDay; d++) {
    const date = new Date(Date.UTC(year, month, d));
    cells.push({ ymd: formatYMD(date), day: d });
  }
  return cells;
});

const monthLabel = computed(() => {
  const d = parseYMD(store.state.selectedDate);
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long" }).format(d);
});

function hasEntries(ymd: string): boolean {
  const m = monthOf(ymd);
  return (store.state.months[m]?.data.days[ymd]?.entries.length ?? 0) > 0;
}
</script>

<template>
  <div class="cal">
    <div class="cal-head">{{ monthLabel }}</div>
    <div class="cal-row cal-weekdays">
      <span v-for="w in ['日','一','二','三','四','五','六']" :key="w">{{ w }}</span>
    </div>
    <div class="cal-grid">
      <button
        v-for="(c, i) in grid"
        :key="i"
        class="cell"
        :class="{
          'cell-empty': !c.ymd,
          'cell-selected': c.ymd === store.state.selectedDate,
          'cell-has': c.ymd && hasEntries(c.ymd),
        }"
        :disabled="!c.ymd"
        @click="c.ymd && store.selectDate(c.ymd)"
      >
        {{ c.day ?? '' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.cal { padding: 12px; }
.cal-head { font-weight: 500; margin-bottom: 8px; }
.cal-weekdays { display: grid; grid-template-columns: repeat(7,1fr); font-size: 11px; color: var(--text-faint); margin-bottom: 4px; }
.cal-weekdays span { text-align: center; }
.cal-grid { display: grid; grid-template-columns: repeat(7,1fr); gap: 2px; }
.cell {
  aspect-ratio: 1; padding: 0; border: none; background: transparent;
  border-radius: 4px; font-size: 13px; color: var(--text);
  position: relative;
}
.cell:hover { background: var(--border); }
.cell-empty { visibility: hidden; }
.cell-selected { background: var(--accent); color: #fff; }
.cell-has::after {
  content: ""; width: 4px; height: 4px; border-radius: 50%;
  background: var(--accent); position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%);
}
.cell-selected.cell-has::after { background: #fff; }
</style>
```

- [ ] **Step 2：commit**

```bash
git add src/components/MiniCalendar.vue
git commit -m "feat(ui): MiniCalendar with entry indicator dots"
```

---

## Task 16：EntryCard

**Files:**
- Create: `src/components/EntryCard.vue`

- [ ] **Step 1：实现**

```vue
<script setup lang="ts">
import type { Entry } from "@/lib/types";

defineProps<{ entry: Entry }>();
defineEmits<{ click: [Entry] }>();
</script>

<template>
  <button class="card" @click="$emit('click', entry)">
    <span class="bar" :style="{ background: 'var(--color-default)' }" />
    <span class="time">{{ entry.start }}–{{ entry.end }}</span>
    <span class="text">{{ entry.text || '（空）' }}</span>
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
.time { color: var(--text-muted); font-variant-numeric: tabular-nums; min-width: 92px; }
.text { color: var(--text); flex: 1; }
</style>
```

- [ ] **Step 2：commit**

```bash
git add src/components/EntryCard.vue
git commit -m "feat(ui): EntryCard"
```

---

## Task 17：Timeline

时间网格 + 投影 entry。把 entry 按 start 投到对应的 grid row，跨小时用 `grid-row: span N`，时段重叠的多条用并排 columns。

**Files:**
- Create: `src/components/Timeline.vue`, `tests/component/Timeline.test.ts`

- [ ] **Step 1：先写组件测试**

`tests/component/Timeline.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import Timeline from "@/components/Timeline.vue";
import { useStore, _resetStore } from "@/lib/store";
import { makeEntry } from "../fixtures/month";

function setup(entries = [makeEntry({ id: "a", start: "09:00", end: "10:30" })]) {
  _resetStore();
  const store = useStore();
  store.state.selectedDate = "2026-05-07";
  store.state.months["2026-05"] = {
    data: {
      version: 1,
      month: "2026-05",
      days: { "2026-05-07": { entries } },
    },
    sha: null,
  };
  return store;
}

describe("Timeline", () => {
  it("renders 24 hour rows", () => {
    setup([]);
    const w = mount(Timeline);
    expect(w.findAll(".hour-row")).toHaveLength(24);
  });

  it("places entry into hour grid spanning correct rows", () => {
    setup([makeEntry({ id: "a", start: "09:00", end: "10:30" })]);
    const w = mount(Timeline);
    const card = w.find('[data-entry-id="a"]');
    expect(card.attributes("style")).toMatch(/grid-row:\s*19\s*\/\s*22/); // 30-min cells: 9*2+1=19 to 10:30→22
  });

  it("places overlapping entries side by side", () => {
    setup([
      makeEntry({ id: "a", start: "09:00", end: "10:00" }),
      makeEntry({ id: "b", start: "09:30", end: "10:30" }),
    ]);
    const w = mount(Timeline);
    const a = w.find('[data-entry-id="a"]');
    const b = w.find('[data-entry-id="b"]');
    expect(a.attributes("style")).toMatch(/grid-column:\s*1/);
    expect(b.attributes("style")).toMatch(/grid-column:\s*2/);
  });
});
```

- [ ] **Step 2：跑，FAIL**

- [ ] **Step 3：实现 Timeline.vue**

```vue
<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "@/lib/store";
import EntryCard from "./EntryCard.vue";
import type { Entry } from "@/lib/types";

const store = useStore();

const entries = computed(() => store.entriesForSelectedDate());

// Convert "HH:MM" to half-hour slot index 0..47, then to grid row 1..49
function timeToRow(t: string, isEnd = false): number {
  const [h, m] = t.split(":").map(Number);
  const slot = h * 2 + (m >= 30 ? 1 : 0);
  // grid rows are 1-indexed; end row is exclusive
  return slot + 1 + (isEnd && m % 30 !== 0 ? 1 : 0);
}

interface Placed extends Entry { col: number; cols: number }

const placed = computed<Placed[]>(() => {
  // greedy column assignment for overlapping entries
  const sorted = [...entries.value].sort((a, b) => a.start.localeCompare(b.start));
  const lanes: { end: string }[] = [];
  const result: Placed[] = [];
  for (const e of sorted) {
    let col = lanes.findIndex((l) => l.end <= e.start);
    if (col < 0) { lanes.push({ end: e.end }); col = lanes.length - 1; }
    else lanes[col] = { end: e.end };
    result.push({ ...e, col, cols: 0 });
  }
  // total columns is current lane count
  const cols = lanes.length || 1;
  return result.map((p) => ({ ...p, cols }));
});

const totalCols = computed(() => Math.max(...placed.value.map((p) => p.cols), 1));

const hours = Array.from({ length: 24 }, (_, h) => h);

function entryStyle(p: Placed): string {
  const startRow = timeToRow(p.start);
  const endRow = timeToRow(p.end, true);
  return `grid-row: ${startRow} / ${endRow}; grid-column: ${p.col + 1};`;
}

function emitEdit(_e: Entry) { /* wired by parent via slot? Plan 1 keep it simple */ }
</script>

<template>
  <div class="timeline" :style="{ '--cols': totalCols }">
    <div class="hours">
      <div v-for="h in hours" :key="h" class="hour-row" :style="`grid-row: ${h * 2 + 1} / span 2`">
        {{ String(h).padStart(2, '0') }}:00
      </div>
    </div>
    <div class="entries">
      <div
        v-for="p in placed"
        :key="p.id"
        class="entry-slot"
        :data-entry-id="p.id"
        :style="entryStyle(p)"
      >
        <EntryCard :entry="p" @click="emitEdit" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.timeline {
  display: grid;
  grid-template-columns: 56px 1fr;
  gap: 8px;
  padding: 12px 20px;
}
.hours {
  display: grid;
  grid-template-rows: repeat(48, 18px);
  font-size: 11px;
  color: var(--text-faint);
}
.hour-row { padding-top: 0; }
.entries {
  display: grid;
  grid-template-rows: repeat(48, 18px);
  grid-template-columns: repeat(var(--cols, 1), 1fr);
  gap: 2px;
  position: relative;
}
.entries::before {
  content: ""; position: absolute; inset: 0;
  background-image: repeating-linear-gradient(0deg, var(--border) 0 1px, transparent 1px 36px);
  pointer-events: none; z-index: 0;
}
.entry-slot { z-index: 1; }
</style>
```

- [ ] **Step 4：跑测试**

```bash
pnpm test tests/component/Timeline.test.ts
```

预期：3 个 PASS。如有失败，注意 `timeToRow` 的整 30 分钟边界——本实现在 `m >= 30` 落到下半小时槽位，结束时间 10:30 = h=10 m=30 → slot=21 → row=22。

- [ ] **Step 5：commit**

```bash
git add src/components/Timeline.vue tests/component/Timeline.test.ts
git commit -m "feat(ui): Timeline with 24h grid, overlapping lanes, span"
```

---

## Task 18：EntryEditor

**Files:**
- Create: `src/components/EntryEditor.vue`, `tests/component/EntryEditor.test.ts`

- [ ] **Step 1：写组件测试**

`tests/component/EntryEditor.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import EntryEditor from "@/components/EntryEditor.vue";
import { makeEntry } from "../fixtures/month";

describe("EntryEditor", () => {
  it("disables save when end < start", async () => {
    const w = mount(EntryEditor, {
      props: { entry: makeEntry({ start: "10:00", end: "09:00" }) },
    });
    const saveBtn = w.find('button[data-action="save"]');
    expect(saveBtn.attributes("disabled")).toBeDefined();
  });

  it("emits 'save' with patched entry on save", async () => {
    const w = mount(EntryEditor, {
      props: { entry: makeEntry({ id: "a", text: "old" }) },
    });
    await w.find("textarea").setValue("new text");
    await w.find('button[data-action="save"]').trigger("click");
    const e = w.emitted("save")?.[0]?.[0] as any;
    expect(e.id).toBe("a");
    expect(e.text).toBe("new text");
  });

  it("emits 'delete' on delete click", async () => {
    const w = mount(EntryEditor, { props: { entry: makeEntry({ id: "a" }) } });
    await w.find('button[data-action="delete"]').trigger("click");
    expect(w.emitted("delete")).toBeTruthy();
  });
});
```

- [ ] **Step 2：跑，FAIL**

- [ ] **Step 3：实现 EntryEditor.vue**

```vue
<script setup lang="ts">
import { ref, computed, watch } from "vue";
import type { Entry } from "@/lib/types";
import { isValidTime, compareTimes } from "@/lib/date";

const props = defineProps<{ entry: Entry }>();
const emit = defineEmits<{
  save: [Entry];
  delete: [];
  cancel: [];
}>();

const start = ref(props.entry.start);
const end = ref(props.entry.end);
const text = ref(props.entry.text);

watch(() => props.entry, (e) => { start.value = e.start; end.value = e.end; text.value = e.text; });

const valid = computed(() =>
  isValidTime(start.value) && isValidTime(end.value) && compareTimes(start.value, end.value) <= 0,
);

function save() {
  if (!valid.value) return;
  emit("save", {
    ...props.entry,
    start: start.value,
    end: end.value,
    text: text.value,
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
    <textarea v-model="text" rows="6" placeholder="今天 09–10 做了什么…" />
    <div class="actions">
      <button data-action="delete" class="danger" @click="$emit('delete')">删除</button>
      <span class="spacer" />
      <button data-action="cancel" @click="$emit('cancel')">取消</button>
      <button data-action="save" class="primary" :disabled="!valid" @click="save">保存</button>
    </div>
  </div>
</template>

<style scoped>
.editor { padding: 16px; min-width: 320px; }
.row { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; }
.row input { width: 80px; }
textarea { width: 100%; resize: vertical; font-family: ui-monospace, "SF Mono", Menlo, monospace; }
.actions { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
.spacer { flex: 1; }
.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.primary:disabled { opacity: .4; cursor: not-allowed; }
.danger { color: #c0392b; }
</style>
```

- [ ] **Step 4：跑测试**

```bash
pnpm test tests/component/EntryEditor.test.ts
```

预期：3 个 PASS。

- [ ] **Step 5：commit**

```bash
git add src/components/EntryEditor.vue tests/component/EntryEditor.test.ts
git commit -m "feat(ui): EntryEditor with time validation"
```

---

## Task 19：QuickAdd

**Files:**
- Create: `src/components/QuickAdd.vue`, `tests/component/QuickAdd.test.ts`

- [ ] **Step 1：写测试**

`tests/component/QuickAdd.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import QuickAdd from "@/components/QuickAdd.vue";

describe("QuickAdd", () => {
  it("emits 'add' with default 1h slot from clicked hour", async () => {
    const w = mount(QuickAdd, { props: { hour: 14 } });
    await w.find("button").trigger("click");
    const arg = w.emitted("add")?.[0]?.[0] as any;
    expect(arg).toEqual({ start: "14:00", end: "15:00" });
  });

  it("clamps end at 24:00 when hour=23", async () => {
    const w = mount(QuickAdd, { props: { hour: 23 } });
    await w.find("button").trigger("click");
    const arg = w.emitted("add")?.[0]?.[0] as any;
    expect(arg).toEqual({ start: "23:00", end: "23:59" });
  });
});
```

- [ ] **Step 2：FAIL → 实现 QuickAdd.vue**

```vue
<script setup lang="ts">
const props = defineProps<{ hour: number }>();
const emit = defineEmits<{ add: [{ start: string; end: string }] }>();

function pad(n: number): string { return String(n).padStart(2, "0"); }

function handle() {
  const start = `${pad(props.hour)}:00`;
  const end = props.hour === 23 ? "23:59" : `${pad(props.hour + 1)}:00`;
  emit("add", { start, end });
}
</script>

<template>
  <button class="add-btn" @click.stop="handle" aria-label="添加">+</button>
</template>

<style scoped>
.add-btn {
  position: absolute; right: 6px; top: 6px;
  width: 22px; height: 22px; padding: 0; border-radius: 50%;
  border: 1px dashed var(--border-strong);
  background: transparent; color: var(--text-muted);
  opacity: 0; transition: opacity .15s;
}
.hour-cell:hover .add-btn { opacity: 1; }
.add-btn:hover { color: var(--accent); border-color: var(--accent); }
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
git commit -m "feat(ui): QuickAdd"
```

---

## Task 20：LoginPanel（Device Flow UI）

**Files:**
- Create: `src/components/LoginPanel.vue`

- [ ] **Step 1：实现**

```vue
<script setup lang="ts">
import { ref } from "vue";
import { startDeviceFlow, pollForToken } from "@/lib/auth";
import { useStore } from "@/lib/store";

const store = useStore();
const userCode = ref<string | null>(null);
const verifyUrl = ref("");
const polling = ref(false);
const error = ref<string | null>(null);

const CLIENT_ID = import.meta.env.VITE_GH_APP_CLIENT_ID as string;

async function login() {
  error.value = null;
  try {
    const start = await startDeviceFlow(CLIENT_ID);
    userCode.value = start.userCode;
    verifyUrl.value = start.verificationUri;
    window.open(start.verificationUri, "_blank");
    polling.value = true;
    const token = await pollForToken(CLIENT_ID, start.deviceCode, {
      intervalSec: start.interval,
      maxTries: Math.ceil(start.expiresIn / start.interval),
    });
    polling.value = false;
    if (!token) { error.value = "登录已取消或过期，请重试"; return; }
    await store.setLoggedIn(token);
  } catch (e) {
    error.value = (e as Error).message;
    polling.value = false;
  }
}

function copyCode() {
  if (userCode.value) navigator.clipboard.writeText(userCode.value);
}
</script>

<template>
  <div class="login">
    <h2>用 GitHub 登录</h2>
    <p>dairybook 不在自己的服务器上保存任何数据，登录用于把日程写入你自己的私有仓库。</p>
    <button v-if="!userCode" @click="login" class="primary">登录</button>

    <div v-else class="device">
      <p>1. 复制下面的码：</p>
      <div class="code">
        <code>{{ userCode }}</code>
        <button @click="copyCode">复制</button>
      </div>
      <p>2. 已为你打开 <a :href="verifyUrl" target="_blank">{{ verifyUrl }}</a>，粘贴后授权</p>
      <p v-if="polling" class="muted">等待你完成授权… 完成后这里会自动跳转。</p>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<style scoped>
.login { max-width: 480px; margin: 80px auto; padding: 24px; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius); }
.code { display: flex; gap: 8px; align-items: center; }
.code code { font-size: 20px; font-family: ui-monospace, monospace; padding: 6px 10px; background: var(--bg); border: 1px solid var(--border-strong); border-radius: 4px; }
.muted { color: var(--text-muted); font-size: 13px; }
.error { color: #c0392b; }
.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
</style>
```

- [ ] **Step 2：commit**

```bash
git add src/components/LoginPanel.vue
git commit -m "feat(ui): LoginPanel with device flow"
```

---

## Task 21：OnboardingPanel（仓库未就绪）

**Files:**
- Create: `src/components/OnboardingPanel.vue`

- [ ] **Step 1：实现**

```vue
<script setup lang="ts">
import { useStore } from "@/lib/store";
import { ref } from "vue";

const store = useStore();
const checking = ref(false);

const TEMPLATE_URL = import.meta.env.VITE_DATA_REPO_TEMPLATE as string;
const APP_INSTALL_URL = import.meta.env.VITE_GH_APP_INSTALL_URL as string;

async function recheck() {
  if (store.state.auth.kind !== "logged-in") return;
  checking.value = true;
  await store.setLoggedIn(store.state.auth.token);
  checking.value = false;
}
</script>

<template>
  <div class="onboard">
    <h2>还差最后一步</h2>
    <p>dairybook 需要一个属于你自己的私有仓库 <code>dairybook-data</code> 来存日程。</p>
    <ol>
      <li>
        从模板创建仓库（保持私有）：
        <a :href="TEMPLATE_URL" target="_blank">点这里 →</a>
      </li>
      <li>
        把 dairybook GitHub App 安装到这个新仓库上：
        <a :href="APP_INSTALL_URL" target="_blank">安装 App →</a>
      </li>
      <li>
        回到这里点
        <button @click="recheck" :disabled="checking">
          {{ checking ? "检查中…" : "检查就绪" }}
        </button>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.onboard { max-width: 560px; margin: 80px auto; padding: 24px; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius); }
ol { line-height: 2; }
code { background: var(--bg); padding: 1px 6px; border-radius: 3px; }
</style>
```

- [ ] **Step 2：commit**

```bash
git add src/components/OnboardingPanel.vue
git commit -m "feat(ui): OnboardingPanel for repo setup"
```

---

## Task 22：组装 App.vue + entry 编辑流

**Files:**
- Modify: `src/App.vue`, `src/main.ts`

- [ ] **Step 1：替换 App.vue**

```vue
<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useStore } from "@/lib/store";
import TopBar from "@/components/TopBar.vue";
import MiniCalendar from "@/components/MiniCalendar.vue";
import Timeline from "@/components/Timeline.vue";
import EntryEditor from "@/components/EntryEditor.vue";
import LoginPanel from "@/components/LoginPanel.vue";
import OnboardingPanel from "@/components/OnboardingPanel.vue";
import type { Entry } from "@/lib/types";

const store = useStore();
const editing = ref<Entry | null>(null);

onMounted(() => store.bootFromCache());

const view = computed(() => {
  if (store.state.auth.kind === "anonymous") return "login";
  if (store.state.repo.kind === "missing") return "onboard";
  return "main";
});

function openEditor(e: Entry) { editing.value = e; }
function closeEditor() { editing.value = null; }
function newEntryAt(start: string, end: string) {
  editing.value = store.newEntry(start, end);
}
function onSave(e: Entry) { store.upsertEntry(e); editing.value = null; }
function onDelete() {
  if (editing.value) store.deleteEntry(editing.value.id);
  editing.value = null;
}
</script>

<template>
  <LoginPanel v-if="view === 'login'" />
  <OnboardingPanel v-else-if="view === 'onboard'" />
  <div v-else class="layout">
    <TopBar />
    <aside class="side">
      <MiniCalendar />
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
  </div>
</template>

<style scoped>
.layout { display: grid; grid-template-rows: auto 1fr; grid-template-columns: 280px 1fr; height: 100vh; }
.layout > :deep(header) { grid-column: 1 / 3; }
.side { border-right: 1px solid var(--border); background: var(--bg-elevated); overflow-y: auto; }
.main { overflow-y: auto; }
.quick { padding: 12px; border-top: 1px solid var(--border); }
.modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,.3); display: grid; place-items: center; z-index: 100; }
.modal { background: var(--bg-elevated); border-radius: var(--radius); box-shadow: 0 10px 30px rgba(0,0,0,.2); }

@media (max-width: 720px) {
  .layout { grid-template-columns: 1fr; }
  .side { display: none; }
}
</style>
```

- [ ] **Step 2：把 Timeline 的点击信号接出来**

修改 `src/components/Timeline.vue`，把 `function emitEdit(_e: Entry) { /* ... */ }` 整段删除，改为 `defineEmits` + 透传 EntryCard 的 click。完整新版本：

```vue
<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "@/lib/store";
import EntryCard from "./EntryCard.vue";
import type { Entry } from "@/lib/types";

const store = useStore();
const emit = defineEmits<{ "click-entry": [Entry] }>();

const entries = computed(() => store.entriesForSelectedDate());

function timeToRow(t: string, isEnd = false): number {
  const [h, m] = t.split(":").map(Number);
  const slot = h * 2 + (m >= 30 ? 1 : 0);
  return slot + 1 + (isEnd && m % 30 !== 0 ? 1 : 0);
}

interface Placed extends Entry { col: number; cols: number }

const placed = computed<Placed[]>(() => {
  const sorted = [...entries.value].sort((a, b) => a.start.localeCompare(b.start));
  const lanes: { end: string }[] = [];
  const result: Placed[] = [];
  for (const e of sorted) {
    let col = lanes.findIndex((l) => l.end <= e.start);
    if (col < 0) { lanes.push({ end: e.end }); col = lanes.length - 1; }
    else lanes[col] = { end: e.end };
    result.push({ ...e, col, cols: 0 });
  }
  const cols = lanes.length || 1;
  return result.map((p) => ({ ...p, cols }));
});

const totalCols = computed(() => Math.max(...placed.value.map((p) => p.cols), 1));
const hours = Array.from({ length: 24 }, (_, h) => h);

function entryStyle(p: Placed): string {
  const startRow = timeToRow(p.start);
  const endRow = timeToRow(p.end, true);
  return `grid-row: ${startRow} / ${endRow}; grid-column: ${p.col + 1};`;
}
</script>

<template>
  <div class="timeline" :style="{ '--cols': totalCols }">
    <div class="hours">
      <div v-for="h in hours" :key="h" class="hour-row" :style="`grid-row: ${h * 2 + 1} / span 2`">
        {{ String(h).padStart(2, '0') }}:00
      </div>
    </div>
    <div class="entries">
      <div
        v-for="p in placed"
        :key="p.id"
        class="entry-slot"
        :data-entry-id="p.id"
        :style="entryStyle(p)"
      >
        <EntryCard :entry="p" @click="emit('click-entry', p)" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 同 Task 17 */
.timeline {
  display: grid;
  grid-template-columns: 56px 1fr;
  gap: 8px;
  padding: 12px 20px;
}
.hours {
  display: grid;
  grid-template-rows: repeat(48, 18px);
  font-size: 11px;
  color: var(--text-faint);
}
.entries {
  display: grid;
  grid-template-rows: repeat(48, 18px);
  grid-template-columns: repeat(var(--cols, 1), 1fr);
  gap: 2px;
  position: relative;
}
.entries::before {
  content: ""; position: absolute; inset: 0;
  background-image: repeating-linear-gradient(0deg, var(--border) 0 1px, transparent 1px 36px);
  pointer-events: none; z-index: 0;
}
.entry-slot { z-index: 1; }
</style>
```

- [ ] **Step 3：env 占位**

新建 `.env.example`：

```
VITE_GH_APP_CLIENT_ID=Iv23liYOURCLIENTID
VITE_DATA_REPO_TEMPLATE=https://github.com/<owner>/dairybook-data-template/generate
VITE_GH_APP_INSTALL_URL=https://github.com/apps/dairybook/installations/new
```

`.gitignore` 追加：

```
.env
.env.local
```

- [ ] **Step 4：本地跑通**

```bash
cp .env.example .env  # 然后填入测试值
pnpm dev
```

预期：未配置真实 GitHub App 时点登录会报 fetch 错；UI 渲染流程能走通即可。

- [ ] **Step 5：跑全套单测 + 组件测试**

```bash
pnpm test
```

预期：所有现有测试通过。

- [ ] **Step 6：commit**

```bash
git add src/App.vue src/components/Timeline.vue .env.example .gitignore
git commit -m "feat(app): wire entry edit flow + responsive layout"
```

---

## Task 23：Playwright 配置 + 登录 e2e

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/login.spec.ts`, `tests/e2e/_mocks.ts`

- [ ] **Step 1：装 Playwright 浏览器**

```bash
pnpm exec playwright install chromium
```

- [ ] **Step 2：写 playwright.config.ts**

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev",
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
});
```

- [ ] **Step 3：写 mock helper**

`tests/e2e/_mocks.ts`：

```ts
import type { Page } from "@playwright/test";

export async function mockGitHub(page: Page, opts: {
  monthData?: Record<string, unknown>;
  monthSha?: string;
  user?: string;
  token?: string;
} = {}) {
  const user = opts.user ?? "alice";
  const token = opts.token ?? "ghu_test_token";
  const monthSha = opts.monthSha ?? "sha-abc";

  await page.route("https://github.com/login/device/code", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        device_code: "DC-MOCK",
        user_code: "TEST-CODE",
        verification_uri: "https://github.com/login/device",
        expires_in: 900,
        interval: 1,
      }),
    }),
  );

  await page.route("https://github.com/login/oauth/access_token", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ access_token: token, token_type: "bearer" }),
    }),
  );

  await page.route("https://api.github.com/user", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ login: user }),
    }),
  );

  await page.route(`https://api.github.com/repos/${user}/dairybook-data`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ name: "dairybook-data", private: true }),
    }),
  );

  let currentSha = monthSha;
  let currentData = opts.monthData ?? { version: 1, month: "2026-05", days: {} };

  await page.route(/api\.github\.com\/repos\/[^/]+\/dairybook-data\/contents\/data\/.+\.json/, async (route) => {
    if (route.request().method() === "GET") {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          sha: currentSha,
          encoding: "base64",
          content: btoa(JSON.stringify(currentData)),
        }),
      });
    } else {
      const body = JSON.parse(route.request().postData() ?? "{}");
      currentData = JSON.parse(atob(body.content));
      currentSha = `sha-${Date.now()}`;
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ content: { sha: currentSha } }),
      });
    }
  });
}
```

- [ ] **Step 4：写 login.spec.ts**

```ts
import { test, expect } from "@playwright/test";
import { mockGitHub } from "./_mocks";

test("first-time login flows through device code to main view", async ({ page }) => {
  await mockGitHub(page);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "登录" })).toBeVisible();
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByText("TEST-CODE")).toBeVisible();
  // mock auto-grants → polling will succeed; wait for main view
  await expect(page.locator(".timeline")).toBeVisible({ timeout: 5000 });
});
```

- [ ] **Step 5：跑**

```bash
pnpm test:e2e tests/e2e/login.spec.ts
```

预期：1 个 PASS。

- [ ] **Step 6：commit**

```bash
git add playwright.config.ts tests/e2e/login.spec.ts tests/e2e/_mocks.ts
git commit -m "test(e2e): playwright login flow"
```

---

## Task 24：写入 e2e

**Files:**
- Create: `tests/e2e/write.spec.ts`

- [ ] **Step 1：实现**

```ts
import { test, expect } from "@playwright/test";
import { mockGitHub } from "./_mocks";

test("create entry → debounce save → reload sees it", async ({ page }) => {
  await mockGitHub(page);
  await page.goto("/");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.locator(".timeline")).toBeVisible();

  await page.getByRole("button", { name: /\+ 新增条目/ }).click();
  await page.locator("textarea").fill("测试 e2e 写入");
  await page.getByRole("button", { name: "保存" }).click();

  // wait for sync to flush
  await expect(page.getByText("已保存")).toBeVisible({ timeout: 5000 });

  // reload, expect entry to be there
  await page.reload();
  await expect(page.getByText("测试 e2e 写入")).toBeVisible();
});
```

- [ ] **Step 2：跑**

```bash
pnpm test:e2e tests/e2e/write.spec.ts
```

预期：PASS。

- [ ] **Step 3：commit**

```bash
git add tests/e2e/write.spec.ts
git commit -m "test(e2e): write + reload roundtrip"
```

---

## Task 25：冲突 e2e

**Files:**
- Create: `tests/e2e/conflict.spec.ts`

- [ ] **Step 1：实现（模拟首个 PUT 返 409，第二次成功；同时 GET 返回另一台设备的 entry）**

```ts
import { test, expect } from "@playwright/test";

test("409 on save → fetch remote → merge → re-PUT keeps both entries", async ({ page }) => {
  // hand-rolled mock instead of helper, because we need PUT count tracking
  let putCount = 0;
  let currentSha = "sha-base";
  const remoteEntry = {
    id: "01REMOTE0000000000000000000",
    start: "11:00",
    end: "12:00",
    text: "来自另一台设备",
    tagId: null,
    createdAt: "2026-05-07T11:00:00Z",
    updatedAt: "2026-05-07T11:00:00Z",
  };

  await page.route("https://github.com/login/device/code", (r) =>
    r.fulfill({ contentType: "application/json", body: JSON.stringify({
      device_code: "DC", user_code: "TC", verification_uri: "https://x", expires_in: 900, interval: 1,
    })}));
  await page.route("https://github.com/login/oauth/access_token", (r) =>
    r.fulfill({ contentType: "application/json", body: JSON.stringify({ access_token: "ghu_x", token_type: "bearer" })}));
  await page.route("https://api.github.com/user", (r) =>
    r.fulfill({ contentType: "application/json", body: JSON.stringify({ login: "alice" })}));
  await page.route("https://api.github.com/repos/alice/dairybook-data", (r) =>
    r.fulfill({ contentType: "application/json", body: JSON.stringify({ name: "dairybook-data" })}));

  await page.route(/contents\/data\/.+\.json/, async (route) => {
    if (route.request().method() === "GET") {
      // After conflict, remote contains the remote entry
      const body = putCount >= 1
        ? { version: 1, month: "2026-05", days: { "2026-05-07": { entries: [remoteEntry] } } }
        : { version: 1, month: "2026-05", days: {} };
      currentSha = `sha-${putCount}`;
      route.fulfill({ contentType: "application/json", body: JSON.stringify({
        sha: currentSha, encoding: "base64", content: btoa(JSON.stringify(body)),
      })});
    } else {
      putCount++;
      if (putCount === 1) {
        route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ message: "sha mismatch" })});
      } else {
        const merged = JSON.parse(atob(JSON.parse(route.request().postData()!).content));
        // verify both entries present
        const entries = merged.days["2026-05-07"].entries;
        expect(entries.length).toBe(2);
        route.fulfill({ contentType: "application/json", body: JSON.stringify({ content: { sha: "sha-merged" } })});
      }
    }
  });

  await page.goto("/");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.locator(".timeline")).toBeVisible();

  await page.getByRole("button", { name: /\+ 新增条目/ }).click();
  await page.locator("textarea").fill("本地新条目");
  await page.getByRole("button", { name: "保存" }).click();

  await expect(page.getByText("已保存")).toBeVisible({ timeout: 6000 });
  // both entries visible after merge
  await expect(page.getByText("本地新条目")).toBeVisible();
  await expect(page.getByText("来自另一台设备")).toBeVisible();
  expect(putCount).toBeGreaterThanOrEqual(2);
});
```

- [ ] **Step 2：跑**

```bash
pnpm test:e2e tests/e2e/conflict.spec.ts
```

预期：PASS。如失败排查 `mergeMonths(base, local, remote)` 的 `base` 参数——应是 sync engine 里持有的"上次同步时的 data"。

- [ ] **Step 3：commit**

```bash
git add tests/e2e/conflict.spec.ts
git commit -m "test(e2e): 409 conflict triggers 3-way merge"
```

---

## Task 26：README 与 setup 说明

**Files:**
- Create: `README.md`

- [ ] **Step 1：写 README**

```markdown
# dairybook

一个网页版日程手帐：在 24 小时网格里记录每天每个时段做了什么，多设备同步，数据存在你自己的 GitHub 私有仓库里。零后端。

## 自部署

### 1. fork 这个仓库

启用 GitHub Pages（settings → Pages → Source: GitHub Actions）。

### 2. 创建一个 GitHub App

`Settings → Developer settings → GitHub Apps → New GitHub App`：

- Homepage URL：你的 Pages URL
- 启用 **Device flow**
- Permissions：
  - Repository permissions:
    - **Contents**: Read and write
    - **Metadata**: Read-only
- Where can this be installed: Only on this account
- 创建后记下 **Client ID**

### 3. 创建 dairybook-data 模板仓库

新建一个仓库 `dairybook-data-template`（私有，作为模板）：

- 包含一个 `data/.keep` 空文件，一个简单的 `README.md`
- Settings → 勾选 **Template repository**

### 4. 配置环境变量

在仓库 Settings → Secrets and variables → Actions → Variables 加：

- `VITE_GH_APP_CLIENT_ID`: 第 2 步的 Client ID
- `VITE_DATA_REPO_TEMPLATE`: `https://github.com/<your-account>/dairybook-data-template/generate`
- `VITE_GH_APP_INSTALL_URL`: `https://github.com/apps/<your-app-name>/installations/new`

### 5. 第一次使用

打开 Pages URL → 登录 → 创建 dairybook-data 仓库（私有）→ 把 GitHub App 装到该仓库 → 回 dairybook 点"检查就绪"。

## 开发

```bash
pnpm install
cp .env.example .env  # 填入测试值
pnpm dev              # http://localhost:5173
pnpm test             # 单测 + 组件测试
pnpm test:e2e         # Playwright e2e
pnpm build            # 生产构建到 dist/
```
```

- [ ] **Step 2：commit**

```bash
git add README.md
git commit -m "docs: README + self-host setup"
```

---

## Task 27：GitHub Pages 部署 workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1：实现**

```yaml
name: Deploy
on:
  push: { branches: [main] }

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
      - name: Build
        env:
          VITE_GH_APP_CLIENT_ID: ${{ vars.VITE_GH_APP_CLIENT_ID }}
          VITE_DATA_REPO_TEMPLATE: ${{ vars.VITE_DATA_REPO_TEMPLATE }}
          VITE_GH_APP_INSTALL_URL: ${{ vars.VITE_GH_APP_INSTALL_URL }}
        run: pnpm build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2：commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: GitHub Pages deploy workflow"
```

---

## 收尾

- [ ] **Step 1：跑全套测试一次**

```bash
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```

预期：全 PASS，生成 `dist/`。

- [ ] **Step 2：用真实 GitHub App + 数据仓库走一遍 end-to-end**

参考 README 完成 GitHub App 创建与模板仓库。点登录、写一条 entry、刷新、换浏览器再登录、看到同一条 entry。

- [ ] **Step 3：在另一台设备/无痕窗口模拟并发写**

无痕窗口登录同账号，两边同时写不同时段的 entry，5 秒后回主窗口刷新——两边 entry 都应在。

- [ ] **Step 4：交付前的 final commit**

如果上面三步发现问题，修一遍重新跑测试。

```bash
git log --oneline
git push origin main
```

---

## Plan 1 完工标准

- [ ] 所有单元测试 PASS（merge 7 + auth 3 + github 5 + idb 4 + sync 3 + date 6 + id 2 + types 1 ≈ 31）
- [ ] 所有组件测试 PASS（Timeline 3 + EntryEditor 3 + QuickAdd 2 = 8）
- [ ] 所有 e2e PASS（login + write + conflict = 3）
- [ ] `pnpm build` 生成 `dist/`
- [ ] CI workflow 在 push 时绿
- [ ] Pages 上能访问、能登录、能写 entry、刷新后还在
- [ ] 双窗口同时写不丢数据

---

## Plan 2 / Plan 3 之后再做的事（提醒）

- 标签 + tags.json + 颜色编码（更新 EntryCard 的 `--color-default`）
- Markdown 渲染
- 错误状态 UI（重试按钮、离线条目数）
- 搜索 / 统计 / 导出
- 历史月份按需加载（目前 selectDate 已经触发 loadMonth，能用，但 Plan 3 做精细化预取）
