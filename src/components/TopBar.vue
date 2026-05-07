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
      <strong class="brand">dairybook</strong>
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
