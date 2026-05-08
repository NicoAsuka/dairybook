<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "@/lib/store";
import TagBadge from "./TagBadge.vue";

const store = useStore();

function minutesBetween(start: string, end: string): number {
  const [sh = 0, sm = 0] = start.split(":").map(Number);
  const [eh = 0, em = 0] = end.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

interface Row { tagId: string | null; minutes: number }

const rows = computed<Row[]>(() => {
  const totals = new Map<string | null, number>();
  for (const e of store.entriesForSelectedDate()) {
    totals.set(e.tagId, (totals.get(e.tagId) ?? 0) + minutesBetween(e.start, e.end));
  }
  return [...totals.entries()]
    .map(([tagId, minutes]) => ({ tagId, minutes }))
    .sort((a, b) => b.minutes - a.minutes);
});

function fmt(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
}
</script>

<template>
  <div class="summary">
    <div class="head">今日合计</div>
    <ul v-if="rows.length">
      <li v-for="r in rows" :key="r.tagId ?? 'untagged'">
        <TagBadge :tag="store.getTagById(r.tagId)" />
        <span class="dur">{{ fmt(r.minutes) }}</span>
      </li>
    </ul>
    <div v-else class="empty">
      <span class="empty-dot" />
      <span class="empty-text">还没有 entry</span>
    </div>
  </div>
</template>

<style scoped>
.summary { padding: 12px; border-top: 1px solid var(--border); }
.head { font-size: 11px; color: var(--text-faint); text-transform: uppercase; letter-spacing: .05em; margin-bottom: 8px; }
ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
li { display: flex; align-items: center; justify-content: space-between; }
.dur { font-variant-numeric: tabular-nums; color: var(--text-muted); font-size: 12px; }
.empty {
  display: flex; align-items: center; gap: 8px;
  padding: 4px 0;
  color: var(--text-faint);
  font-size: 12px;
}
.empty-dot {
  width: 6px; height: 6px;
  border: 1.5px dashed var(--border-strong);
  border-radius: 50%;
}
</style>
