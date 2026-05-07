<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "@/lib/store";
import { renderMarkdown } from "@/lib/markdown";
import type { Entry } from "@/lib/types";

const props = defineProps<{ entry: Entry }>();
defineEmits<{ click: [Entry] }>();

const store = useStore();
const tag = computed(() => store.getTagById(props.entry.tagId));
const barColor = computed(() => tag.value?.color ?? "var(--color-default)");
const html = computed(() => renderMarkdown(props.entry.text));
</script>

<template>
  <button class="card" @click="$emit('click', entry)">
    <span class="bar" :style="{ background: barColor }" />
    <span class="time">{{ entry.start }}–{{ entry.end }}</span>
    <span class="text" v-if="entry.text" v-html="html" />
    <span class="text empty" v-else>（空）</span>
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
.time { color: var(--text-muted); font-variant-numeric: tabular-nums; min-width: 92px; flex-shrink: 0; }
.text { color: var(--text); flex: 1; overflow: hidden; }
.text :deep(p) { margin: 0; }
.text :deep(a) { color: var(--accent); }
.text.empty { color: var(--text-faint); }
</style>
