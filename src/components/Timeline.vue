<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "@/lib/store";
import EntryCard from "./EntryCard.vue";
import type { Entry } from "@/lib/types";

const store = useStore();
const emit = defineEmits<{ "click-entry": [Entry] }>();

const entries = computed(() => store.entriesForSelectedDate());

function timeToRow(t: string, isEnd = false): number {
  const [h, m] = t.split(":").map(Number);
  const slot = h * 2 + (m >= 30 ? 1 : 0);
  return slot + 1 + (isEnd && m % 30 !== 0 ? 1 : 0);
}

interface Placed extends Entry { col: number; cols: number }

const placed = computed<Placed[]>(() => {
  const sorted = [...entries.value].sort((a, b) => a.start.localeCompare(b.start));
  const lanes: { end: string }[] = [];
  const result: Placed[] = [];
  for (const e of sorted) {
    let col = lanes.findIndex((l) => l.end <= e.start);
    if (col < 0) { lanes.push({ end: e.end }); col = lanes.length - 1; }
    else lanes[col] = { end: e.end };
    result.push({ ...e, col, cols: 0 });
  }
  const cols = lanes.length || 1;
  return result.map((p) => ({ ...p, cols }));
});

const totalCols = computed(() => Math.max(...placed.value.map((p) => p.cols), 1));
const hours = Array.from({ length: 24 }, (_, h) => h);

function entryStyle(p: Placed): string {
  const startRow = timeToRow(p.start);
  const endRow = timeToRow(p.end, true);
  return `grid-row: ${startRow} / ${endRow}; grid-column: ${p.col + 1};`;
}
</script>

<template>
  <div class="timeline" :style="{ '--cols': totalCols }">
    <div class="hours">
      <div v-for="h in hours" :key="h" class="hour-row" :style="`grid-row: ${h * 2 + 1} / span 2`">
        {{ String(h).padStart(2, '0') }}:00
      </div>
    </div>
    <div class="entries">
      <div
        v-for="p in placed"
        :key="p.id"
        class="entry-slot"
        :data-entry-id="p.id"
        :style="entryStyle(p)"
      >
        <EntryCard :entry="p" @click="emit('click-entry', p)" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.timeline {
  display: grid;
  grid-template-columns: 56px 1fr;
  gap: 8px;
  padding: 12px 20px;
}
.hours {
  display: grid;
  grid-template-rows: repeat(48, 18px);
  font-size: 11px;
  color: var(--text-faint);
}
.hour-row { padding-top: 0; }
.entries {
  display: grid;
  grid-template-rows: repeat(48, 18px);
  grid-template-columns: repeat(var(--cols, 1), 1fr);
  gap: 2px;
  position: relative;
}
.entries::before {
  content: ""; position: absolute; inset: 0;
  background-image: repeating-linear-gradient(0deg, var(--border) 0 1px, transparent 1px 36px);
  pointer-events: none; z-index: 0;
}
.entry-slot { z-index: 1; }
</style>
