<script setup lang="ts">
import { computed } from "vue";

interface Series { tagId: string | null; color: string; name: string }
interface Bar { label: string; segments: { tagId: string | null; minutes: number }[] }

const props = defineProps<{
  bars: Bar[];
  series: Series[];
  height?: number;
}>();

const H = props.height ?? 200;
const PAD = 28;

const max = computed(() => {
  let m = 0;
  for (const b of props.bars) {
    const sum = b.segments.reduce((a, s) => a + s.minutes, 0);
    if (sum > m) m = sum;
  }
  return Math.max(m, 60);
});

const colorMap = computed(() => new Map(props.series.map((s) => [s.tagId, s.color])));
const nameMap = computed(() => new Map(props.series.map((s) => [s.tagId, s.name])));
</script>

<template>
  <div class="chart">
    <svg :viewBox="`0 0 ${bars.length * 60 + PAD} ${H}`" preserveAspectRatio="none">
      <line :x1="PAD" :y1="H - PAD" :x2="bars.length * 60 + PAD - 8" :y2="H - PAD" stroke="var(--border-strong)" />
      <g v-for="(b, i) in bars" :key="b.label">
        <g :transform="`translate(${PAD + i * 60}, 0)`">
          <g :transform="`translate(0, ${H - PAD})`">
            <g v-for="(seg, si) in b.segments" :key="si">
              <rect
                :x="10"
                :y="-(b.segments.slice(0, si + 1).reduce((a, s) => a + s.minutes, 0) / max * (H - PAD - 12))"
                :width="40"
                :height="(seg.minutes / max) * (H - PAD - 12)"
                :fill="colorMap.get(seg.tagId) ?? '#9aa0a6'"
              >
                <title>{{ nameMap.get(seg.tagId) ?? '未分类' }}: {{ Math.round(seg.minutes) }}m</title>
              </rect>
            </g>
          </g>
          <text :x="30" :y="H - 8" text-anchor="middle" font-size="10" fill="var(--text-muted)">
            {{ b.label }}
          </text>
        </g>
      </g>
    </svg>
    <div class="legend">
      <span v-for="s in series" :key="s.tagId ?? 'untagged'">
        <i :style="{ background: s.color }" />{{ s.name }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.chart svg { width: 100%; height: auto; }
.legend { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; color: var(--text-muted); margin-top: 8px; }
.legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; vertical-align: middle; }
</style>
