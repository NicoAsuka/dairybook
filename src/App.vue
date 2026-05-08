<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue";
import { useStore } from "@/lib/store";
import TopBar from "@/components/TopBar.vue";
import MiniCalendar from "@/components/MiniCalendar.vue";
import Timeline from "@/components/Timeline.vue";
import EntryEditor from "@/components/EntryEditor.vue";
import TagSummary from "@/components/TagSummary.vue";
import SettingsPanel from "@/components/SettingsPanel.vue";
import SearchPanel from "@/components/SearchPanel.vue";
import StatsModal from "@/components/StatsModal.vue";
import ShortcutsModal from "@/components/ShortcutsModal.vue";
import LoginPanel from "@/components/LoginPanel.vue";
import OnboardingPanel from "@/components/OnboardingPanel.vue";
import { addDays, formatYMD, parseYMD } from "@/lib/date";
import type { Entry } from "@/lib/types";

const store = useStore();
const editing = ref<Entry | null>(null);
const settingsOpen = ref(false);
const searchOpen = ref(false);
const statsOpen = ref(false);
const shortcutsOpen = ref(false);

const SIDEBAR_KEY = "dairybook.sidebar.collapsed";
const sidebarCollapsed = ref(localStorage.getItem(SIDEBAR_KEY) === "1");
function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value;
  localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed.value ? "1" : "0");
}

