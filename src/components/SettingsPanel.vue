<script setup lang="ts">
import { computed, ref } from "vue";
import { useStore } from "@/lib/store";
import TagBadge from "./TagBadge.vue";
import Icon from "./Icon.vue";
import type { Tag } from "@/lib/types";
import {
  buildJsonExport,
  buildMarkdownExport,
  downloadBlob,
} from "@/lib/export";

defineEmits<{ close: [] }>();
const store = useStore();

// === 标签 ===
const newId = ref("");
const newName = ref("");
const newColor = ref("#5a8dee");
const idError = ref<string | null>(null);

const idValid = computed(() => {
  const v = newId.value.trim().toLowerCase();
  if (!v) return false;
  if (!/^[a-z0-9_-]+$/.test(v)) return false;
  if (store.state.tags.data.tags.some((t) => t.id === v && t.deletedAt === null)) return false;
  return true;
});

function addTag() {
  const id = newId.value.trim().toLowerCase();
  if (!id) {
    idError.value = "请输入 ID";
    return;
  }
  if (!/^[a-z0-9_-]+$/.test(id)) {
    idError.value = "ID 只能含 a-z 0-9 _ -";
    return;
  }
  if (store.state.tags.data.tags.some((t) => t.id === id && t.deletedAt === null)) {
    idError.value = "ID 已存在";
    return;
  }
  idError.value = null;
  const now = new Date().toISOString();
  store.upsertTag({
    id,
    name: newName.value.trim() || id,
    color: newColor.value,
    updatedAt: now,
    deletedAt: null,
  });
  newId.value = "";
  newName.value = "";
}

function rename(t: Tag, name: string) {
  store.upsertTag({ ...t, name, updatedAt: new Date().toISOString() });
}
function recolor(t: Tag, color: string) {
  store.upsertTag({ ...t, color, updatedAt: new Date().toISOString() });
}

const confirmDeleteId = ref<string | null>(null);
function askDelete(t: Tag) {
  confirmDeleteId.value = t.id;
}
function cancelDelete() {
  confirmDeleteId.value = null;
}
function doDelete(t: Tag) {
  store.deleteTag(t.id);
  confirmDeleteId.value = null;
}

const SAMPLE_TAGS: { id: string; name: string; color: string }[] = [
  { id: "work", name: "工作", color: "#5a8dee" },
  { id: "study", name: "学习", color: "#8e7cc3" },
  { id: "rest", name: "休息", color: "#4caf7a" },
  { id: "meal", name: "吃饭", color: "#ef9a3c" },
  { id: "sport", name: "运动", color: "#e76f51" },
  { id: "social", name: "社交", color: "#f4a261" },
];

function insertSampleTags() {
  const now = new Date().toISOString();
  for (const s of SAMPLE_TAGS) {
    const existing = store.state.tags.data.tags.find((t) => t.id === s.id);
    if (existing && existing.deletedAt === null) continue;
    store.upsertTag({
      id: s.id,
      name: s.name,
      color: s.color,
      updatedAt: now,
      deletedAt: null,
    });
  }
}

// === 导出 ===
const exporting = ref<null | "md" | "json">(null);

async function exportJson() {
  exporting.value = "json";
  try {
    await loadAll();
    const blob = buildJsonExport(Object.values(store.state.months), store.state.tags.data);
    downloadBlob(blob, `dairybook-${new Date().toISOString().slice(0, 10)}.json`);
  } finally {
    exporting.value = null;
  }
}
async function exportMd() {
  exporting.value = "md";
  try {
    await loadAll();
    const md = buildMarkdownExport(Object.values(store.state.months), store.state.tags.data);
    downloadBlob(
      new Blob([md], { type: "text/markdown" }),
      `dairybook-${new Date().toISOString().slice(0, 10)}.md`,
    );
  } finally {
    exporting.value = null;
  }
}
async function loadAll() {
  const today = new Date().toISOString().slice(0, 10);
  const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  await store.prefetchMonths(yearAgo, today);
}

// === 账号 ===
const confirmLogout = ref(false);
function logout() {
  store.logout();
}

