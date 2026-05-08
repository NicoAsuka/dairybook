<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useStore } from "@/lib/store";
import { aggregateByTag, aggregateDailyByTag } from "@/lib/stats";
import { addDays, formatYMD, parseYMD } from "@/lib/date";
import BarChart from "./BarChart.vue";
import Icon from "./Icon.vue";

defineEmits<{ close: [] }>();
const store = useStore();

const mode = ref<"week" | "month">("week");
const today = formatYMD(new Date());
const refDate = ref(today);

function shiftRange(delta: number) {
  const d = parseYMD(refDate.value);
  if (mode.value === "week") {
    refDate.value = formatYMD(addDays(d, delta * 7));
  } else {
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + delta;
    refDate.value = formatYMD(new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), 28))));
  }
}

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

const rangeLabel = computed(() => {
  if (mode.value === "week") {
    return `${range.value.from} ~ ${range.value.to}`;
  }
  const d = parseYMD(range.value.from);
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long" }).format(d);
});

const loading = ref(false);
watch(range, async (r) => {
  loading.value = true;
  try { await store.prefetchMonths(r.from, r.to); }
  finally { loading.value = false; }
}, { immediate: true });

const monthsArray = computed(() => Object.values(store.state.months));

const totals = computed(() =>
  aggregateByTag(monthsArray.value, range.value.from, range.value.to),
);

const totalMinutes = computed(() =>
  totals.value.reduce((a, t) => a + t.minutes, 0),
);

const series = computed(() => totals.value.map((t) => ({
  tagId: t.tagId,
  color: store.getTagById(t.tagId)?.color ?? "#9aa0a6",
  name: store.getTagById(t.tagId)?.name ?? "未分类",
})));

const bars = computed(() => {
  if (mode.value === "week") {
    const days = aggregateDailyByTag(
      monthsArray.value, range.value.from, range.value.to,
    );
    const weekLabels = ["日", "一", "二", "三", "四", "五", "六"];
    return days.map((d, i) => ({
      label: `${weekLabels[i]} ${d.date.slice(8)}`,
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
  if (!h) return `${m}min`;
  if (!m) return `${h}h`;
  return `${h}h ${m}min`;
}

function pct(min: number): string {
  if (totalMinutes.value === 0) return "0%";
  return `${Math.round((min / totalMinutes.value) * 100)}%`;
}
</script>

<template>
  <div class="stats" @click.stop>
    <header class="head">
      <div class="title">
        <Icon name="stats" :size="18" />
        <h2>统计</h2>
      </div>
      <button class="icon-btn" @click="$emit('close')" aria-label="关闭">
        <Icon name="x" />
      </button>
    </header>

    <div class="controls">
      <div class="segment">
        <button :class="{ on: mode === 'week' }" @click="mode = 'week'">本周</button>
        <button :class="{ on: mode === 'month' }" @click="mode = 'month'">本月</button>
      </div>
      <div class="range-nav">
        <button class="nav" @click="shiftRange(-1)" aria-label="上一段">
          <Icon name="chevron-left" :size="16" />
        </button>
        <span class="range-label">{{ rangeLabel }}</span>
        <button class="nav" @click="shiftRange(1)" aria-label="下一段">
          <Icon name="chevron-right" :size="16" />
        </button>
      </div>
      <div class="loading" v-if="loading">加载中…</div>
    </div>

    <div v-if="totalMinutes === 0" class="empty-state">
      <Icon name="stats" :size="36" />
      <p class="empty-title">这段时间还没有 entry</p>
      <p class="empty-hint">写点东西，下次回来就能看到时长分布了</p>
    </div>

    <template v-else>
      <div class="overview">
        <div class="metric">
          <span class="metric-label">总时长</span>
          <span class="metric-value">{{ fmt(totalMinutes) }}</span>
        </div>
        <div class="metric">
          <span class="metric-label">天数</span>
          <span class="metric-value">{{ bars.length }}</span>
        </div>
        <div class="metric">
          <span class="metric-label">日均</span>
          <span class="metric-value">{{ fmt(Math.round(totalMinutes / Math.max(bars.length, 1))) }}</span>
        </div>
      </div>

      <BarChart :bars="bars" :series="series" />

      <div class="totals">
        <div
          v-for="t in totals"
          :key="t.tagId ?? 'untagged'"
          class="total-row"
        >
          <span class="dot" :style="{ background: store.getTagById(t.tagId)?.color ?? '#9aa0a6' }" />
          <span class="name">{{ store.getTagById(t.tagId)?.name ?? '未分类' }}</span>
          <span class="bar">
            <span
              class="bar-fill"
              :style="{
                width: pct(t.minutes),
                background: store.getTagById(t.tagId)?.color ?? '#9aa0a6',
              }"
            />
          </span>
          <span class="num">{{ fmt(t.minutes) }}</span>
          <span class="pct">{{ pct(t.minutes) }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.stats {
  padding: 18px 22px;
  width: 100%;
  min-width: 520px;
  max-width: 760px;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.head .title {
  display: flex; align-items: center; gap: 8px;
}
.head h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
}
.icon-btn {
  width: 30px; height: 30px;
  padding: 0;
  display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid transparent;
  background: transparent;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
}
.icon-btn:hover { color: var(--text); background: var(--bg); border-color: transparent; }

.controls {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.segment {
  display: inline-flex;
  background: var(--bg-subtle);
  padding: 2px;
  border-radius: 8px;
  border: 1px solid var(--border);
}
.segment button {
  padding: 4px 14px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  transition: background var(--transition), color var(--transition);
}
.segment button.on,
.segment button.on:hover {
  background: var(--bg-elevated);
  color: var(--text);
  box-shadow: var(--shadow-sm);
  border-color: transparent;
}
.segment button:hover {
  color: var(--accent);
  border-color: transparent;
}

.range-nav {
  display: flex;
  align-items: center;
  gap: 4px;
}
.range-label {
  min-width: 180px;
  text-align: center;
  font-weight: 500;
  font-size: 13px;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}
.nav {
  width: 28px; height: 28px;
  padding: 0;
  display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-muted);
  border-radius: var(--radius-sm);
}
.nav:hover { color: var(--accent); background: var(--accent-soft); border-color: transparent; }

.loading {
  font-size: 11px;
  color: var(--text-faint);
  margin-left: auto;
}

.overview {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 16px;
  padding: 14px;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: 8px;
}
.metric {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.metric-label {
  font-size: 11px;
  color: var(--text-faint);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 600;
}
.metric-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

.totals {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.total-row {
  display: grid;
  grid-template-columns: 14px auto 1fr 80px 56px;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  font-size: 13px;
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 3px;
}
.name {
  color: var(--text);
  font-weight: 500;
}
.bar {
  display: block;
  height: 6px;
  background: var(--bg);
  border-radius: 3px;
  overflow: hidden;
}
.bar-fill {
  display: block;
  height: 100%;
  border-radius: 3px;
  transition: width var(--transition);
}
.num {
  text-align: right;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}
.pct {
  text-align: right;
  color: var(--text-faint);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 56px 16px;
  text-align: center;
  color: var(--text-faint);
}
.empty-state :deep(svg) { color: var(--border-strong); }
.empty-title { margin: 0; font-size: 14px; color: var(--text-muted); }
.empty-hint { margin: 0; font-size: 12px; color: var(--text-faint); }
</style>
