# dairybook 设计文档

> Created: 2026-05-07
> Status: Approved

## 1. 概述

dairybook 是一个网页版日程手帐：用户在 24 小时网格上记录每天每个时间段做了什么，多设备同步，数据托管在 GitHub 上，整体架构无自有服务器。

### 1.1 用户故事

作为一个想跟踪自己时间花在哪里的人，我希望能在浏览器里打开一个简单的日页，把今天 9 点到 10 点半做的事填进去，自动保存到我自己的 GitHub 仓库；明天换台电脑打开，看到的还是同一份数据。

### 1.2 目标

- 多设备实时同步，数据所有权在用户自己手上。
- 24 小时网格 + 每时段多条目（混合模式），支持跨小时与时段重叠。
- 标签 + 颜色编码、Markdown 文本、历史日期跳转、关键字搜索、周/月统计、导出 md/json。
- 完全部署在 GitHub 上（GitHub Pages + 用户的私有数据仓库），不依赖任何第三方服务。
- 首屏 ≤ 1s，离线可读已加载月份。

### 1.3 非目标（YAGNI）

明确不做的事，避免后续过度设计：

- 多用户协作 / 共享日程
- 跨午夜的单条 entry（必须拆成两条）
- 客户端加密（仓库私有 + GitHub at-rest 加密已足够）
- 富媒体上传（Markdown 内嵌图片 URL 可以，但 app 不上传图片到仓库）
- PWA / Service Worker（除非后续要装到桌面）
- 视觉回归测试

## 2. 架构总览

```
┌─ 浏览器 ──────────────────────────────────────────┐
│  Vue 3 SPA                                         │
│  ├─ access_token   → localStorage                  │
│  └─ 月数据缓存     → IndexedDB                      │
└──────────┬─────────────────────┬─────────────────┘
           │                     │
   ① 静态资源 GET          ② Contents API GET/PUT
           │                     │
┌──────────▼─────────┐  ┌────────▼──────────────┐
│ GitHub Pages       │  │ GitHub API            │
│ <user>.github.io/  │  │ api.github.com        │
│ dairybook          │  │   - device flow       │
│ (公开仓库 app)     │  │   - contents 读写     │
└────────────────────┘  └────────┬──────────────┘
                                 │
                        ┌────────▼──────────────┐
                        │ private 数据仓库       │
                        │ <user>/dairybook-data │
                        │ data/YYYY-MM.json     │
                        └───────────────────────┘
```

### 2.1 关键设计决定

- **GitHub App + Device Flow** 完成 OAuth：浏览器直接走 device flow，无需任何后端。
- **数据按月切分**（不是按天，不是整年）：平衡碎片度与多设备并发风险。
- **应用代码仓库公开**（开源 + GitHub Pages 免费），**数据仓库私有**（隐私）。
- **凭证只存 localStorage**（不是 cookie，不会被 CSRF 利用）。

## 3. 数据模型

### 3.1 数据仓库布局

```
dairybook-data/                # private
├── README.md                  # "请勿手动编辑"
├── tags.json                  # 标签字典 + 颜色
├── data/
│   ├── 2026-05.json          # 当月
│   └── 2026-04.json
└── exports/                   # md 导出（用户触发）
    └── 2026-04.md
```

### 3.2 月数据文件 `data/YYYY-MM.json`

```json
{
  "version": 1,
  "month": "2026-05",
  "days": {
    "2026-05-07": {
      "entries": [
        {
          "id": "01H...",
          "start": "09:00",
          "end":   "10:30",
          "text":  "晨读《人间词话》[第三章](https://...)",
          "tagId": "read",
          "createdAt": "2026-05-07T09:01:12Z",
          "updatedAt": "2026-05-07T09:30:45Z"
        }
      ]
    }
  }
}
```

字段约束：

- `id`：ULID，客户端生成。多设备同时新增不撞车。
- `start` / `end`：`HH:MM` 24 小时制。`start <= end`，跨午夜禁止。`start == end` 允许（打卡式 0 时长事件）。
- `text`：Markdown 字符串。渲染时关闭 raw HTML 防 XSS。
- `tagId`：可为 `null`（未分类）。引用 `tags.json` 中的某个 `id`。
- `createdAt` / `updatedAt`：ISO 8601 UTC。

