<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "@/lib/store";
import { formatYMD, monthOf, parseYMD } from "@/lib/date";

const store = useStore();

const grid = computed(() => {
  const sel = parseYMD(store.state.selectedDate);
  const year = sel.getUTCFullYear();
  const month = sel.getUTCMonth();
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
  const d = parseYMD(store.state.selectedDate);
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long" }).format(d);
});

function hasEntries(ymd: string): boolean {
  const m = monthOf(ymd);
  return (store.state.months[m]?.data.days[ymd]?.entries.length ?? 0) > 0;
}
</script>

<template>
  <div class="cal">
    <div class="cal-head">{{ monthLabel }}</div>
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
          'cell-has': c.ymd && hasEntries(c.ymd),
        }"
        :disabled="!c.ymd"
        @click="c.ymd && store.selectDate(c.ymd)"
      >
        {{ c.day ?? '' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.cal { padding: 12px; }
.cal-head { font-weight: 500; margin-bottom: 8px; }
.cal-weekdays { display: grid; grid-template-columns: repeat(7,1fr); font-size: 11px; color: var(--text-faint); margin-bottom: 4px; }
.cal-weekdays span { text-align: center; }
.cal-grid { display: grid; grid-template-columns: repeat(7,1fr); gap: 2px; }
.cell {
  aspect-ratio: 1; padding: 0; border: none; background: transparent;
  border-radius: 4px; font-size: 13px; color: var(--text);
  position: relative;
}
.cell:hover { background: var(--border); }
.cell-empty { visibility: hidden; }
.cell-selected { background: var(--accent); color: #fff; }
.cell-has::after {
  content: ""; width: 4px; height: 4px; border-radius: 50%;
  background: var(--accent); position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%);
}
.cell-selected.cell-has::after { background: #fff; }
</style>
