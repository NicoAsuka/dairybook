<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, useTemplateRef } from "vue";
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

function timeToMin(t: string): number {
  const parts = t.split(":").map(Number);
  return parts[0]! * 60 + parts[1]!;
}

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

// === 拖拽状态 ===
const PX_PER_MIN = 18 / 30;     // 0.6 px/min
const SNAP_MIN = 15;
const DRAG_THRESHOLD_PX = 3;

interface DragState {
  id: string;
  mode: "move" | "resize-top" | "resize-bottom";
  initialMouseY: number;
  initialStartMin: number;
  initialEndMin: number;
  previewStart: string;
  previewEnd: string;
  moved: boolean;
}

const drag = ref<DragState | null>(null);
const justDragged = reactive<{ id: string | null }>({ id: null });

const adjustedEntries = computed<Entry[]>(() =>
  entries.value.map((e) =>
    drag.value?.id === e.id
      ? { ...e, start: drag.value.previewStart, end: drag.value.previewEnd }
      : e,
  ),
);

interface Placed extends Entry { col: number; cols: number }

const placed = computed<Placed[]>(() => {
  const sorted = [...adjustedEntries.value].sort((a, b) => a.start.localeCompare(b.start));
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

// === 点空白创建 ===
const entriesEl = useTemplateRef<HTMLDivElement>("entriesEl");
function onEmptyClick(e: MouseEvent) {
  const slot = Math.floor(e.offsetY / 18);
  const startMin = slot * 30;
  const endMin = Math.min(startMin + 60, 24 * 60 - 1);
  emit("add-at", { start: minToTime(startMin), end: minToTime(endMin) });
}

// === 点 entry 进入编辑（drag 后抑制 click） ===
function onCardClick(p: Entry) {
  if (justDragged.id === p.id) {
    justDragged.id = null;
    return;
  }
  emit("click-entry", p);
}

// === 拖拽：mousedown / mousemove / mouseup ===
function onSlotMouseDown(e: MouseEvent, p: Entry) {
  // 只响应主键
  if (e.button !== 0) return;
  // 阻止文本选择
  e.preventDefault();

  // 根据按下位置在 EntryCard 上的偏移决定是 move 还是 resize 上 / 下边
  const slotEl = e.currentTarget as HTMLElement;
  const rect = slotEl.getBoundingClientRect();
  const offsetY = e.clientY - rect.top;
  const EDGE = 6;
  let mode: DragState["mode"] = "move";
  if (offsetY < EDGE) mode = "resize-top";
  else if (offsetY > rect.height - EDGE) mode = "resize-bottom";

  drag.value = {
    id: p.id,
    mode,
    initialMouseY: e.clientY,
    initialStartMin: timeToMin(p.start),
    initialEndMin: timeToMin(p.end),
    previewStart: p.start,
    previewEnd: p.end,
    moved: false,
  };

  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
}

function onMouseMove(e: MouseEvent) {
  if (!drag.value) return;
  const dy = e.clientY - drag.value.initialMouseY;
  if (!drag.value.moved && Math.abs(dy) < DRAG_THRESHOLD_PX) return;
  drag.value.moved = true;

  const dMin = Math.round(dy / PX_PER_MIN / SNAP_MIN) * SNAP_MIN;
  const length = drag.value.initialEndMin - drag.value.initialStartMin;

  let newStart = drag.value.initialStartMin;
  let newEnd = drag.value.initialEndMin;

  if (drag.value.mode === "move") {
    newStart = drag.value.initialStartMin + dMin;
    newEnd = drag.value.initialEndMin + dMin;
    if (newStart < 0) { newStart = 0; newEnd = length; }
    if (newEnd > 24 * 60 - 1) { newEnd = 24 * 60 - 1; newStart = newEnd - length; }
  } else if (drag.value.mode === "resize-top") {
    newStart = Math.min(drag.value.initialStartMin + dMin, drag.value.initialEndMin - SNAP_MIN);
    if (newStart < 0) newStart = 0;
  } else {
    newEnd = Math.max(drag.value.initialEndMin + dMin, drag.value.initialStartMin + SNAP_MIN);
    if (newEnd > 24 * 60 - 1) newEnd = 24 * 60 - 1;
  }

  drag.value.previewStart = minToTime(newStart);
  drag.value.previewEnd = minToTime(newEnd);
}

function onMouseUp() {
  document.removeEventListener("mousemove", onMouseMove);
  document.removeEventListener("mouseup", onMouseUp);

  if (!drag.value) return;
  const d = drag.value;
  drag.value = null;

  if (d.moved) {
    // 提交变更
    const original = entries.value.find((e) => e.id === d.id);
    if (original && (original.start !== d.previewStart || original.end !== d.previewEnd)) {
      store.upsertEntry({
        ...original,
        start: d.previewStart,
        end: d.previewEnd,
        updatedAt: new Date().toISOString(),
      });
    }
    // 抑制紧随其后的 click 事件
    justDragged.id = d.id;
  }
}

// === "现在" 红线 + 自动滚动 ===
const now = ref(new Date());
let nowTimer: ReturnType<typeof setInterval> | null = null;

const isToday = computed(() => formatYMD(now.value) === store.state.selectedDate);
const nowOffsetPx = computed(() => {
  const d = now.value;
  const min = d.getHours() * 60 + d.getMinutes();
  return (min / 30) * 18;
});

const scrollHostEl = useTemplateRef<HTMLDivElement>("scrollHostEl");

onMounted(() => {
  nowTimer = setInterval(() => { now.value = new Date(); }, 60_000);
  if (isToday.value) {
    setTimeout(() => {
      const el = scrollHostEl.value;
      if (!el) return;
      const target = el.closest(".main") as HTMLElement | null;
      if (target) target.scrollTop = Math.max(0, nowOffsetPx.value - 120);
    }, 0);
  }
});

onUnmounted(() => {
  if (nowTimer) clearInterval(nowTimer);
  document.removeEventListener("mousemove", onMouseMove);
  document.removeEventListener("mouseup", onMouseUp);
});

function slotCursorClass(p: Placed): string {
  return drag.value?.id === p.id ? `dragging-${drag.value.mode}` : "";
}
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
        :class="[slotCursorClass(p), { dragging: drag?.id === p.id && drag.moved }]"
        :data-entry-id="p.id"
        :style="entryStyle(p)"
        @mousedown="onSlotMouseDown($event, p)"
      >
        <EntryCard :entry="p" @click="onCardClick(p)" />
      </div>

      <div v-if="isToday" class="now-line" :style="{ top: `${nowOffsetPx}px` }">
        <span class="now-dot" />
      </div>

      <!-- 空状态：今天没 entry 时给个轻量提示 -->
      <div v-if="entries.length === 0" class="empty-hint">
        <p class="empty-title">这一天还没有记录</p>
        <p class="empty-sub">点时间轴空白处即可创建 · 或按 <kbd>N</kbd></p>
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
  cursor: copy;
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
  cursor: grab;
  user-select: none;
  position: relative;
}
.entry-slot.dragging :deep(.card) {
  opacity: 0.88;
  box-shadow: var(--shadow-md);
}
.entry-slot.dragging,
.entry-slot.dragging * {
  cursor: grabbing !important;
}
.entry-slot.dragging-resize-top,
.entry-slot.dragging-resize-top *,
.entry-slot.dragging-resize-bottom,
.entry-slot.dragging-resize-bottom * {
  cursor: ns-resize !important;
}

/* 空状态提示 */
.empty-hint {
  position: absolute;
  left: 50%;
  top: 200px;
  transform: translateX(-50%);
  text-align: center;
  pointer-events: none;
  z-index: 1;
}
.empty-title {
  margin: 0;
  font-size: 14px;
  color: var(--text-muted);
  font-weight: 500;
}
.empty-sub {
  margin: 6px 0 0 0;
  font-size: 12px;
  color: var(--text-faint);
}
.empty-sub kbd {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 10px;
  padding: 1px 5px;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: 3px;
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