const TAG_BANNER_DISMISS_KEY = "dairybook.tagBanner.dismissed";
const tagBannerDismissed = ref(localStorage.getItem(TAG_BANNER_DISMISS_KEY) === "1");
const showTagBanner = computed(() =>
  view.value === "main" &&
  store.state.repo.kind === "ready" &&
  store.activeTags().length === 0 &&
  !tagBannerDismissed.value,
);
function dismissTagBanner() {
  tagBannerDismissed.value = true;
  localStorage.setItem(TAG_BANNER_DISMISS_KEY, "1");
}
function openSettingsAndDismiss() {
  settingsOpen.value = true;
  dismissTagBanner();
}

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
function newEntryNow() {
  // 创建以当前时间向上取整到 30 分钟为起点的 1 小时 entry
  const d = new Date();
  let mins = d.getHours() * 60 + d.getMinutes();
  mins = Math.ceil(mins / 30) * 30;
  if (mins >= 24 * 60) mins = 23 * 60 + 30;
  const pad = (n: number) => String(n).padStart(2, "0");
  const start = `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
  const endMin = Math.min(mins + 60, 24 * 60 - 1);
  const end = `${pad(Math.floor(endMin / 60))}:${pad(endMin % 60)}`;
  newEntryAt(start, end);
}
function onSave(e: Entry) { store.upsertEntry(e); editing.value = null; }
function onDelete() {
  if (editing.value) store.deleteEntry(editing.value.id);
  editing.value = null;
}

function shiftDay(delta: number) {
  store.selectDate(formatYMD(addDays(parseYMD(store.state.selectedDate), delta)));
}

function closeAllOverlays(): boolean {
  if (editing.value) { editing.value = null; return true; }
  if (shortcutsOpen.value) { shortcutsOpen.value = false; return true; }
  if (searchOpen.value) { searchOpen.value = false; return true; }
  if (statsOpen.value) { statsOpen.value = false; return true; }
  if (settingsOpen.value) { settingsOpen.value = false; return true; }
  return false;
}

function isTextInputFocused(): boolean {
  const a = document.activeElement;
  if (!a) return false;
  const tag = a.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if ((a as HTMLElement).isContentEditable) return true;
  return false;
}

function onKeydown(e: KeyboardEvent) {
  // 仅在主视图响应快捷键
  if (view.value !== "main") return;

  const mod = e.metaKey || e.ctrlKey;
  const inText = isTextInputFocused();

  // Esc：关掉最上层 overlay（任何时候）
  if (e.key === "Escape") {
    if (closeAllOverlays()) e.preventDefault();
    return;
  }

  // 修饰键组合：在任何位置都生效
  if (mod) {
    if (e.key.toLowerCase() === "k" || e.key === "/") {
      e.preventDefault();
      searchOpen.value = true;
      return;
    }
    if (e.key === ",") {
      e.preventDefault();
      settingsOpen.value = true;
      return;
    }
    if (e.key === ".") {
      e.preventDefault();
      statsOpen.value = true;
      return;
    }
    if (e.key.toLowerCase() === "b") {
      e.preventDefault();
      toggleSidebar();
      return;
    }
    return;
  }

  // 文本输入态下，下面的"裸键"快捷键不响应
  if (inText) return;
  // 弹窗已经打开时，不再触发"裸键"导航
  if (editing.value || searchOpen.value || statsOpen.value || settingsOpen.value || shortcutsOpen.value) return;

  switch (e.key) {
    case "ArrowLeft": e.preventDefault(); shiftDay(-1); break;
    case "ArrowRight": e.preventDefault(); shiftDay(1); break;
    case "t":
    case "T": e.preventDefault(); store.selectDate(formatYMD(new Date())); break;
    case "n":
    case "N": e.preventDefault(); newEntryNow(); break;
    case "?": e.preventDefault(); shortcutsOpen.value = true; break;
  }
}

onMounted(() => document.addEventListener("keydown", onKeydown));
onUnmounted(() => document.removeEventListener("keydown", onKeydown));
</script>

<template>
  <LoginPanel v-if="view === 'login'" />
  <OnboardingPanel v-else-if="view === 'onboard'" />
  <div v-else class="layout" :class="{ collapsed: sidebarCollapsed }">
    <TopBar
      @open-settings="settingsOpen = true"
      @open-search="searchOpen = true"
      @open-stats="statsOpen = true"
      @open-shortcuts="shortcutsOpen = true"
      @toggle-sidebar="toggleSidebar"
    />
    <aside class="side">
      <div class="side-inner">
        <MiniCalendar />
        <TagSummary />
        <div class="quick">
          <button class="quick-btn" @click="newEntryNow">＋ 新增条目</button>
          <p class="quick-hint">点时间轴空白处也能创建 · 按 <kbd>?</kbd> 看快捷键</p>
        </div>
      </div>
    </aside>
    <main class="main">
      <div v-if="showTagBanner" class="tag-banner">
        <span class="banner-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2l2.39 4.84L20 8l-4 3.9L17 18l-5-2.7L7 18l1-6.1L4 8l5.61-1.16L12 2z" />
          </svg>
        </span>
        <span class="banner-text">
          先创建几个标签，让条目更有组织感（也能用颜色区分）
        </span>
        <button class="banner-cta" @click="openSettingsAndDismiss">去设置</button>
        <button class="banner-x" @click="dismissTagBanner" aria-label="关闭">×</button>
      </div>
      <Timeline @click-entry="openEditor" @add-at="(t: { start: string; end: string }) => newEntryAt(t.start, t.end)" />
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

    <SearchPanel v-if="searchOpen"
      @close="searchOpen = false"
      @jump="(date: string) => { store.selectDate(date); searchOpen = false; }"
    />

    <div v-if="statsOpen" class="modal-bg" @click.self="statsOpen = false">
      <div class="modal">
        <StatsModal @close="statsOpen = false" />
      </div>
    </div>

    <div v-if="shortcutsOpen" class="modal-bg" @click.self="shortcutsOpen = false">
      <div class="modal">
        <ShortcutsModal @close="shortcutsOpen = false" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.layout {
  display: grid; grid-template-rows: auto 1fr;
  grid-template-columns: 280px 1fr;
  height: 100vh;
  transition: grid-template-columns .2s ease;
}
.layout.collapsed { grid-template-columns: 0 1fr; }
.layout > :deep(header) { grid-column: 1 / 3; }
.side {
  border-right: 1px solid var(--border);
  background: var(--bg-elevated);
  overflow: hidden;
}
.side-inner {
  width: 280px;
  height: 100%;
  overflow-y: auto;
}
.layout.collapsed .side { border-right-width: 0; }
.main { overflow-y: auto; }
.tag-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 12px 20px 0 20px;
  padding: 10px 14px;
  background: linear-gradient(90deg, var(--accent-soft), transparent);
  border: 1px solid var(--accent-soft);
  border-left: 3px solid var(--accent);
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: var(--text);
}
.banner-icon { color: var(--accent); display: inline-flex; }
.banner-text { flex: 1; }
.banner-cta {
  padding: 4px 10px;
  font-size: 12px;
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.banner-cta:hover {
  background: var(--accent-hover);
  color: #fff;
  border-color: var(--accent-hover);
}
.banner-x {
  width: 22px; height: 22px;
  padding: 0;
  font-size: 16px;
  line-height: 1;
  border: none;
  background: transparent;
  color: var(--text-faint);
  border-radius: 50%;
}
.banner-x:hover { background: var(--bg); color: var(--text-muted); border-color: transparent; }
.quick { padding: 14px; border-top: 1px solid var(--border); }
.quick-btn {
  width: 100%;
  padding: 8px 0;
  border-color: var(--border);
  font-weight: 500;
  color: var(--text);
  background: var(--bg);
}
.quick-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-soft);
}
.quick-hint {
  margin: 8px 0 0 0;
  font-size: 11px;
  color: var(--text-faint);
  text-align: center;
}
.quick-hint kbd {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 10px;
  padding: 0 4px;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: 3px;
}
.modal-bg {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: grid; place-items: center; z-index: 100;
  animation: fadeIn 0.15s ease;
}
.modal {
  background: var(--bg-elevated);
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  max-height: 90vh;
  overflow: auto;
  animation: pop 0.18s ease;
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes pop {
  from { opacity: 0; transform: scale(0.97); }
  to { opacity: 1; transform: scale(1); }
}

@media (max-width: 720px) {
  .layout { grid-template-columns: 1fr; }
  .side { display: none; }
}
</style>