### 3.3 标签文件 `tags.json`

```json
{
  "version": 1,
  "tags": [
    {
      "id": "work",
      "name": "工作",
      "color": "#5a8dee",
      "updatedAt": "2026-05-07T08:00:00Z",
      "deletedAt": null
    }
  ]
}
```

字段：

- `id`：用户首次创建时指定的短英文 slug，不可改。
- `name` / `color`：可改。`color` 为 CSS hex（`#RRGGBB`）。
- `updatedAt`：ISO 8601 UTC，用于多设备合并时取较新者。
- `deletedAt`：软删除标记。删除标签 ≠ 直接从数组移除——而是设 `deletedAt` 后续 GC，保证多设备合并时"一方改一方删"不丢数据。UI 层过滤 `deletedAt != null` 的标签。

### 3.4 投影：JSON → 24 小时网格

每条 entry 是独立对象，不挂在"小时格子"上。渲染时根据 `start` / `end` 投影到 CSS Grid：

- 每小时一行（48 个 0.5h 子单元）。
- entry 用 `grid-row: span N` 跨多行。
- 时段重叠的多条 entry 用 grid columns 自动并排。

## 4. UI 结构

### 4.1 主界面布局

```
┌─ TopBar ───────────────────────────────────────────────┐
│  📓 dairybook    < 2026年5月7日 周四 >    🔍 ⚙️  👤   │
└────────────────────────────────────────────────────────┘
┌─ 左 280px ─────────┐ ┌─ 右 1fr ──────────────────────┐
│  MiniCalendar      │ │                                │
│  TagSummary        │ │  Timeline (24h)               │
│                    │ │                                │
└────────────────────┘ └────────────────────────────────┘
```

响应式：< 720px 时左栏折叠为抽屉，时间轴占满。

### 4.2 组件清单

| 组件 | 职责 |
|---|---|
| `<TopBar>` | 顶栏容器：左侧 logo / `<DateNav>` / 右侧 `<SearchPanel>` 触发 + `<SettingsPanel>` 触发 |
| `<DateNav>` | 顶栏内的日期 + 左右键 + "今天" 按钮 |
| `<MiniCalendar>` | 左栏月日历，有 entry 的日子带圆点；点击切日 |
| `<TagSummary>` | 左栏当日标签时长合计 + 周/月统计入口 |
| `<Timeline>` | 主区 24 小时纵向网格 |
| `<EntryCard>` | 单条 entry，左侧 4px 色条按 `tagId` 着色 |
| `<EntryEditor>` | 起止时间 + 标签下拉 + Markdown 文本框 + 保存/删除 |
| `<QuickAdd>` | 在空时段点击 = 默认 1 小时新 entry |
| `<SearchPanel>` | 抽屉式搜索：关键字 + 标签 + 时间范围 |
| `<StatsModal>` | 周/月统计：标签时长堆叠柱图 + Top 关键字 |
| `<SettingsPanel>` | token 状态、标签管理、导出按钮 |

组件不直接调 GitHub API，全部走 `useStore()`。

## 5. 关键交互流程

### 5.1 首次登录（Device Flow）

```
1. 点 "用 GitHub 登录"
2. POST https://github.com/login/device/code
   → { user_code, device_code, verification_uri, interval }
3. 弹窗：显示 user_code + 复制按钮 + 自动打开 verification_uri 新标签
4. 按 interval 轮询 token endpoint
5. 拿到 access_token → localStorage["dairybook.token"]
6. 检测 dairybook-data 仓库：
   - 已存在 + App 已安装 → 进 7
   - 不存在 → 引导用户去模板仓库 "Use this template" 创建（私有）
   - 已存在但 App 未安装 → 引导用户安装 App 到该仓库
7. 进入主界面
```

GitHub App 配置：fine-grained installation，只允许访问 `dairybook-data` 仓库；权限收窄到 `Contents: Read and write` + `Metadata: Read-only`。

