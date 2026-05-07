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
