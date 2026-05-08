<script setup lang="ts">
import DateNav from "./DateNav.vue";
import SyncStatusPill from "./SyncStatusPill.vue";
import Icon from "./Icon.vue";
import { useStore } from "@/lib/store";
import { computed } from "vue";

defineEmits<{
  "open-settings": [];
  "open-search": [];
  "open-stats": [];
  "open-shortcuts": [];
  "toggle-sidebar": [];
}>();

const store = useStore();
const userLabel = computed(() =>
  store.state.auth.kind === "logged-in" ? store.state.auth.user.login : "",
);
</script>

<template>
  <header class="topbar">
    <div class="left">
      <button class="icon-btn" @click="$emit('toggle-sidebar')" aria-label="切换侧栏">
        <Icon name="menu" />
      </button>
      <span class="brand">
        <Icon name="book" :size="16" />
        <strong>dairybook</strong>
      </span>
    </div>
    <div class="center"><DateNav /></div>
    <div class="right">
      <SyncStatusPill />
      <span class="user" v-if="userLabel">@{{ userLabel }}</span>
      <button class="icon-btn" @click="$emit('open-search')" aria-label="搜索">
        <Icon name="search" />
      </button>
      <button class="icon-btn" @click="$emit('open-stats')" aria-label="统计">
        <Icon name="stats" />
      </button>
      <button class="icon-btn" @click="$emit('open-shortcuts')" aria-label="键盘快捷键" title="键盘快捷键 (?)">
        <Icon name="keyboard" />
      </button>
      <button class="icon-btn" @click="$emit('open-settings')" aria-label="设置">
        <Icon name="settings" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 10px 18px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
}
.left {
  justify-self: start;
  display: flex;
  align-items: center;
  gap: 10px;
}
.center {
  justify-self: center;
}
.right {
  justify-self: end;
  display: flex;
  gap: 6px;
  align-items: center;
  color: var(--text-muted);
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  letter-spacing: 0.01em;
}
.brand strong {
  font-weight: 600;
}
.user {
  font-size: 12px;
  color: var(--text-muted);
  padding: 0 4px;
}

.icon-btn {
  width: 32px;
  height: 32px;
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
  color: var(--accent);
  background: var(--accent-soft);
  border-color: transparent;
}
</style>