**首次创建数据仓库**：app 不申请 `Administration` 权限。登录后若检测到 `dairybook-data` 不存在，弹引导卡片让用户去 GitHub 一键模板（README + 空 `data/` + 空 `tags.json`），再回 app 安装 GitHub App 到该仓库。这是一次性的 30 秒成本，换来更窄的权限面。

### 5.2 打开 → 渲染

```
1. 检查 localStorage token；无 → 5.1
2. GET dairybook-data/data/2026-05.json (带 etag)
   - 304 → 用 IndexedDB 缓存
   - 200 → 写入 IndexedDB，记新 sha
3. 投影到 Timeline
```

冷启动到首屏 ≤ 800ms。

### 5.3 编辑 / 新增 entry

```
1. 编辑器修改 → store.upsertEntry(entry)
2. 立刻乐观更新 UI + IndexedDB
3. 防抖 1.5s → PUT 整月 JSON 回去 (带 sha)
4. 成功更新 sha；失败 → 5.4
```

UI 状态指示：保存中（转圈）/ 已保存（✓ N 秒前）/ 错误（! 重试）。

### 5.4 多设备冲突

PUT 返回 409 (sha 不匹配)：

```
1. GET 最新版本
2. 三向合并 entries（key = `entry.id`）：
   - 双方各加新 entry → 全保留
   - 同 id 双方都改 → `updatedAt` 较新者胜
   - 一方删一方改 → 保留改的那条（不丢数据）
   - 双方都删 → 删除
3. tags.json 同样三向合并（key = `tag.id`，按 `updatedAt` 取较新；删除用 `deletedAt` 软删除标记，不直接移除数组项）
4. 重新 PUT
```

合并完弹轻提示："已与另一设备同步，N 条来自其他设备"。极端失败落手动选择 dialog。

## 6. 错误处理 & 边界情况

### 6.1 网络与 API

| 场景 | 处置 |
|---|---|
| 离线 | `navigator.onLine` + fetch 失败 → 离线模式。写仍走 IndexedDB；顶栏显 ⚡ 离线 N 项待同步；回线重放。 |
| Token 过期/撤销 (401) | 清 token → 重登 → 登录后重放队列。 |
| 速率限制 (403 + RateLimit-Remaining: 0) | 冻结自动保存，按 RateLimit-Reset 倒计时恢复。 |
| 请求超时 (>10s) | 失败入队，指数退避重试 3 次后弹手动重试。 |

### 6.2 数据

| 场景 | 处置 |
|---|---|
| 月文件不存在 | PUT 不带 sha = 创建文件。 |
| 仓库不存在 | 不自动创建（避免要 Administration 权限）。引导用户用 GitHub 模板手动创建后回到 app（见 §5.1）。 |
| JSON 解析失败 | 拒绝覆盖 → 弹"云端文件损坏，查看 / 用本地缓存覆盖 / 取消"，永远不静默丢数据。 |
| sha 冲突 | 见 5.4。 |
| 用户撤销 App 授权 | 401 → 同 token 失效流程。 |

### 6.3 输入

| 场景 | 处置 |
|---|---|
| end < start | 编辑器实时校验，保存按钮变灰。 |
| 跨午夜 entry | 不支持，提示拆两条。 |
| start == end | 允许保存（打卡式）。 |
| 删除有 entry 引用的标签 | 二次确认 → 给标签打 `deletedAt`（软删除）。entry 上的 `tagId` 引用不动，UI 渲染时若指向已软删标签则视作"未分类"。这样多设备合并时"一方改 entry 一方删 tag"不丢数据。 |

### 6.4 隐私

- token 存 localStorage 而非 cookie：避免 CSRF；代价是同源 XSS 可读取，故第三方脚本严格控制——dependencies 树审计 + Markdown 渲染关闭 raw HTML。
- 所有请求 https + Bearer。
- 设置面板 "撤销当前设备" 按钮：清本地 token + 引导去 GitHub 撤销 App。
- 数据仓库 README 标明"包含个人日志，请保持私有"。

## 7. 技术栈

### 7.1 前端

- **Vue 3** + Composition API + TypeScript + `<script setup>`
- **Vite** 构建
- **Composables** 状态管理（不引 Pinia）
- 单页面应用（不引 vue-router）

