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
import Icon from "@/components/Icon.vue";
import { addDays, formatYMD, parseYMD } from "@/lib/date";
import type { Entry } from "@/lib/types";

const store = useStore();
const editing = ref<Entry | null>(null);
const settingsOpen = ref(false);
const searchOpen = ref(false);
const statsOpen = ref(false);
const shortcutsOpen = ref(false);

// 移动端判定（< 720px）
const MOBILE_QUERY = "(max-width: 720px)";
const isMobile = ref(
  typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches,
);

const SIDEBAR_KEY = "dairybook.sidebar.collapsed";
// 移动端永远从折叠态开始（避免一打开就盖住时间轴）
const sidebarCollapsed = ref(
  isMobile.value ? true : localStorage.getItem(SIDEBAR_KEY) === "1",
);
function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value;
  // 移动端不持久化（每次进来都先收起）
  if (!isMobile.value) {
    localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed.value ? "1" : "0");
  }
}
function closeSidebarOnMobile() {
  if (isMobile.value) sidebarCollapsed.value = true;
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

let mqList: MediaQueryList | null = null;
function onMqChange(e: MediaQueryListEvent) {
  isMobile.value = e.matches;
  // 切到桌面时按持久化恢复，切到移动时强制收起
  if (e.matches) {
    sidebarCollapsed.value = true;
  } else {
    sidebarCollapsed.value = localStorage.getItem(SIDEBAR_KEY) === "1";
  }
}

onMounted(() => {
  store.bootFromCache();
  mqList = window.matchMedia(MOBILE_QUERY);
  mqList.addEventListener("change", onMqChange);
});
onUnmounted(() => {
  mqList?.removeEventListener("change", onMqChange);
});

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
  // mobile: 关闭打开的侧栏抽屉
  if (isMobile.value && !sidebarCollapsed.value) {
    sidebarCollapsed.value = true;
    return true;
  }
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
  if (view.value !== "main") return;

  const mod = e.metaKey || e.ctrlKey;
  const inText = isTextInputFocused();

  if (e.key === "Escape") {
    if (closeAllOverlays()) e.preventDefault();
    return;
  }

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

  if (inText) return;
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
  <div
    v-else
    class="layout"
    :class="{ collapsed: sidebarCollapsed, mobile: isMobile, 'sidebar-open': isMobile && !sidebarCollapsed }"
  >
    <TopBar
      :compact="isMobile"
      @open-settings="settingsOpen = true"
      @open-search="searchOpen = true"
      @open-stats="statsOpen = true"
      @open-shortcuts="shortcutsOpen = true"
      @toggle-sidebar="toggleSidebar"
    />

    <!-- 移动端遮罩：点了关侧栏抽屉 -->
    <div
      v-if="isMobile && !sidebarCollapsed"
      class="side-overlay"
      @click="sidebarCollapsed = true"
    />

    <aside class="side">
      <div class="side-inner">
        <MiniCalendar @click="closeSidebarOnMobile" />
        <TagSummary />
        <div class="quick">
          <button class="quick-btn" @click="newEntryNow(); closeSidebarOnMobile();">＋ 新增条目</button>
          <p class="quick-hint" v-if="!isMobile">点时间轴空白处也能创建 · 按 <kbd>?</kbd> 看快捷键</p>
          <p class="quick-hint" v-else>点时间轴空白处也能创建</p>
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
          先创建几个标签，让条目更有组织感
        </span>
        <button class="banner-cta" @click="openSettingsAndDismiss">去设置</button>
        <button class="banner-x" @click="dismissTagBanner" aria-label="关闭">×</button>
      </div>
      <Timeline @click-entry="openEditor" @add-at="(t: { start: string; end: string }) => newEntryAt(t.start, t.end)" />
    </main>

    <!-- 移动端浮动新建按钮 -->
    <button
      v-if="isMobile && !editing && !searchOpen && !statsOpen && !settingsOpen && !shortcutsOpen"
      class="fab"
      @click="newEntryNow"
      aria-label="新增条目"
    >
      <Icon name="plus" :size="22" />
    </button>

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
  display: grid;
  grid-template-rows: auto 1fr;
  grid-template-columns: 280px 1fr;
  height: 100vh;
  height: 100dvh;
  transition: grid-template-columns 0.2s ease;
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
.banner-text { flex: 1; min-width: 0; }
.banner-cta {
  padding: 4px 10px;
  font-size: 12px;
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
  white-space: nowrap;
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
  flex-shrink: 0;
}
.banner-x:hover { background: var(--bg); color: var(--text-muted); border-color: transparent; }

.quick { padding: 14px; border-top: 1px solid var(--border); }
.quick-btn {
  width: 100%;
  padding: 10px 0;
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
  max-height: 90dvh;
  overflow: auto;
  animation: pop 0.18s ease;
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes pop {
  from { opacity: 0; transform: scale(0.97); }
  to { opacity: 1; transform: scale(1); }
}

/* === 移动端：< 720px === */
@media (max-width: 720px) {
  .layout {
    grid-template-columns: 1fr;     /* 单列：main 占满 */
  }
  .layout.collapsed { grid-template-columns: 1fr; }

  /* 侧栏变成从左滑入的抽屉，覆盖在 main 之上 */
  .side {
    position: fixed;
    top: 0; left: 0; bottom: 0;
    width: min(280px, 84vw);
    z-index: 70;
    transform: translateX(-100%);
    transition: transform 0.22s ease;
    border-right: 1px solid var(--border);
    box-shadow: var(--shadow-lg);
  }
  .layout.sidebar-open .side {
    transform: translateX(0);
  }
  .side-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
    z-index: 65;
    animation: fadeIn 0.15s ease;
  }
  .side-inner {
    width: 100%;
  }

  .tag-banner {
    margin: 8px 12px 0 12px;
    padding: 8px 10px;
    font-size: 12.5px;
  }
  .banner-cta { padding: 4px 8px; }

  /* 浮动新建按钮 */
  .fab {
    position: fixed;
    right: 18px;
    bottom: max(20px, env(safe-area-inset-bottom, 20px));
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: var(--accent);
    color: #fff;
    border: none;
    box-shadow: var(--shadow-lg);
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform var(--transition), background var(--transition);
  }
  .fab:hover { background: var(--accent-hover); color: #fff; border-color: transparent; }
  .fab:active { transform: scale(0.96); }

  /* modal 全屏化（除 SearchPanel 自带抽屉，这里不影响它） */
  .modal-bg {
    place-items: stretch;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    background: var(--bg);
  }
  .modal {
    width: 100vw;
    max-width: 100vw;
    height: 100dvh;
    max-height: 100dvh;
    border-radius: 0;
    box-shadow: none;
    animation: slideUp 0.22s ease;
  }
  @keyframes slideUp {
    from { transform: translateY(8px); opacity: 0.85; }
    to { transform: translateY(0); opacity: 1; }
  }
  /* 子组件 panel 的 min-width 在 mobile 上失效 */
  .modal :deep(.settings),
  .modal :deep(.stats),
  .modal :deep(.editor),
  .modal :deep(.shortcuts) {
    min-width: 0;
    max-width: 100%;
    width: 100%;
  }
}
</style>
