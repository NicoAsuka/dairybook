<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useStore } from "@/lib/store";
import TopBar from "@/components/TopBar.vue";
import MiniCalendar from "@/components/MiniCalendar.vue";
import Timeline from "@/components/Timeline.vue";
import EntryEditor from "@/components/EntryEditor.vue";
import TagSummary from "@/components/TagSummary.vue";
import SettingsPanel from "@/components/SettingsPanel.vue";
import SearchPanel from "@/components/SearchPanel.vue";
import StatsModal from "@/components/StatsModal.vue";
import LoginPanel from "@/components/LoginPanel.vue";
import OnboardingPanel from "@/components/OnboardingPanel.vue";
import type { Entry } from "@/lib/types";

const store = useStore();
const editing = ref<Entry | null>(null);
const settingsOpen = ref(false);
const searchOpen = ref(false);
const statsOpen = ref(false);

const SIDEBAR_KEY = "dairybook.sidebar.collapsed";
const sidebarCollapsed = ref(localStorage.getItem(SIDEBAR_KEY) === "1");
function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value;
  localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed.value ? "1" : "0");
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
function onSave(e: Entry) { store.upsertEntry(e); editing.value = null; }
function onDelete() {
  if (editing.value) store.deleteEntry(editing.value.id);
  editing.value = null;
}
</script>

<template>
  <LoginPanel v-if="view === 'login'" />
  <OnboardingPanel v-else-if="view === 'onboard'" />
  <div v-else class="layout" :class="{ collapsed: sidebarCollapsed }">
    <TopBar
      @open-settings="settingsOpen = true"
      @open-search="searchOpen = true"
      @open-stats="statsOpen = true"
      @toggle-sidebar="toggleSidebar"
    />
    <aside class="side">
      <div class="side-inner">
        <MiniCalendar />
        <TagSummary />
        <div class="quick">
          <button @click="newEntryAt('09:00','10:00')">+ 新增条目</button>
        </div>
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

    <SearchPanel v-if="searchOpen"
      @close="searchOpen = false"
      @jump="(date: string) => { store.selectDate(date); searchOpen = false; }"
    />

    <div v-if="statsOpen" class="modal-bg" @click.self="statsOpen = false">
      <div class="modal">
        <StatsModal @close="statsOpen = false" />
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
  overflow: hidden;     /* 折叠时不让内容溢出 */
}
.side-inner {
  width: 280px;
  height: 100%;
  overflow-y: auto;
}
.layout.collapsed .side { border-right-width: 0; }
.main { overflow-y: auto; }
.quick { padding: 12px; border-top: 1px solid var(--border); }
.modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,.3); display: grid; place-items: center; z-index: 100; }
.modal { background: var(--bg-elevated); border-radius: var(--radius); box-shadow: 0 10px 30px rgba(0,0,0,.2); max-height: 90vh; overflow: auto; }

@media (max-width: 720px) {
  .layout { grid-template-columns: 1fr; }
  .side { display: none; }
}
</style>
