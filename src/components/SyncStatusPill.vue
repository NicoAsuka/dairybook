<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "@/lib/store";
import { useOnlineStatus } from "@/lib/network";

const store = useStore();
const online = useOnlineStatus();

interface View { label: string; kind: "saving" | "saved" | "error" | "offline" | "idle" }

const view = computed<View>(() => {
  if (!online.value) return { label: "离线", kind: "offline" };
  const e = store.state.syncStatus;
  const t = store.state.tagsSyncStatus;
  if (e.kind === "error" || t.kind === "error") {
    return { label: "保存失败 · 点击重试", kind: "error" };
  }
  if (e.kind === "saving" || t.kind === "saving") {
    return { label: "保存中…", kind: "saving" };
  }
  if (e.kind === "saved" || t.kind === "saved") {
    return { label: "已保存", kind: "saved" };
  }
  return { label: "", kind: "idle" };
});

function onClick() {
  if (view.value.kind === "error") store.retryFailed();
}
</script>

<template>
  <button
    v-if="view.kind !== 'idle'"
    class="pill" :class="view.kind"
    :disabled="view.kind !== 'error'"
    @click="onClick"
  >
    <span class="dot" />
    {{ view.label }}
  </button>
</template>

<style scoped>
.pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 2px 8px; font-size: 11px; border-radius: 10px;
  background: var(--bg); border: 1px solid var(--border);
}
.pill .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.pill.saving { color: var(--accent); }
.pill.saved { color: var(--success); }
.pill.error { color: var(--danger); cursor: pointer; border-color: var(--danger-soft); }
.pill.error:hover { background: var(--danger-soft); }
.pill.offline { color: var(--warning); border-color: var(--warning-soft); background: var(--warning-soft); }
.pill:disabled { cursor: default; }
</style>
