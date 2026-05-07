<script setup lang="ts">
import DateNav from "./DateNav.vue";
import SyncStatusPill from "./SyncStatusPill.vue";
import { useStore } from "@/lib/store";
import { computed } from "vue";

defineEmits<{ "open-settings": [] }>();

const store = useStore();
const userLabel = computed(() =>
  store.state.auth.kind === "logged-in" ? store.state.auth.user.login : "",
);
</script>

<template>
  <header class="topbar">
    <div class="left">
      <strong class="brand">dairybook</strong>
    </div>
    <div class="center"><DateNav /></div>
    <div class="right">
      <SyncStatusPill />
      <span class="user" v-if="userLabel">@{{ userLabel }}</span>
      <button class="icon" @click="$emit('open-settings')" aria-label="设置">⚙</button>
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
.icon { padding: 4px 8px; }
</style>