### 7.2 库

| 用途 | 选型 | 理由 |
|---|---|---|
| Markdown 渲染 | `markdown-it` | 成熟、可关闭 raw HTML 防 XSS |
| Markdown 编辑 | 原生 `<textarea>` + 实时预览 | 不引复杂富文本编辑器 |
| ULID | `ulidx` | 轻 (~2KB) |
| 日期 | 原生 `Intl.DateTimeFormat` + 工具函数 | 日期逻辑薄，不需要 dayjs |
| IndexedDB | `idb-keyval` | KV 即可，不需 Dexie |
| HTTP | 原生 `fetch` | 不需 axios |
| 单测 | `vitest` | 与 Vite 同源 |
| 组件测试 | `@vue/test-utils` | 官方推荐 |
| 端到端 | `playwright` | |
| Lint/Format | `biome` | 一键替代 ESLint+Prettier |

### 7.3 部署

- Vite 打包 → `gh-pages` 分支
- GitHub Actions：push main → test → build → deploy Pages

### 7.4 代码仓库结构

```
dairybook/                  # 公开
├── src/
│   ├── lib/                # 业务逻辑（纯 TS）
│   │   ├── github.ts       # GitHub API 封装
│   │   ├── auth.ts         # device flow + token
│   │   ├── store.ts        # 状态 + 乐观更新 + 同步队列
│   │   ├── merge.ts        # 三向合并
│   │   ├── stats.ts        # 标签统计
│   │   └── search.ts       # 客户端搜索
│   ├── components/         # *.vue（见 §4.2）
│   └── main.ts
├── tests/
│   ├── unit/               # *.test.ts
│   ├── component/          # *.test.ts
│   ├── e2e/                # *.spec.ts (playwright)
│   └── fixtures/           # JSON 测试数据
├── public/
├── .github/workflows/
├── vite.config.ts
├── playwright.config.ts
├── package.json
├── biome.json
└── README.md
```

`src/lib/*.ts` 全为纯 TS，不依赖 Vue，可独立单测。

## 8. 测试策略

### 8.1 单元测试 (vitest)

`src/lib/*` 所有模块。重点：

- **`merge.ts`** —— 必须穷举所有合并场景：双方各加 / 同 id 双改 / 一删一改 / 双删 / tags.json 同规则
- **`store.ts`** —— 防抖、乐观更新、离线队列、重试、401 处理
- **`stats.ts`** —— 时长聚合（含跨小时投影）
- **`search.ts`** —— 关键字 + 标签 + 时间范围
- **`github.ts`** —— `msw` mock GitHub API，验证请求形态与错误码处理

### 8.2 组件测试 (@vue/test-utils)

只测有交互逻辑的：`<EntryEditor>`、`<Timeline>`、`<QuickAdd>`。
纯展示组件不写。

### 8.3 端到端 (playwright)

3 条关键路径，用 mock 后的 GitHub API：

- 首次登录：device flow → 创建 data 仓库 → 主界面
- 写入：新增 entry → 验证 PUT body → 切日切回 → 数据仍在
- 冲突：模拟双 tab 并发 → 触发 409 → 自动合并 → 双方改动都在

### 8.4 测试 fixtures

`tests/fixtures/`：

- 空月文件
- 含跨小时 / 重叠 entry 的月文件
- 三向合并的 before/after JSON 对

### 8.5 CI

- PR：`biome check` + `vitest run` + `vitest --coverage` (展示，不卡门槛)
- main 合并：上面所有 + `playwright test` + `vite build` + 部署 Pages

## 9. 风险与开放问题

- **GitHub App Device Flow CORS**：依赖 GitHub App 启用 device flow + 浏览器 CORS。实现前需先建 App、做一次性试链通。如失败，备用方案是退到方案 2（OAuth Web Flow + Cloudflare Worker）。
- **Rate limit**：authenticated user 5000 req/h 充裕，但极端高频写仍可能触限；防抖 1.5s 是核心保护。
- **三向合并的边角情况**：双删一改这类极少见组合需要测试覆盖到位。
