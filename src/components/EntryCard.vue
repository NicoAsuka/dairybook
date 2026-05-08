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
const tintColor = computed(() => (tag.value?.color ?? "#9aa0a6") + "12");
const html = computed(() => renderMarkdown(props.entry.text));
</script>

<template>
  <button
    class="card"
    :style="{ '--bar': barColor, '--tint': tintColor }"
    @click="$emit('click', entry)"
  >
    <span class="bar" />
    <span class="body">
      <span class="head">
        <span class="time">{{ entry.start }}–{{ entry.end }}</span>
        <span v-if="tag" class="tag">{{ tag.name }}</span>
      </span>
      <span class="text" v-if="entry.text" v-html="html" />
      <span class="text empty" v-else>（点击编辑）</span>
    </span>
  </button>
</template>

<style scoped>
.card {
  display: flex;
  align-items: stretch;
  gap: 0;
  width: 100%;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  border-radius: var(--radius);
  padding: 0;
  text-align: left;
  font: inherit;
  color: var(--text);
  overflow: hidden;
  position: relative;
  transition:
    border-color var(--transition),
    box-shadow var(--transition),
    transform var(--transition);
}
.card::before {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--tint);
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--transition);
}
.card:hover {
  border-color: var(--bar);
  box-shadow: var(--shadow-sm);
  transform: none;
  color: var(--text);
}
.card:hover::before {
  opacity: 1;
}
.card:active {
  transform: translateY(0.5px);
}

.bar {
  width: 4px;
  flex-shrink: 0;
  background: var(--bar);
}

.body {
  display: flex;
  flex-direction: column;
  flex: 1;
  padding: 6px 10px;
  min-width: 0;
  gap: 1px;
  position: relative;
  z-index: 1;
}
.head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
  flex-wrap: wrap;
}
.time {
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.01em;
}
.tag {
  font-size: 11px;
  padding: 0 6px;
  border-radius: 8px;
  color: var(--bar);
  background: color-mix(in srgb, var(--bar) 12%, transparent);
  font-weight: 500;
}
.text {
  color: var(--text);
  overflow: hidden;
  font-size: 13px;
}
.text :deep(p) {
  margin: 0;
}
.text :deep(p + p) {
  margin-top: 4px;
}
.text :deep(a) {
  color: var(--accent);
}
.text :deep(strong) {
  font-weight: 600;
}
.text.empty {
  color: var(--text-faint);
  font-size: 12px;
}
</style>