const userLogin = computed(() =>
  store.state.auth.kind === "logged-in" ? store.state.auth.user.login : "",
);
const repoInfo = computed(() => {
  const r = store.state.repo;
  return r.kind === "ready" ? `${r.owner}/${r.repo}` : "—";
});
const tagsCount = computed(() => store.activeTags().length);
const monthsCount = computed(() => Object.keys(store.state.months).length);
</script>

<template>
  <div class="settings" @click.stop>
    <header class="head">
      <div class="title">
        <Icon name="settings" :size="18" />
        <h2>设置</h2>
      </div>
      <button class="icon-btn" @click="$emit('close')" aria-label="关闭">
        <Icon name="x" />
      </button>
    </header>

    <!-- 标签 -->
    <section class="block">
      <div class="block-head">
        <div class="block-title">
          <Icon name="tag" :size="14" />
          <h3>标签</h3>
        </div>
        <p class="block-sub">按颜色和分类整理你的 entry</p>
      </div>

      <!-- 空状态：示例标签 -->
      <div v-if="store.activeTags().length === 0" class="empty">
        <p class="empty-text">还没有标签。先选一组示例开始，之后随时改：</p>
        <div class="samples">
          <span v-for="s in SAMPLE_TAGS" :key="s.id" class="sample-chip">
            <span class="dot" :style="{ background: s.color }" />
            {{ s.name }}
          </span>
        </div>
        <button class="primary" @click="insertSampleTags">
          <Icon name="sparkle" :size="14" />
          插入示例标签
        </button>
      </div>

      <!-- 标签列表 -->
      <ul v-else class="tag-list">
        <li v-for="t in store.activeTags()" :key="t.id" class="tag-row">
          <label class="color-swatch" :style="{ background: t.color }">
            <input
              type="color"
              :value="t.color"
              @change="recolor(t, ($event.target as HTMLInputElement).value)"
            />
          </label>
          <code class="tag-id">{{ t.id }}</code>
          <input
            class="tag-name-input"
            :value="t.name"
            @change="rename(t, ($event.target as HTMLInputElement).value)"
          />
          <span class="tag-preview">
            <TagBadge :tag="t" />
          </span>

          <span class="tag-actions">
            <template v-if="confirmDeleteId === t.id">
              <span class="confirm-text">确定？</span>
              <button class="ghost" @click="cancelDelete">取消</button>
              <button class="danger primary-danger" @click="doDelete(t)">删除</button>
            </template>
            <button v-else class="icon-btn delete" @click="askDelete(t)" aria-label="删除标签">
              <Icon name="trash" :size="14" />
            </button>
          </span>
        </li>
      </ul>

      <!-- 添加标签 -->
      <div class="add-form">
        <label class="color-swatch add" :style="{ background: newColor }">
          <input type="color" v-model="newColor" />
        </label>
        <input
          class="add-input id-input"
          v-model="newId"
          placeholder="id (英文，如 work)"
          maxlength="20"
          @keydown.enter="addTag"
        />
        <input
          class="add-input"
          v-model="newName"
          placeholder="名字（如 工作）"
          maxlength="30"
          @keydown.enter="addTag"
        />
        <button class="primary" :disabled="!idValid" @click="addTag">
          <Icon name="plus" :size="14" />
          添加
        </button>
      </div>
      <p v-if="idError" class="error-msg">{{ idError }}</p>
    </section>

    <div class="divider" />

    <!-- 数据 -->
    <section class="block">
      <div class="block-head">
        <div class="block-title">
          <Icon name="download" :size="14" />
          <h3>数据</h3>
        </div>
        <p class="block-sub">下载备份；数据本身在你的 GitHub 私有仓库 <code>{{ repoInfo }}</code></p>
      </div>

      <div class="export-grid">
        <button class="export-card" :disabled="exporting !== null" @click="exportMd">
          <span class="export-icon">
            <Icon name="book" :size="18" />
          </span>
          <span class="export-body">
            <span class="export-name">Markdown</span>
            <span class="export-desc">易读的 .md，按月分章</span>
          </span>
          <span v-if="exporting === 'md'" class="export-spinner" />
          <Icon v-else name="download" :size="14" class="export-arrow" />
        </button>
        <button class="export-card" :disabled="exporting !== null" @click="exportJson">
          <span class="export-icon">
            <Icon name="settings" :size="18" />
          </span>
          <span class="export-body">
            <span class="export-name">JSON</span>
            <span class="export-desc">完整结构化数据，便于程序处理</span>
          </span>
          <span v-if="exporting === 'json'" class="export-spinner" />
          <Icon v-else name="download" :size="14" class="export-arrow" />
        </button>
      </div>
      <p class="caption">导出包含最近 12 个月的所有 entry 与全部标签</p>
    </section>

    <div class="divider" />

    <!-- 账号 -->
    <section class="block">
      <div class="block-head">
        <div class="block-title">
          <Icon name="github" :size="14" />
          <h3>账号</h3>
        </div>
      </div>

      <div class="account">
        <img
          class="avatar"
          :src="`https://github.com/${userLogin}.png?size=80`"
          :alt="userLogin"
          @error="(e: Event) => ((e.target as HTMLImageElement).style.visibility = 'hidden')"
        />
        <div class="account-info">
          <div class="account-line"><span class="login">@{{ userLogin }}</span></div>
          <div class="account-meta">
            <span><strong>{{ tagsCount }}</strong> 标签</span>
            <span class="dot-sep">·</span>
            <span><strong>{{ monthsCount }}</strong> 月数据</span>
            <span class="dot-sep">·</span>
            <span class="repo-link">
              <code>{{ repoInfo }}</code>
            </span>
          </div>
        </div>
        <div class="account-action">
          <template v-if="confirmLogout">
            <button class="ghost" @click="confirmLogout = false">取消</button>
            <button class="danger primary-danger" @click="logout">
              <Icon name="logout" :size="14" />
              确定退出
            </button>
          </template>
          <button v-else class="ghost" @click="confirmLogout = true">
            <Icon name="logout" :size="14" />
            退出登录
          </button>
        </div>
      </div>
    </section>

    <footer class="foot">
      <span>dairybook · 数据由你掌握 · 零后端</span>
      <a href="https://github.com/NicoAsuka/dairybook" target="_blank">源代码</a>
    </footer>
  </div>
