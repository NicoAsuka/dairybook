<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "@/lib/store";
import { addDays, formatYMD, parseYMD } from "@/lib/date";
import Icon from "./Icon.vue";

const props = defineProps<{ compact?: boolean }>();

const store = useStore();

const label = computed(() => {
  const d = parseYMD(store.state.selectedDate);
  if (props.compact) {
    // 紧凑模式：5月9日 周四
    return new Intl.DateTimeFormat("zh-CN", {
      month: "long",
      day: "numeric",
      weekday: "short",
    }).format(d);
  }
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(d);
});

const isToday = computed(() => store.state.selectedDate === formatYMD(new Date()));

function shift(n: number) {
  store.selectDate(formatYMD(addDays(parseYMD(store.state.selectedDate), n)));
}
function today() {
  store.selectDate(formatYMD(new Date()));
}
</script>

<template>
  <div class="datenav" :class="{ compact }">
    <button class="nav" @click="shift(-1)" aria-label="前一天">
      <Icon name="chevron-left" :size="16" />
    </button>
    <span class="label">{{ label }}</span>
    <button class="nav" @click="shift(1)" aria-label="后一天">
      <Icon name="chevron-right" :size="16" />
    </button>
    <button class="today" :class="{ active: isToday }" @click="today">今天</button>
  </div>
</template>

<style scoped>
.datenav {
  display: flex;
  align-items: center;
  gap: 4px;
}
.label {
  min-width: 220px;
  text-align: center;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.datenav.compact .label {
  min-width: 0;
  font-size: 13px;
  padding: 0 4px;
}
.nav {
  width: 28px;
  height: 28px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-muted);
  border-radius: var(--radius-sm);
}
.nav:hover {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: transparent;
}
.today {
  margin-left: 12px;
  padding: 4px 12px;
  font-size: 12px;
  border-radius: 12px;
  border: 1px solid var(--border-strong);
}
.datenav.compact .today {
  margin-left: 4px;
  padding: 4px 10px;
}
.today.active {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-soft);
}
</style>
