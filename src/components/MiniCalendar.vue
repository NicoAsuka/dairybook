<script setup lang="ts">
import { computed, ref } from "vue";
import { useStore } from "@/lib/store";
import { formatYMD, monthOf, parseYMD } from "@/lib/date";

const store = useStore();

// 当前显示的月份（独立于 selectedDate，允许翻月浏览不切日期）
const cursorYM = ref(monthOf(store.state.selectedDate));

const grid = computed(() => {
  const [yStr, mStr] = cursorYM.value.split("-");
  const year = Number(yStr);
  const month = Number(mStr) - 1;
  const first = new Date(Date.UTC(year, month, 1));
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const startWeekday = first.getUTCDay();
  const cells: { ymd: string | null; day: number | null }[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push({ ymd: null, day: null });
  for (let d = 1; d <= lastDay; d++) {
    const date = new Date(Date.UTC(year, month, d));
    cells.push({ ymd: formatYMD(date), day: d });
  }
  return cells;
});

const monthLabel = computed(() => {
  const [yStr, mStr] = cursorYM.value.split("-");
  const d = new Date(Date.UTC(Number(yStr), Number(mStr) - 1, 1));
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long" }).format(d);
});

const today = computed(() => formatYMD(new Date()));

// 当天用到的（前 3 个）不同 tag 颜色，作为日点
function dayDotColors(ymd: string): string[] {
  const m = monthOf(ymd);
  const day = store.state.months[m]?.data.days[ymd];
  if (!day || day.entries.length === 0) return [];
  const colors = new Set<string>();
  for (const e of day.entries) {
    const tag = store.getTagById(e.tagId);
    colors.add(tag?.color ?? "#9aa0a6");
    if (colors.size >= 3) break;
  }
  return [...colors];
}

function shiftMonth(delta: number) {
  const [yStr, mStr] = cursorYM.value.split("-");
  let y = Number(yStr), m = Number(mStr) + delta;
  while (m < 1) { m += 12; y--; }
  while (m > 12) { m -= 12; y++; }
  cursorYM.value = `${y}-${String(m).padStart(2, "0")}`;
}

function jumpToToday() {
  const t = formatYMD(new Date());
  cursorYM.value = monthOf(t);
  store.selectDate(t);
}
</script>

<template>
  <div class="cal">
    <div class="cal-head">
      <button class="nav" @click="shiftMonth(-1)" aria-label="上个月">‹</button>
      <span class="title">{{ monthLabel }}</span>
      <button class="nav" @click="shiftMonth(1)" aria-label="下个月">›</button>
    </div>
    <div class="cal-row cal-weekdays">
      <span v-for="w in ['日','一','二','三','四','五','六']" :key="w">{{ w }}</span>
    </div>
    <div class="cal-grid">
      <button
        v-for="(c, i) in grid"
        :key="i"
        class="cell"
        :class="{
          'cell-empty': !c.ymd,
          'cell-selected': c.ymd === store.state.selectedDate,
          'cell-today': c.ymd === today,
        }"
        :disabled="!c.ymd"
        @click="c.ymd && store.selectDate(c.ymd)"
      >
        <span class="day">{{ c.day ?? '' }}</span>
        <span v-if="c.ymd && dayDotColors(c.ymd).length" class="dots">
          <span
            v-for="(color, di) in dayDotColors(c.ymd)"
            :key="di"
            class="dot"
            :style="{ background: color }"
          />
        </span>
      </button>
    </div>
    <button class="goto-today" v-if="cursorYM !== monthOf(today)" @click="jumpToToday">
      跳到今天
    </button>
  </div>
</template>

<style scoped>
.cal { padding: 14px; }
.cal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.cal-head .title {
  font-weight: 600;
  font-size: 13px;
}
.cal-head .nav {
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-muted);
  border-radius: var(--radius-sm);
  font-size: 16px;
  line-height: 1;
}
.cal-head .nav:hover {
  color: var(--accent);
  background: var(--accent-soft);
}
.cal-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  font-size: 10.5px;
  color: var(--text-faint);
  margin-bottom: 4px;
  letter-spacing: 0.05em;
}
.cal-weekdays span { text-align: center; }
.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}
.cell {
  aspect-ratio: 1;
  padding: 0;
  border: 1px solid transparent;
  background: transparent;
  border-radius: var(--radius-sm);
  font-size: 12.5px;
  color: var(--text);
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-variant-numeric: tabular-nums;
  transition: background var(--transition);
}
.cell:hover {
  background: var(--accent-soft);
  color: var(--accent);
  border-color: transparent;
}
.cell-empty { visibility: hidden; }
.cell-today {
  font-weight: 600;
  color: var(--accent);
}
.cell-selected,
.cell-selected:hover {
  background: var(--accent);
  color: #fff;
}
.cell-selected.cell-today { color: #fff; }

.day { line-height: 1; }
.dots {
  position: absolute;
  bottom: 3px;
  display: flex;
  gap: 2px;
}
.dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
}
.cell-selected .dot { background: rgba(255, 255, 255, 0.85) !important; }

.goto-today {
  width: 100%;
  margin-top: 12px;
  padding: 4px;
  font-size: 11px;
  color: var(--text-muted);
  border: 1px solid transparent;
  background: transparent;
  border-radius: var(--radius-sm);
}
.goto-today:hover {
  background: var(--accent-soft);
  color: var(--accent);
}
</style>
