<script setup lang="ts">
import { computed } from "vue";
import Icon from "./Icon.vue";
import { themeMode, cycleTheme } from "@/lib/theme";

const iconName = computed(() => {
  switch (themeMode.value) {
    case "light": return "sun";
    case "dark": return "moon";
    default: return "monitor";   // auto
  }
});
const label = computed(() => {
  switch (themeMode.value) {
    case "light": return "浅色 · 点击切到深色";
    case "dark": return "深色 · 点击切到跟随系统";
    default: return "跟随系统 · 点击切到浅色";
  }
});
</script>

<template>
  <button class="theme-btn" :title="label" :aria-label="label" @click="cycleTheme">
    <Icon :name="iconName" />
  </button>
</template>

<style scoped>
.theme-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  background: transparent;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
}
.theme-btn:hover {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: transparent;
}
@media (max-width: 720px) {
  .theme-btn { width: 36px; height: 36px; }
}
</style>
