<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "@/lib/store";
import { addDays, formatYMD, parseYMD } from "@/lib/date";

const store = useStore();

const label = computed(() => {
  const d = parseYMD(store.state.selectedDate);
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric", month: "long", day: "numeric", weekday: "short",
  }).format(d);
});

function shift(n: number) {
  store.selectDate(formatYMD(addDays(parseYMD(store.state.selectedDate), n)));
}
function today() {
  store.selectDate(formatYMD(new Date()));
}
</script>

<template>
  <div class="datenav">
    <button @click="shift(-1)" aria-label="前一天">&#8249;</button>
    <span class="label">{{ label }}</span>
    <button @click="shift(1)" aria-label="后一天">&#8250;</button>
    <button class="today" @click="today">今天</button>
  </div>
</template>

<style scoped>
.datenav { display: flex; align-items: center; gap: 8px; }
.label { min-width: 200px; text-align: center; font-weight: 500; }
.today { margin-left: 12px; }
</style>
