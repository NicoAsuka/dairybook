<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, useTemplateRef } from "vue";
import { useStore } from "@/lib/store";
import EntryCard from "./EntryCard.vue";
import type { Entry } from "@/lib/types";
import { formatYMD } from "@/lib/date";

const store = useStore();
const emit = defineEmits<{
  "click-entry": [Entry];
  "add-at": [{ start: string; end: string }];
}>();

const entries = computed(() => store.entriesForSelectedDate());

function pad(n: number): string { return String(n).padStart(2, "0"); }

function minToTime(min: number): string {
  const m = Math.max(0, Math.min(min, 24 * 60 - 1));
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

function timeToRow(t: string, isEnd = false): number {
  const parts = t.split(":").map(Number);
  const h = parts[0]!;
  const m = parts[1]!;
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

// 点击空白创建：基于 .entries 的 offsetY 计算 30-min 槽位
const entriesEl = useTemplateRef<HTMLDivElement>("entriesEl");
function onEmptyClick(e: MouseEvent) {
  const slot = Math.floor(e.offsetY / 18);                // 0..47
  const startMin = slot * 30;
  const endMin = Math.min(startMin + 60, 24 * 60 - 1);
  emit("add-at", { start: minToTime(startMin), end: minToTime(endMin) });
}

// "现在" 红线 + 自动滚动
const now = ref(new Date());
let nowTimer: ReturnType<typeof setInterval> | null = null;

const isToday = computed(() => formatYMD(now.value) === store.state.selectedDate);

const nowOffsetPx = computed(() => {
  const d = now.value;
  const min = d.getHours() * 60 + d.getMinutes();
  return (min / 30) * 18;          // 0..864
});

const scrollHostEl = useTemplateRef<HTMLDivElement>("scrollHostEl");

onMounted(() => {
  nowTimer = setInterval(() => { now.value = new Date(); }, 60_000);
  // 进入今天时滚动到当前时间附近（前移 120px 让上下都能看到）
  if (isToday.value) {
    setTimeout(() => {
      const el = scrollHostEl.value;
      if (!el) return;
      // 找到外层 scroll 容器（main）
      const target = el.closest(".main") as HTMLElement | null;
      if (target) target.scrollTop = Math.max(0, nowOffsetPx.value - 120);
    }, 0);
  }
});

onUnmounted(() => {
  if (nowTimer) clearInterval(nowTimer);
});
</script>

<template>
  <div class="timeline" :style="{ '--cols': totalCols }" ref="scrollHostEl">
    <div class="hours">
      <div v-for="h in hours" :key="h" class="hour-row" :style="`grid-row: ${h * 2 + 1} / span 2`">
        {{ String(h).padStart(2, '0') }}:00
      </div>
    </div>
    <div class="entries" ref="entriesEl" @click.self="onEmptyClick">
      <div
        v-for="p in placed"
        :key="p.id"
        class="entry-slot"
        :data-entry-id="p.id"
        :style="entryStyle(p)"
      >
        <EntryCard :entry="p" @click="emit('click-entry', p)" />
      </div>

      <!-- "现在" 指示线（仅今天显示） -->
      <div
        v-if="isToday"
        class="now-line"
        :style="{ top: `${nowOffsetPx}px` }"
      >
        <span class="now-dot" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.timeline {
  display: grid;
  grid-template-columns: 56px 1fr;
  column-gap: 8px;
  padding: 12px 20px;
  align-items: start;
}
.hours {
  display: grid;
  grid-template-rows: repeat(48, 18px);
  font-size: 11px;
  color: var(--text-faint);
  line-height: 1;
}
.hour-row {
  padding: 0;
  text-align: right;
  padding-right: 4px;
  transform: translateY(-50%);
  font-variant-numeric: tabular-nums;
}
.hour-row:first-child { transform: none; }

.entries {
  display: grid;
  grid-template-rows: repeat(48, 18px);
  grid-template-columns: repeat(var(--cols, 1), 1fr);
  column-gap: 2px;
  position: relative;
  cursor: copy;          /* 暗示空白处可点击创建 */
}
.entries::before {
  content: ""; position: absolute; inset: 0;
  background-image: repeating-linear-gradient(0deg, var(--border) 0 1px, transparent 1px 36px);
  pointer-events: none; z-index: 0;
}
.entry-slot {
  z-index: 1;
  padding: 1px 0;
  display: flex;
  min-height: 0;
  cursor: default;        /* slot 内部按 EntryCard 自己的 cursor */
}

/* "现在" 红线 */
.now-line {
  position: absolute;
  left: 0; right: 0;
  height: 0;
  border-top: 1.5px solid #ef4444;
  z-index: 2;
  pointer-events: none;
}
.now-dot {
  position: absolute;
  left: -5px; top: -5px;
  width: 10px; height: 10px;
  background: #ef4444;
  border-radius: 50%;
}
</style>