</template>

<style scoped>
.settings {
  padding: 18px 22px 16px;
  width: 100%;
  min-width: 540px;
  max-width: 680px;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}
.head .title {
  display: flex;
  align-items: center;
  gap: 8px;
}
.head h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
}
.icon-btn {
  width: 30px;
  height: 30px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  background: transparent;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
}
.icon-btn:hover {
  color: var(--text);
  background: var(--bg);
  border-color: transparent;
}

.block {
  margin-bottom: 18px;
}
.block:last-of-type { margin-bottom: 12px; }
.block-head {
  margin-bottom: 12px;
}
.block-title {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text);
}
.block-title h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.01em;
}
.block-sub {
  margin: 4px 0 0 0;
  font-size: 12px;
  color: var(--text-muted);
}
.block-sub code {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 0.95em;
  color: var(--text);
  padding: 1px 6px;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: 3px;
}

.divider {
  height: 1px;
  background: var(--border);
  margin: 0 0 18px;
}

/* === Tag empty state === */
.empty {
  padding: 18px;
  background: var(--bg-subtle);
  border: 1px dashed var(--border-strong);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}
.empty-text {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}
.samples {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.sample-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  font-size: 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--text-muted);
}
.sample-chip .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

/* === Tag list === */
.tag-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.tag-row {
  display: grid;
  grid-template-columns: 28px 90px 1fr auto auto;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border: 1px solid transparent;
  border-radius: 6px;
  transition: background var(--transition), border-color var(--transition);
}
.tag-row:hover {
  background: var(--bg-subtle);
  border-color: var(--border);
}

