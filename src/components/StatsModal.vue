<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useStore } from "@/lib/store";
import { aggregateByTag, aggregateDailyByTag } from "@/lib/stats";
import { addDays, formatYMD, parseYMD } from "@/lib/date";
import BarChart from "./BarChart.vue";

defineEmits<{ close: [] }>();
const store = useStore();

const mode = ref<"week" | "month">("week");
const today = formatYMD(new Date());
const refDate = ref(today);

const range = computed(() => {
  const d = parseYMD(refDate.value);
  if (mode.value === "week") {
    const dow = d.getUTCDay();
    const start = addDays(d, -dow);
    return { from: formatYMD(start), to: formatYMD(addDays(start, 6)) };
  }
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  return {
    from: formatYMD(new Date(Date.UTC(y, m, 1))),
    to: formatYMD(new Date(Date.UTC(y, m + 1, 0))),
  };
});

const loading = ref(false);
watch(range, async (r) => {
  loading.value = true;
  try { await store.prefetchMonths(r.from, r.to); }
  finally { loading.value = false; }
}, { immediate: true });

const monthsArray = computed(() => Object.values(store.state.months));

const totals = computed(() => aggregateByTag(monthsArray.value, range.value.from, range.value.to));

const series = computed(() => {
  return totals.value.map((t) => ({
    tagId: t.tagId,
    color: store.getTagById(t.tagId)?.color ?? "#9aa0a6",
    name: store.getTagById(t.tagId)?.name ?? "未分类",
  }));
});

const bars = computed(() => {
  if (mode.value === "week") {
    const days = aggregateDailyByTag(monthsArray.value, range.value.from, range.value.to);
    return days.map((d) => ({
      label: d.date.slice(8),
      segments: d.byTag,
    }));
  }
  const start = parseYMD(range.value.from);
  const buckets: { from: string; to: string; label: string }[] = [];
  for (let d = start; formatYMD(d) <= range.value.to; d = addDays(d, 7)) {
    const end = addDays(d, 6);
    const toStr = formatYMD(end) > range.value.to ? range.value.to : formatYMD(end);
    buckets.push({ from: formatYMD(d), to: toStr, label: formatYMD(d).slice(5) });
  }
  return buckets.map((b) => ({
    label: b.label,
    segments: aggregateByTag(monthsArray.value, b.from, b.to),
  }));
});

function fmt(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return `${m}m`;
  if (!m) return `${h}h`;
  return `${h}h${m}m`;
}
</script>

<template>
  <div class="stats">
    <header>
      <h2>统计</h2>
      <button @click="$emit('close')">关闭</button>
    </header>

    <div class="controls">
      <button :class="{ on: mode === 'week' }" @click="mode = 'week'">本周</button>
      <button :class="{ on: mode === 'month' }" @click="mode = 'month'">本月</button>
      <input type="date" v-model="refDate" />
      <span v-if="loading" class="muted">加载中…</span>
    </div>

    <p class="range">{{ range.from }} 至 {{ range.to }}</p>

    <BarChart :bars="bars" :series="series" />

    <table class="totals">
      <tbody>
        <tr v-for="t in totals" :key="t.tagId ?? 'untagged'">
          <td>
            <span class="dot" :style="{ background: store.getTagById(t.tagId)?.color ?? '#9aa0a6' }" />
            {{ store.getTagById(t.tagId)?.name ?? '未分类' }}
          </td>
          <td class="num">{{ fmt(t.minutes) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.stats { padding: 16px; min-width: 480px; max-width: 720px; }
header { display: flex; justify-content: space-between; align-items: center; }
.controls { display: flex; gap: 8px; align-items: center; margin: 12px 0; }
.controls button.on { border-color: var(--accent); color: var(--accent); }
.range { color: var(--text-muted); font-size: 12px; margin: 0 0 12px 0; }
.muted { color: var(--text-muted); font-size: 12px; }
.totals { width: 100%; margin-top: 16px; }
.totals td { padding: 4px 0; }
.totals .num { text-align: right; font-variant-numeric: tabular-nums; color: var(--text-muted); }
.dot { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 6px; vertical-align: middle; }
</style>