.color-swatch {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  display: inline-block;
  border: 1px solid rgba(0, 0, 0, 0.06);
  flex-shrink: 0;
}
.color-swatch input[type="color"] {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  border: none;
  padding: 0;
  background: transparent;
}
.color-swatch:hover { transform: scale(1.05); }

.tag-id {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 11px;
  color: var(--text-muted);
  background: var(--bg-subtle);
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid var(--border);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tag-name-input {
  border: 1px solid transparent;
  background: transparent;
  padding: 4px 8px;
  font-size: 13px;
  border-radius: 4px;
  width: 100%;
  min-width: 0;
}
.tag-row:hover .tag-name-input,
.tag-name-input:focus {
  background: var(--bg-elevated);
  border-color: var(--border);
}
.tag-preview { padding: 0 4px; }

.tag-actions {
  display: flex;
  gap: 4px;
  align-items: center;
  font-size: 12px;
}
.tag-actions .icon-btn.delete {
  width: 26px;
  height: 26px;
  opacity: 0;
}
.tag-row:hover .tag-actions .icon-btn.delete { opacity: 1; }
.tag-actions .icon-btn.delete:hover {
  color: var(--danger);
  background: rgba(192, 57, 43, 0.1);
}
.confirm-text {
  font-size: 12px;
  color: var(--text-muted);
  margin-right: 4px;
}
.ghost {
  padding: 3px 10px;
  font-size: 12px;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-muted);
}
.ghost:hover {
  color: var(--text);
  border-color: var(--border-strong);
}
.danger.primary-danger {
  background: var(--danger);
  color: #fff;
  border-color: var(--danger);
  padding: 3px 10px;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.danger.primary-danger:hover {
  background: #a8331f;
  border-color: #a8331f;
  color: #fff;
}

.add-form {
  display: grid;
  grid-template-columns: 28px 130px 1fr auto;
  gap: 8px;
  align-items: center;
  margin-top: 12px;
  padding: 10px;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: 8px;
}
.add-input {
  padding: 6px 10px;
  font-size: 13px;
  width: 100%;
  min-width: 0;
}
.id-input {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
}
.error-msg {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--danger);
}

.primary {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
  padding: 6px 14px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}
.primary:hover {
  background: var(--accent-hover);
  color: #fff;
  border-color: var(--accent-hover);
}
.primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.primary:disabled:hover {
  background: var(--accent);
  color: #fff;
}

/* === Export === */
.export-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}
.export-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 8px;
  text-align: left;
  transition: all var(--transition);
}
.export-card:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--text);
}
.export-card:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.export-card:disabled:hover {
  border-color: var(--border);
  background: var(--bg-elevated);
}
.export-icon {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--bg-subtle);
  color: var(--text-muted);
  flex-shrink: 0;
}
.export-card:hover .export-icon {
  background: var(--accent);
  color: #fff;
}
.export-card:disabled:hover .export-icon {
  background: var(--bg-subtle);
  color: var(--text-muted);
}
.export-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}
.export-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}
.export-desc {
  font-size: 11px;
  color: var(--text-muted);
}
.export-arrow {
  color: var(--text-faint);
  flex-shrink: 0;
}
.export-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--border-strong);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.caption {
  margin: 8px 2px 0;
  font-size: 11px;
  color: var(--text-faint);
}

/* === Account === */
.account {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: 8px;
}
.avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--bg);
  border: 1px solid var(--border);
  flex-shrink: 0;
  object-fit: cover;
}
.account-info {
  flex: 1;
  min-width: 0;
}
.account-line {
  display: flex;
  align-items: center;
  gap: 6px;
}
.login {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}
.account-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
  font-size: 11px;
  color: var(--text-muted);
}
.account-meta strong { color: var(--text); font-weight: 600; }
.dot-sep { color: var(--text-faint); }
.repo-link code {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 0.95em;
}
.account-action {
  display: flex;
  gap: 6px;
}
.account-action .ghost {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.foot {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: var(--text-faint);
}
.foot a {
  color: var(--text-faint);
  text-decoration: none;
}
.foot a:hover {
  color: var(--accent);
  text-decoration: underline;
}
</style>
